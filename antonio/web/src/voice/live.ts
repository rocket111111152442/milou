import type { UIEvent, VoiceState } from "@antonio/shared";
import { api } from "../lib/api";

/**
 * Conversation vocale avec GPT-Live (WebRTC).
 *  - L'audio passe sur les pistes média ; les événements JSON sur le canal « oai-events ».
 *  - Le serveur crée la session (la clé API ne quitte jamais le serveur).
 *  - Chaque « délégation » de GPT-Live est relayée à NOTRE serveur, qui exécute le tour
 *    (gpt-6-luna + outils + politique) ; le texte vérifié revient à GPT-Live via
 *    session.commentary.append, qu'il reformule à voix haute.
 *  - Interruption : GPT-Live est full duplex ; couper la parole n'annule pas une action déjà lancée.
 */

export interface LiveCallbacks {
  onState: (s: VoiceState) => void;
  onUserText: (text: string, final: boolean) => void;
  onAssistantText: (text: string, final: boolean) => void;
  onUi: (events: UIEvent[]) => void;
  onError: (message: string) => void;
  onClosed: (reason: string) => void;
  onTurn: (reply: { text: string; conversationId: string }) => void;
}

export class LiveVoice {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private audio: HTMLAudioElement;
  private voiceSessionId: string | null = null;
  private userBuffer = "";
  private assistantBuffer = "";
  private speakingTimer: ReturnType<typeof setTimeout> | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private closing = false;
  private pendingDelegations = 0;
  private lastActivity = Date.now();
  muted = false;

  constructor(private cb: LiveCallbacks) {
    this.audio = new Audio();
    this.audio.autoplay = true;
  }

  get active() {
    return Boolean(this.pc);
  }

  async start() {
    if (this.pc) return;
    this.closing = false;
    this.cb.onState("processing");
    try {
      const pc = new RTCPeerConnection();
      this.pc = pc;
      pc.addEventListener("track", (e) => {
        this.audio.srcObject = new MediaStream([e.track]);
        this.audio.play().catch(() => this.cb.onError("Lecture audio bloquée par le navigateur : cliquez dans la page pour autoriser le son."));
      });
      this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      for (const t of this.mic.getAudioTracks()) pc.addTrack(t, this.mic);
      const dc = pc.createDataChannel("oai-events");
      this.dc = dc;
      dc.addEventListener("message", (m) => this.onEvent(JSON.parse(m.data)));
      dc.addEventListener("close", () => {
        if (!this.closing) this.cleanup("connection_lost");
      });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitIce(pc);
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error("Offre SDP manquante");
      const r = await api<{ voiceSessionId: string; answerSdp: string; limits: { sessionMaxMinutes: number; remainingTodaySeconds: number } }>("/api/voice/session", {
        body: { sdp },
      });
      this.voiceSessionId = r.voiceSessionId;
      await pc.setRemoteDescription({ type: "answer", sdp: r.answerSdp });
      const maxMs = Math.min(r.limits.sessionMaxMinutes * 60, Math.max(30, r.limits.remainingTodaySeconds)) * 1000;
      this.maxTimer = setTimeout(() => void this.stop("Durée maximale atteinte"), maxMs);
      this.armIdle();
    } catch (e) {
      this.cleanup("failed");
      this.cb.onError(e instanceof Error ? e.message : String(e));
    }
  }

