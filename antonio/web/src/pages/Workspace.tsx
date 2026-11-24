import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { VOICE_STATE_LABELS, type AssistantReply, type ConnectionDTO, type EventDTO, type MessageDTO } from "@antonio/shared";
import { api } from "../lib/api";
import { useApp, useMe } from "../lib/app-state";
import { ContextPanel } from "../components/panels";
import { AssistantOrb } from "../components/AssistantOrb";
import { Icon } from "../components/Icons";
import { useVoice } from "../voice/useVoice";
import { installLocalModel } from "../voice/wake";

interface Bubble { id: string; role: "user" | "assistant"; text: string; channel?: string; note?: string | null }

export function Workspace() {
  const me = useMe();
  const { applyUi, panel, toast, clearPanel, navigate } = useApp();
  const name = me.data?.assistantName ?? "Waverti";
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [request, setRequest] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const history = useQuery({ queryKey: ["conversation"], queryFn: () => api<{ conversationId: string | null; turns: { id: string; role: "user" | "assistant"; content: string; channel: string }[] }>("/api/assistant/conversation"), staleTime: Infinity });
  useEffect(() => { if (history.data && !restored.current) { restored.current = true; setConversationId(history.data.conversationId); setBubbles(history.data.turns.map((t) => ({ id: t.id, role: t.role, text: t.content, channel: t.channel }))); } }, [history.data]);
  useEffect(() => { if (historyOpen) scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [bubbles.length, busy, historyOpen]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === "Escape") setHistoryOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);

  const send = async (raw: string): Promise<string | null> => {
    const t = raw.trim();
    if (!t || busy) return null;
    setText(""); setRequest(t); setAnswer("");
    setBubbles((b) => [...b, { id: `u${Date.now()}`, role: "user", text: t }]);
    setBusy(true);
    try {
      const r = await api<AssistantReply>("/api/assistant/message", { body: { text: t, conversationId } });
      setConversationId(r.conversationId);
      const note = r.limited && !r.limited.startsWith("Mode sans IA") ? r.limited : null;
      setBubbles((b) => [...b, { id: r.turnId, role: "assistant", text: r.text, note }]);
      setAnswer(r.text); applyUi(r.uiEvents); void history.refetch(); return r.text;
    } catch (e) {
      const message = `Je n'ai pas pu traiter la demande : ${(e as Error).message}. Rien n'a été exécuté.`;
      setBubbles((b) => [...b, { id: `e${Date.now()}`, role: "assistant", text: message }]); setAnswer(message); return null;
    } finally { setBusy(false); }
  };
  const voice = useVoice(name, Boolean(me.data?.voiceAvailable), {
    onUi: applyUi,
    onUserFinal: (t) => { setRequest(t); setAnswer(""); setBubbles((b) => [...b, { id: `vu${Date.now()}`, role: "user", text: t, channel: "voice" }]); },
    onAssistantFinal: (t) => { setAnswer(t); setBubbles((b) => [...b, { id: `va${Date.now()}`, role: "assistant", text: t, channel: "voice" }]); },
    onError: (m) => toast(m), onWakeCommand: (t) => send(t),
  });
  const hasContext = panel.cards.length > 0;
  const engaged = Boolean(request || answer || voice.liveAssistant || voice.liveUser || voice.sessionActive);
  const orbState = busy ? "processing" : voice.state;
  const caption = voice.liveAssistant || voice.liveUser || (busy ? request : answer);
  const shortCaption = caption.length > 220 ? caption.slice(0, 217).trimEnd() + "…" : caption;
  const displayName = me.data?.user.displayName === "Démonstration" ? "" : me.data?.user.displayName.split(" ")[0];
  const greeting = new Date().getHours() >= 18 ? "Bonsoir" : "Bonjour";
  const toggleVoice = () => voice.sessionActive ? void voice.stopConversation() : void voice.startConversation();

  return (
    <div className={`studio-workspace ${hasContext ? "has-context" : ""} ${engaged ? "is-engaged" : ""}`}>
      <section className="studio-stage" aria-label="Conversation avec Waverti">
        <div className="stage-overline"><span />VOTRE ASSISTANT PERSONNEL</div>
        {!engaged ? <div className="stage-welcome"><h1>{greeting}{displayName ? `, ${displayName}` : ""}<span>.</span></h1><p>Votre journée, en clair.</p></div> : <div className="stage-caption" aria-live="polite"><span className="caption-label">{busy || voice.liveUser ? "VOUS" : name.toUpperCase()}</span><AnimatePresence mode="wait"><motion.p key={busy ? "request" : caption ? "answer" : "listen"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>{shortCaption || "La conversation vocale est ouverte."}</motion.p></AnimatePresence>{answer.length > 220 && <button className="caption-expand" onClick={() => setHistoryOpen(true)}>Lire la réponse complète <span>↗</span></button>}</div>}
        <button className="orb-button" onClick={toggleVoice} aria-label={voice.sessionActive ? "Terminer la conversation vocale" : "Démarrer une conversation vocale"} aria-pressed={voice.sessionActive} title={me.data?.voiceAvailable ? "Parler avec Waverti" : "La voix nécessite une connexion OpenAI"}><AssistantOrb state={orbState} /></button>
        <div className="stage-state" data-state={orbState}><span className={`state-indicator ${busy ? "is-busy" : ""}`} />{busy ? "JE PRÉPARE VOTRE RÉPONSE" : voice.sessionActive || voice.wakeEnabled ? VOICE_STATE_LABELS[voice.state].toUpperCase() : "MICROPHONE COUPÉ"}</div>
      </section>

      <div className="studio-workbench">
        <AnimatePresence mode="wait">
          {hasContext ? <motion.section className="studio-context" key="context" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ type: "spring", stiffness: 230, damping: 28 }} aria-label="Informations de la conversation"><div className="workbench-heading"><span>LE CONTEXTE, SOUS LES YEUX</span><button onClick={clearPanel} aria-label="Revenir à l’aperçu de la journée">Réduire <Icon.Close width={12} height={12} /></button></div><ContextPanel /></motion.section> : <motion.div key="overview" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.35 }}><DailyOverview busy={busy} onSend={send} onNavigate={navigate} /></motion.div>}
        </AnimatePresence>
      </div>

      <div className="studio-composer-wrap">
        <div className="studio-shortcuts"><button onClick={() => void send("Fais-moi le point sur ma journée")} disabled={busy}><Icon.Sun width={13} height={13} />Faire le point <span>↗</span></button><button onClick={() => setHistoryOpen(true)}><Icon.History width={13} height={13} />Notre conversation{bubbles.length > 0 && <span className="shortcut-count">{bubbles.length}</span>}</button></div>
        <form className={`studio-composer ${busy ? "is-busy" : ""}`} onSubmit={(e) => { e.preventDefault(); void send(text); }}>
          <span className="composer-spark" aria-hidden>✳</span><label htmlFor="composer" className="sr-only">Écrire à {name}</label><textarea id="composer" rows={1} value={text} placeholder={`Demandez à ${name}…`} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} />
          {(voice.sessionActive || voice.wakeEnabled) && <button type="button" className="composer-microphone" onClick={voice.muteAll} aria-label="Couper le micro immédiatement"><Icon.MicOff /></button>}
          <button type="button" className={`composer-microphone ${voice.sessionActive ? "active" : ""}`} onClick={toggleVoice} aria-label={voice.sessionActive ? "Terminer la conversation vocale" : "Parler à Waverti"}><Icon.Mic /></button><span className="composer-divider" /><button className="composer-send" type="submit" disabled={!text.trim() || busy} aria-label="Envoyer"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 19V5m-5 5 5-5 5 5" /></svg></button>
        </form>
        <div className="studio-composer-meta"><span>{me.data?.engine === "demo" ? "Commandes simples disponibles · IA à activer" : "Vos actions, selon vos autorisations"}</span><WakeControls voice={voice} name={name} /></div>
      </div>

      <AnimatePresence>{historyOpen && <><motion.button className="conversation-scrim" aria-label="Fermer la conversation" onClick={() => setHistoryOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.aside className="conversation-drawer" role="dialog" aria-modal="true" aria-label="Notre conversation" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 290, damping: 32 }}><div className="drawer-heading"><div><span className="stage-overline">LE FIL DE VOTRE JOURNÉE</span><h2>Notre conversation</h2></div><button className="btn ghost icon" onClick={() => setHistoryOpen(false)} aria-label="Fermer la conversation"><Icon.Close /></button></div><div className="conversation-drawer-scroll" ref={scroller}>{bubbles.length === 0 && <p className="muted">La conversation apparaîtra ici dès votre première demande.</p>}{bubbles.map((b) => <div key={b.id} className={`conversation-turn ${b.role}`}><span>{b.role === "user" ? "VOUS" : name.toUpperCase()}</span><p>{b.text}</p>{b.note && <small>{b.note}</small>}</div>)}{busy && <div className="conversation-turn"><span>{name.toUpperCase()}</span><p>Je prépare votre réponse…</p></div>}</div></motion.aside></>}</AnimatePresence>
    </div>
  );
}

