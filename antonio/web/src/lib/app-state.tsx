import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ServerEvent, UIEvent, ViewId } from "@antonio/shared";
import { api, queryClient } from "./api";

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface Me {
  user: { id: string; email: string; displayName: string; role: string; orgId: string };
  onboardingCompleted: boolean;
  assistantName: string;
  engine: "openai" | "demo";
  voiceAvailable: boolean;
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/api/auth/me"), retry: false, staleTime: 60_000 });
}

// ---------------------------------------------------------------------------
// Panneau contextuel : composants prédéfinis pilotés par des événements structurés
// ---------------------------------------------------------------------------

export type PanelCard =
  | { key: string; kind: "messages"; ids: string[]; title: string }
  | { key: string; kind: "message"; id: string }
  | { key: string; kind: "events"; ids: string[]; title: string; date?: string }
  | { key: string; kind: "slots"; slots: { start: string; end: string }[]; title: string }
  | { key: string; kind: "tasks"; ids: string[]; title: string }
  | { key: string; kind: "actions"; ids: string[]; title: string }
  | { key: string; kind: "action"; id: string }
  | { key: string; kind: "briefing"; id: string }
  | { key: string; kind: "rule"; id: string }
  | { key: string; kind: "memory"; id: string };

interface PanelState {
  /** Le premier élément est l'élément principal ; les autres se réorganisent autour. */
  cards: PanelCard[];
}

type PanelAction = { type: "ui"; event: UIEvent } | { type: "close"; key: string } | { type: "focus"; key: string } | { type: "clear" };

const MAX_CARDS = 4;

function cardFromEvent(e: UIEvent): PanelCard | null {
  switch (e.type) {
    case "show_messages":
      return { key: `messages:${e.title ?? ""}`, kind: "messages", ids: e.ids, title: e.title ?? "Messages" };
    case "focus_message":
      return { key: `message:${e.id}`, kind: "message", id: e.id };
    case "show_events":
      return { key: "events", kind: "events", ids: e.ids, title: e.title ?? "Agenda", date: e.date };
    case "focus_event":
      return { key: "events", kind: "events", ids: [e.id], title: "Rendez-vous" };
    case "show_slots":
      return { key: "slots", kind: "slots", slots: e.slots, title: e.title ?? "Créneaux" };
    case "show_tasks":
      return { key: "tasks", kind: "tasks", ids: e.ids, title: e.title ?? "Tâches" };
    case "show_actions":
      return { key: `actions:${e.title ?? ""}`, kind: "actions", ids: e.ids, title: e.title ?? "Actions" };
    case "focus_action":
      return { key: `action:${e.id}`, kind: "action", id: e.id };
    case "show_briefing":
      return { key: "briefing", kind: "briefing", id: e.id };
    case "show_rule_proposal":
      return { key: `rule:${e.id}`, kind: "rule", id: e.id };
    case "show_memory_proposal":
      return { key: `memory:${e.id}`, kind: "memory", id: e.id };
    default:
      return null;
  }
}

function panelReducer(state: PanelState, a: PanelAction): PanelState {
  switch (a.type) {
    case "clear":
      return { cards: [] };
    case "close":
      return { cards: state.cards.filter((c) => c.key !== a.key) };
    case "focus": {
      const card = state.cards.find((c) => c.key === a.key);
      return card ? { cards: [card, ...state.cards.filter((c) => c.key !== a.key)] } : state;
    }
    case "ui": {
      if (a.event.type === "clear_panel") return { cards: [] };
      const card = cardFromEvent(a.event);
      if (!card) return state;
      return { cards: [card, ...state.cards.filter((c) => c.key !== card.key)].slice(0, MAX_CARDS) };
    }
  }
}

interface Toast {
  id: number;
  text: string;
}

interface AppCtx {
  panel: PanelState;
  applyUi: (events: UIEvent[]) => void;
  closeCard: (key: string) => void;
  focusCard: (key: string) => void;
  clearPanel: () => void;
  navigate: (view: ViewId) => void;
  setNavigator: (fn: (view: ViewId) => void) => void;
  toast: (text: string) => void;
  toasts: Toast[];
}

const Ctx = createContext<AppCtx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [panel, dispatch] = useReducer(panelReducer, { cards: [] });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nav = useRef<(view: ViewId) => void>(() => undefined);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const applyUi = useCallback((events: UIEvent[]) => {
    // Les événements sont appliqués dans l'ordre inverse pour que le dernier « focus » devienne principal.
    for (const e of events) {
      if (e.type === "open_view") nav.current(e.view);
    }
    for (const e of [...events].reverse().filter((e) => e.type.startsWith("show_"))) dispatch({ type: "ui", event: e });
    for (const e of events.filter((e) => e.type.startsWith("focus_") || e.type === "clear_panel")) dispatch({ type: "ui", event: e });
  }, []);

  const value = useMemo<AppCtx>(
    () => ({
      panel,
      applyUi,
      closeCard: (key) => dispatch({ type: "close", key }),
      focusCard: (key) => dispatch({ type: "focus", key }),
      clearPanel: () => dispatch({ type: "clear" }),
      navigate: (view) => nav.current(view),
      setNavigator: (fn) => {
        nav.current = fn;
      },
      toast,
      toasts,
    }),
    [panel, applyUi, toast, toasts],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AppStateProvider manquant");
  return c;
}

// ---------------------------------------------------------------------------
// Temps réel : l'état affiché est toujours relu depuis le serveur
// ---------------------------------------------------------------------------

export function useRealtime(enabled: boolean) {
  const { toast, applyUi } = useApp();
  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      es = new EventSource("/api/stream");
      es.onmessage = (m) => {
        const ev = JSON.parse(m.data) as ServerEvent;
        switch (ev.type) {
          case "action.updated":
            void queryClient.invalidateQueries({ queryKey: ["action", ev.actionId] });
            void queryClient.invalidateQueries({ queryKey: ["actions"] });
            break;
          case "messages.changed":
            void queryClient.invalidateQueries({ queryKey: ["messages"] });
            break;
          case "events.changed":
            void queryClient.invalidateQueries({ queryKey: ["events"] });
            break;
          case "tasks.changed":
            void queryClient.invalidateQueries({ queryKey: ["tasks"] });
            break;
          case "connection.changed":
            void queryClient.invalidateQueries({ queryKey: ["connections"] });
            break;
          case "briefing.ready":
            void queryClient.invalidateQueries({ queryKey: ["briefing"] });
            break;
          case "usage.alert":
            toast(ev.message);
            void queryClient.invalidateQueries({ queryKey: ["usage"] });
            break;
          case "ui":
            applyUi([ev.event]);
            break;
        }
      };
      es.onerror = () => {
        es?.close();
        retry = setTimeout(connect, 4000);
      };
    };
    connect();
    return () => {
      es?.close();
      if (retry) clearTimeout(retry);
    };
  }, [enabled, toast, applyUi]);
}
