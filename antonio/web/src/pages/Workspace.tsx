import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { VOICE_STATE_LABELS, type AssistantReply, type UIEvent } from "@antonio/shared";
import { api } from "../lib/api";
import { useApp, useMe } from "../lib/app-state";
import { ContextPanel } from "../components/panels";
import { Icon } from "../components/Icons";
import { useVoice } from "../voice/useVoice";
import { installLocalModel } from "../voice/wake";

interface Bubble {
  id: string;
  role: "user" | "assistant";
  text: string;
  channel?: string;
  note?: string | null;
}

const SUGGESTIONS = ["Fais-moi le point sur ma journée", "Montre-moi mes mails à traiter", "Montre-moi mes rendez-vous", "Quels dossiers attendent une réponse depuis trois jours ?"];

export function Workspace() {
  const me = useMe();
  const { applyUi, panel, toast } = useApp();
  const name = me.data?.assistantName ?? "Antonio";
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const history = useQuery({
    queryKey: ["conversation"],
    queryFn: () => api<{ conversationId: string | null; turns: { id: string; role: "user" | "assistant"; content: string; channel: string; uiEvents: UIEvent[] }[] }>("/api/assistant/conversation"),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (history.data && bubbles.length === 0) {
      setConversationId(history.data.conversationId);
      setBubbles(history.data.turns.map((t) => ({ id: t.id, role: t.role, text: t.content, channel: t.channel })));
      // Reprise du contexte : on rétablit les derniers éléments affichés.
      const lastUi = [...history.data.turns].reverse().find((t) => t.role === "assistant" && t.uiEvents.length);
      if (lastUi && panel.cards.length === 0) applyUi(lastUi.uiEvents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.data]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [bubbles.length, busy]);

  const send = async (raw: string): Promise<string | null> => {
    const t = raw.trim();
    if (!t || busy) return null;
    setText("");
    setBubbles((b) => [...b, { id: `u${Date.now()}`, role: "user", text: t }]);
    setBusy(true);
    try {
      const r = await api<AssistantReply>("/api/assistant/message", { body: { text: t, conversationId } });
      setConversationId(r.conversationId);
      // La mention « sans IA » est déjà dans l'en-tête ; on n'affiche sous la bulle que les limitations ponctuelles (budget, panne).
      const note = r.limited && !r.limited.startsWith("Mode sans IA") ? r.limited : null;
      setBubbles((b) => [...b, { id: r.turnId, role: "assistant", text: r.text, note }]);
      applyUi(r.uiEvents);
      return r.text;
    } catch (e) {
      setBubbles((b) => [...b, { id: `e${Date.now()}`, role: "assistant", text: `Je n'ai pas pu traiter la demande : ${(e as Error).message}. Rien n'a été exécuté.` }]);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const voice = useVoice(name, Boolean(me.data?.voiceAvailable), {
    onUi: applyUi,
    onUserFinal: (t) => setBubbles((b) => [...b, { id: `vu${Date.now()}`, role: "user", text: t, channel: "voice" }]),
    onAssistantFinal: (t) => setBubbles((b) => [...b, { id: `va${Date.now()}`, role: "assistant", text: t, channel: "voice" }]),
    onError: (m) => toast(m),
    onWakeCommand: (t) => send(t),
  });

  const panelEmpty = panel.cards.length === 0;

  return (
    <div className={`workspace ${panelEmpty ? "panel-empty" : ""}`}>
      <div className="conv-col">
        <div className="presence">
          <div className="orb" data-state={voice.state} role="img" aria-label={`${name} : ${VOICE_STATE_LABELS[voice.state]}`} />
          <div className="grow stack-8">
            <h2>{name}</h2>
            <div className="voice-state" data-state={voice.state} aria-live="polite">
              <span className="dot" />
              {VOICE_STATE_LABELS[voice.state]}
              {voice.wakeEnabled && voice.state === "standby" && <span className="muted">· dites « {name} »</span>}
            </div>
          </div>
          <div className="row">
            <button
              className="btn icon mic-btn"
              aria-pressed={voice.sessionActive}
              onClick={() => (voice.sessionActive ? voice.stopConversation() : voice.startConversation())}
              title={voice.sessionActive ? "Terminer la conversation vocale (Ctrl+Maj+Espace)" : "Parler (Ctrl+Maj+Espace)"}
              aria-label={voice.sessionActive ? "Terminer la conversation vocale" : "Démarrer une conversation vocale"}
            >
              <Icon.Mic />
            </button>
            {(voice.sessionActive || voice.wakeEnabled) && (
              <button className="btn icon mute-btn" onClick={voice.muteAll} title="Couper le micro immédiatement (Échap)" aria-label="Couper le micro immédiatement">
                <Icon.MicOff />
              </button>
            )}
          </div>
        </div>
        <WakeControls voice={voice} name={name} />

        <div className="conv-scroll" ref={scroller} aria-live="polite">
          {bubbles.length === 0 && !busy && (
            <div className="stack-12" style={{ marginTop: 12 }}>
              <p className="muted">
                Bonjour{me.data ? ` ${me.data.user.displayName.split(" ")[0]}` : ""}. Demandez-moi le point de la journée, vos messages ou vos rendez-vous — à l'écrit ou à la voix.
              </p>
            </div>
          )}
          {bubbles.map((b) => (
            <div key={b.id} className={`bubble ${b.role}`}>
              {b.text}
              {(b.channel === "voice" || b.note) && <span className="meta">{b.note ?? "à l'oral"}</span>}
            </div>
          ))}
          {voice.liveUser && <div className="bubble user live">{voice.liveUser}</div>}
          {voice.liveAssistant && <div className="bubble assistant live">{voice.liveAssistant}</div>}
          {busy && (
            <div className="bubble assistant" aria-label="Antonio réfléchit">
              <span className="typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          )}
        </div>

        <div className="composer">
          {bubbles.length < 2 && (
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="composer-box"
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <label htmlFor="composer" className="sr-only">
              Écrire à {name}
            </label>
            <textarea
              id="composer"
              rows={1}
              value={text}
              placeholder={`Écrire à ${name}…`}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(text);
                }
              }}
            />
            <button className="btn primary icon" type="submit" disabled={!text.trim() || busy} aria-label="Envoyer">
              <Icon.Send />
            </button>
          </form>
          <p className="tiny muted kbd-hint" style={{ marginTop: 6 }}>
            <kbd>Ctrl</kbd>+<kbd>Maj</kbd>+<kbd>Espace</kbd> parler · <kbd>Échap</kbd> couper le micro
          </p>
        </div>
      </div>
      {!panelEmpty && (
        <div className="panel-col">
          <ContextPanel />
        </div>
      )}
    </div>
  );
}

function WakeControls({ voice, name }: { voice: ReturnType<typeof useVoice>; name: string }) {
  const [installing, setInstalling] = useState(false);
  return (
    <div style={{ padding: "0 22px 8px" }} className="stack-8">
      <label className="check small">
        <input type="checkbox" checked={voice.wakeEnabled} onChange={(e) => void voice.toggleWake(e.target.checked)} />
        Veille : m'appeler par « {name} » (reconnaissance locale, rien n'est envoyé tant que je n'entends pas mon prénom)
      </label>
      {voice.wakeSupport === "downloadable" && !voice.wakeEnabled && (
        <button
          className="btn small"
          disabled={installing}
          onClick={async () => {
            setInstalling(true);
            const ok = await installLocalModel().catch(() => false);
            setInstalling(false);
            voice.setWakeSupport(ok ? "available" : "unsupported");
          }}
        >
          Installer la reconnaissance locale du français
        </button>
      )}
      {voice.wakeDetail && <p className="tiny" style={{ color: "var(--wait)" }}>{voice.wakeDetail}</p>}
    </div>
  );
}