function DailyOverview({ busy, onSend, onNavigate }: { busy: boolean; onSend: (text: string) => Promise<string | null>; onNavigate: (view: "approvals" | "agenda" | "connections") => void }) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const mail = useQuery({ queryKey: ["messages", "studio"], queryFn: () => api<{ messages: MessageDTO[] }>("/api/messages?needsAction=true") });
  const events = useQuery({ queryKey: ["events", "studio", start.toISOString()], queryFn: () => api<{ events: EventDTO[] }>(`/api/events?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`) });
  const approvals = useQuery({ queryKey: ["actions", "pending-count"], queryFn: () => api<{ actions: unknown[] }>("/api/actions?status=awaiting_approval") });
  const connections = useQuery({ queryKey: ["connections"], queryFn: () => api<{ connections: ConnectionDTO[] }>("/api/connections") });
  const hasAccounts = connections.data?.connections.some((c) => c.status === "active") ?? true;
  const mails = mail.data?.messages;
  const list = events.data?.events;
  const count = approvals.data?.actions.length;
  return <div className="daily-overview"><div className="workbench-heading"><span>VOTRE JOURNÉE, EN UN REGARD</span><span className="overview-source">Depuis vos comptes connectés</span></div><div className="overview-grid">
    <button className="overview-card mail-overview" disabled={busy || mail.isLoading} onClick={() => hasAccounts ? void onSend("Montre-moi mes mails à traiter") : onNavigate("connections")}><div className="overview-card-top"><span className="overview-icon"><Icon.Inbox /></span><span>MESSAGES</span><span className="card-arrow">↗</span></div><h3>{!hasAccounts ? "Connectez votre boîte mail" : mails ? `${mails.length} message${mails.length > 1 ? "s" : ""} à traiter` : mail.isError ? "Messages indisponibles" : "Chargement…"}</h3><p>{!hasAccounts ? "Vos messages apparaîtront après connexion." : mails?.[0] ? `${mails[0].from.name ?? mails[0].from.email} · ${mails[0].subject}` : mails ? "Votre boîte de réception est à jour." : ""}</p><div className="overview-card-bottom"><span className="small-dot purple" />{!hasAccounts ? "Ajouter un compte" : mails?.length ? "Ouvrir les demandes" : "Consulter les messages"}<span>→</span></div></button>
    <button className="overview-card agenda-overview" onClick={() => hasAccounts ? void onSend("Montre-moi mes rendez-vous") : onNavigate("connections")} disabled={busy || events.isLoading}><div className="overview-card-top"><span className="overview-icon"><Icon.Calendar /></span><span>AGENDA</span><span className="card-arrow">↗</span></div><h3>{!hasAccounts ? "Ajoutez votre agenda" : list ? `${list.length} rendez-vous aujourd’hui` : events.isError ? "Agenda indisponible" : "Chargement…"}</h3><p>{!hasAccounts ? "Vos rendez-vous apparaîtront ici." : list?.[0] ? `${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(list[0].start))} · ${list[0].title}` : list ? "Une journée sans rendez-vous prévu." : ""}</p><div className="overview-card-bottom"><span className="small-dot blue" />Votre programme<span>→</span></div></button>
    <button className="overview-card action-overview" onClick={() => onNavigate("approvals")}><div className="overview-card-top"><span className="overview-icon"><Icon.Shield /></span><span>VOS DÉCISIONS</span><span className="card-arrow">↗</span></div><h3>{count === undefined ? approvals.isError ? "État indisponible" : "Chargement…" : count ? `${count} action${count > 1 ? "s" : ""} à valider` : "Vous avez le dernier mot"}</h3><p>{count === 0 ? "Aucune action en attente de validation." : count ? "Consultez les actions préparées pour vous." : ""}</p><div className="overview-card-bottom"><span className="small-dot green" />{count === 0 ? "Tout est à jour" : "Voir les validations"}<span>→</span></div></button>
  </div></div>;
}

function WakeControls({ voice, name }: { voice: ReturnType<typeof useVoice>; name: string }) {
  const [installing, setInstalling] = useState(false);
  return <details className="voice-options"><summary>Options vocales <span>⌄</span></summary><div className="voice-options-panel"><h3>Parler à {name}</h3><p>Activez la veille locale pour appeler votre assistant par son prénom lorsque cette fonction est disponible.</p><label className="check small"><input type="checkbox" checked={voice.wakeEnabled} onChange={(e) => void voice.toggleWake(e.target.checked)} />Veille par le prénom</label>{voice.wakeSupport === "downloadable" && !voice.wakeEnabled && <button className="btn small" disabled={installing} onClick={async () => { setInstalling(true); const ok = await installLocalModel().catch(() => false); setInstalling(false); voice.setWakeSupport(ok ? "available" : "unsupported"); }}>Installer la reconnaissance locale</button>}{voice.wakeDetail && <p className="voice-option-detail">{voice.wakeDetail}</p>}<small>Ctrl + Maj + Espace : parler · Échap : couper le micro.</small></div></details>;
}