  /** Fermeture des sessions inutilisées : 2 min sans parole ni réponse => fin de session facturée. */
  private armIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (Date.now() - this.lastActivity > 110_000 && this.pendingDelegations === 0) void this.stop("Inactivité");
      else this.armIdle();
    }, 120_000);
  }

  send(ev: Record<string, unknown>) {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(ev));
  }

  private onEvent(ev: Record<string, unknown> & { type: string }) {
    switch (ev.type) {
      case "session.started":
      case "session.resumed":
        this.cb.onState(this.muted ? "muted" : "listening");
        break;
      case "session.paused":
        this.cb.onState(this.muted ? "muted" : "standby");
        break;
      case "session.input_transcript.delta":
        this.lastActivity = Date.now();
        this.userBuffer += String(ev.delta ?? "");
        this.cb.onUserText(this.userBuffer, false);
        if (this.pendingDelegations === 0) this.cb.onState("listening");
        break;
      case "session.output_transcript.delta":
        this.lastActivity = Date.now();
        this.assistantBuffer += String(ev.delta ?? "");
        this.cb.onAssistantText(this.assistantBuffer, false);
        this.cb.onState("speaking");
        if (this.speakingTimer) clearTimeout(this.speakingTimer);
        this.speakingTimer = setTimeout(() => {
          this.cb.onAssistantText(this.assistantBuffer, true);
          this.assistantBuffer = "";
          this.cb.onState(this.pendingDelegations ? "processing" : this.muted ? "muted" : "listening");
        }, 1400);
        break;
      case "session.delegation.created": {
        const delegation = ev.delegation as { id: string } | undefined;
        if (delegation?.id) void this.delegate(delegation.id);
        break;
      }
      case "session.usage.updated": {
        const seconds = (ev.usage as { seconds?: number } | undefined)?.seconds ?? 0;
        void this.reportUsage(seconds, false);
        break;
      }
      case "session.closed": {
        const seconds = (ev.usage as { seconds?: number } | undefined)?.seconds ?? 0;
        void this.reportUsage(seconds, true, String(ev.reason ?? "closed"));
        this.cleanup(String(ev.reason ?? "closed"));
        break;
      }
      case "error": {
        const err = ev.error as { message?: string } | undefined;
        this.cb.onError(err?.message ?? "Erreur du service vocal");
        break;
      }
    }
  }

  private async delegate(delegationId: string) {
    if (!this.voiceSessionId) return;
    const utterance = this.userBuffer.trim();
    this.userBuffer = "";
    this.cb.onUserText(utterance, true);
    this.pendingDelegations++;
    this.cb.onState("processing");
    try {
      const r = await api<{ speak: string; uiEvents: UIEvent[]; text: string; conversationId: string }>("/api/voice/delegate", {
        body: { voiceSessionId: this.voiceSessionId, utterance },
      });
      this.cb.onUi(r.uiEvents);
      this.cb.onTurn({ text: r.text, conversationId: r.conversationId });
      // Texte vérifié par le serveur ; GPT-Live le reformule à l'oral.
      this.send({ type: "session.commentary.append", delegation_id: delegationId, content: r.speak });
    } catch (e) {
      this.send({
        type: "session.commentary.append",
        delegation_id: delegationId,
        content: `Je n'ai pas pu traiter la demande : ${(e as Error).message}. Rien n'a été exécuté.`,
      });
    } finally {
      this.pendingDelegations--;
    }
  }

  private async reportUsage(seconds: number, final: boolean, reason?: string) {
    if (!this.voiceSessionId) return;
    try {
      const r = await api<{ continue: boolean; reason: string | null }>("/api/voice/usage", { body: { voiceSessionId: this.voiceSessionId, seconds, final, reason } });
      if (!r.continue && !final) await this.stop(r.reason ?? "Limite atteinte");
    } catch {
      /* rapport perdu : le serveur limitera à la prochaine session */
    }
  }

  /** Coupure immédiate du micro (piste désactivée localement + commande au service). */
  setMuted(muted: boolean) {
    this.muted = muted;
    for (const t of this.mic?.getAudioTracks() ?? []) t.enabled = !muted;
    this.send({ type: muted ? "session.input_audio.mute" : "session.input_audio.unmute" });
    this.cb.onState(muted ? "muted" : "listening");
  }

  async stop(reason = "Terminée") {
    if (!this.pc || this.closing) return;
    this.closing = true;
    for (const t of this.mic?.getAudioTracks() ?? []) t.enabled = false;
    if (this.dc?.readyState === "open") {
      this.send({ type: "session.close" });
      // On attend session.closed (usage final) au plus 8 s.
      setTimeout(() => this.cleanup(reason), 8000);
    } else this.cleanup(reason);
  }

  private cleanup(reason: string) {
    if (!this.pc) return;
    for (const t of [this.speakingTimer, this.maxTimer, this.idleTimer]) if (t) clearTimeout(t);
    this.mic?.getTracks().forEach((t) => t.stop());
    this.dc?.close();
    this.pc.close();
    this.pc = null;
    this.dc = null;
    this.mic = null;
    this.audio.srcObject = null;
    this.voiceSessionId = null;
    this.userBuffer = "";
    this.assistantBuffer = "";
    this.cb.onClosed(reason);
  }
}

async function waitIce(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", on);
      reject(new Error("Délai de connexion audio dépassé"));
    }, 10_000);
    function on() {
      if (pc.iceGatheringState !== "complete") return;
      clearTimeout(t);
      pc.removeEventListener("icegatheringstatechange", on);
      resolve();
    }
    pc.addEventListener("icegatheringstatechange", on);
  });
}
