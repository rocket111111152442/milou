/**
 * Écoute de veille du prénom de l'assistant, en LOCAL uniquement.
 *
 * Technologie : Web Speech API avec `processLocally = true` (reconnaissance sur
 * l'appareil, spécification W3C ; disponible dans les versions récentes de Chrome).
 * Si le navigateur ne propose pas la reconnaissance locale pour le français,
 * la veille est DÉSACTIVÉE : on ne bascule jamais sur la reconnaissance en ligne,
 * qui enverrait l'audio ambiant à un service distant. L'utilisateur garde le
 * raccourci clavier et le bouton micro.
 *
 * Limites honnêtes :
 *  - un onglet fermé n'écoute pas ; un onglet en arrière-plan ou un ordinateur en veille peut être suspendu ;
 *  - n'importe quel prénom fonctionne (reconnaissance de mots), mais la précision dépend du modèle local ;
 *  - une écoute système permanente nécessiterait une application de bureau (voir docs/VOICE.md).
 */

type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type SRCtor = {
  new (): SR;
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<"available" | "downloadable" | "downloading" | "unavailable">;
  install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};

function ctor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type WakeAvailability = "available" | "downloadable" | "unsupported";

export async function wakeAvailability(lang = "fr-FR"): Promise<WakeAvailability> {
  const C = ctor();
  if (!C || typeof C.available !== "function") return "unsupported";
  try {
    const s = await C.available({ langs: [lang], processLocally: true });
    if (s === "available") return "available";
    if (s === "downloadable" || s === "downloading") return "downloadable";
    return "unsupported";
  } catch {
    return "unsupported";
  }
}

/** Téléchargement du modèle local : exige un geste de l'utilisateur. */
export async function installLocalModel(lang = "fr-FR") {
  const C = ctor();
  if (!C?.install) return false;
  return C.install({ langs: [lang], processLocally: true });
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export class WakeWord {
  private rec: SR | null = null;
  private running = false;
  private stopped = true;

  constructor(
    private name: string,
    private onWake: (rest: string) => void,
    private onStatus: (s: "listening" | "paused" | "error", detail?: string) => void,
  ) {}

  setName(name: string) {
    this.name = name;
  }

  start() {
    const C = ctor();
    if (!C) return this.onStatus("error", "Reconnaissance vocale indisponible");
    this.stopped = false;
    if (this.running) return;
    const rec = new C();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.processLocally = true; // impératif : jamais de reconnaissance distante pour la veille
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = norm(e.results[i][0].transcript);
        const target = norm(this.name);
        const idx = txt.indexOf(target);
        if (idx >= 0) {
          const rest = e.results[i][0].transcript.slice(idx + this.name.length).replace(/^[\s,]+/, "");
          this.pause();
          this.onWake(rest);
          return;
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      this.onStatus("error", e.error === "not-allowed" ? "Micro refusé" : e.error === "language-not-supported" ? "Modèle local non installé" : e.error);
      this.stopped = true;
    };
    rec.onend = () => {
      this.running = false;
      // Redémarrage automatique tant que la veille est active et la page visible.
      if (!this.stopped && document.visibilityState === "visible") setTimeout(() => this.start(), 300);
      else this.onStatus("paused");
    };
    try {
      rec.start();
      this.rec = rec;
      this.running = true;
      this.onStatus("listening");
    } catch (e) {
      this.onStatus("error", (e as Error).message);
    }
  }

  pause() {
    this.stopped = true;
    this.rec?.abort();
    this.running = false;
  }
}
