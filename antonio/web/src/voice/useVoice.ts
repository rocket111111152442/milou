import { useCallback, useEffect, useRef, useState } from "react";
import type { UIEvent, VoiceState } from "@antonio/shared";
import { LiveVoice } from "./live";
import { WakeWord, wakeAvailability, type WakeAvailability } from "./wake";

export interface VoiceHandlers {
  onUi: (events: UIEvent[]) => void;
  onUserFinal: (text: string) => void;
  onAssistantFinal: (text: string) => void;
  onError: (msg: string) => void;
  /** Commande déjà transcrite localement après le prénom : traitée comme un tour écrit. */
  onWakeCommand: (text: string) => Promise<string | null>;
}

export function useVoice(assistantName: string, available: boolean, handlers: VoiceHandlers) {
  const [state, setState] = useState<VoiceState>("muted");
  const [liveUser, setLiveUser] = useState("");
  const [liveAssistant, setLiveAssistant] = useState("");
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [wakeSupport, setWakeSupport] = useState<WakeAvailability>("unsupported");
  const [wakeDetail, setWakeDetail] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const h = useRef(handlers);
  h.current = handlers;
  const live = useRef<LiveVoice | null>(null);
  const wake = useRef<WakeWord | null>(null);
  const pendingSpeak = useRef<string | null>(null);

  // La disponibilité de la reconnaissance locale n'est interrogée qu'à la demande de l'utilisateur
  // (activation de la veille) : pas de sondage silencieux au chargement.

  const restState = useCallback(() => (wake.current && wakeEnabled ? "standby" : "muted"), [wakeEnabled]);

  const ensureLive = useCallback(() => {
    if (!live.current) {
      live.current = new LiveVoice({
        onState: (s) => {
          setState(s);
          if (s === "listening" && pendingSpeak.current) {
            const text = pendingSpeak.current;
            pendingSpeak.current = null;
            live.current?.send({ type: "session.commentary.append", delegation_id: null, content: text });
          }
        },
        onUserText: (t, final) => {
          setLiveUser(final ? "" : t);
          if (final && t) h.current.onUserFinal(t);
        },
        onAssistantText: (t, final) => {
          setLiveAssistant(final ? "" : t);
          if (final && t) h.current.onAssistantFinal(t);
        },
        onUi: (e) => h.current.onUi(e),
        onTurn: () => undefined,
        onError: (m) => h.current.onError(m),
        onClosed: (reason) => {
          setSessionActive(false);
          setLiveUser("");
          setLiveAssistant("");
          setState(wake.current && wakeEnabledRef.current ? "standby" : "muted");
          if (wake.current && wakeEnabledRef.current) wake.current.start();
          if (reason && !["close_requested", "Terminée"].includes(reason)) h.current.onError(`Session vocale terminée : ${reason}`);
        },
      });
    }
    return live.current;
  }, []);

  const wakeEnabledRef = useRef(false);
  wakeEnabledRef.current = wakeEnabled;

  const startConversation = useCallback(async () => {
    if (!available) return h.current.onError("La voix n'est pas configurée sur ce serveur (OPENAI_API_KEY). Le mode écrit reste disponible.");
    wake.current?.pause();
    const l = ensureLive();
    setSessionActive(true);
    await l.start();
    if (!l.active) setSessionActive(false);
  }, [available, ensureLive]);

  const stopConversation = useCallback(async () => {
    await live.current?.stop("Terminée");
  }, []);

  /** Coupure immédiate : micro coupé, veille suspendue. */
  const muteAll = useCallback(() => {
    wake.current?.pause();
    if (live.current?.active) live.current.setMuted(true);
    setWakeEnabled(false);
    setState("muted");
  }, []);

  const unmute = useCallback(() => {
    if (live.current?.active) live.current.setMuted(false);
  }, []);

  const toggleWake = useCallback(
    async (on: boolean) => {
      if (!on) {
        wake.current?.pause();
        setWakeEnabled(false);
        if (!live.current?.active) setState("muted");
        return;
      }
      const support = wakeSupport === "available" ? wakeSupport : await wakeAvailability();
      setWakeSupport(support);
      if (support !== "available") {
        setWakeDetail(
          support === "downloadable"
            ? "Le modèle de reconnaissance locale doit d'abord être installé (bouton « Installer »)."
            : "Ce navigateur ne propose pas de reconnaissance vocale locale : la veille par le prénom est indisponible. Utilisez Ctrl+Maj+Espace ou le bouton micro.",
        );
        return;
      }
      if (!wake.current) {
        wake.current = new WakeWord(
          assistantName,
          (rest) => {
            void (async () => {
              await startConversation();
              if (rest.trim().length > 3) {
                const reply = await h.current.onWakeCommand(rest.trim());
                if (reply) pendingSpeak.current = reply;
              }
            })();
          },
          (s, detail) => {
            if (s === "error") {
              setWakeDetail(detail ?? "Erreur de reconnaissance locale");
              setWakeEnabled(false);
              setState((cur) => (cur === "standby" ? "muted" : cur));
            }
          },
        );
      }
      wake.current.setName(assistantName);
      setWakeEnabled(true);
      setWakeDetail(null);
      if (!live.current?.active) {
        wake.current.start();
        setState("standby");
      }
    },
    [assistantName, startConversation, wakeSupport],
  );

  // Onglet masqué : la veille locale est suspendue par le navigateur ; on l'indique honnêtement.
  useEffect(() => {
    const onVis = () => {
      if (!wakeEnabledRef.current || live.current?.active) return;
      if (document.visibilityState === "visible") {
        wake.current?.start();
        setState("standby");
      } else {
        wake.current?.pause();
        setState("muted");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Raccourcis : Ctrl+Maj+Espace (démarrer/arrêter), Échap (coupure immédiate du micro).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        if (live.current?.active) void stopConversation();
        else void startConversation();
      } else if (e.key === "Escape" && (live.current?.active || wakeEnabledRef.current)) {
        muteAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startConversation, stopConversation, muteAll]);

  useEffect(
    () => () => {
      void live.current?.stop();
      wake.current?.pause();
    },
    [],
  );

  return {
    state,
    liveUser,
    liveAssistant,
    sessionActive,
    wakeEnabled,
    wakeSupport,
    wakeDetail,
    setWakeSupport,
    startConversation,
    stopConversation,
    muteAll,
    unmute,
    toggleWake,
    restState,
  };
}
