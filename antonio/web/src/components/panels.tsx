import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MAIL_CATEGORIES, MAIL_CATEGORY_LABELS, type ActionDTO, type BriefingDTO, type BriefingItem, type EventDTO, type MailCategory, type MessageDetailDTO, type MessageDTO, type TaskDTO } from "@antonio/shared";
import { api, queryClient, uid } from "../lib/api";
import { fmtDateTime, fmtDay, fmtRelative, fmtTime } from "../lib/format";
import { useApp, type PanelCard } from "../lib/app-state";
import { ActionCard } from "./ActionCard";
import { Card, CategoryBadge, DemoBadge, Empty, Loading, StatusBadge } from "./ui";
import { Icon } from "./Icons";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function MessageRow({ m, onOpen, active }: { m: MessageDTO; onOpen: () => void; active?: boolean }) {
  return (
    <button className="list-item" onClick={onOpen} aria-current={active}>
      <div className="grow stack-8" style={{ minWidth: 0 }}>
        <div className="spread">
          <span className="ellipsis" style={{ fontWeight: m.unread ? 600 : 500 }}>
            {m.from.name ?? m.from.email}
          </span>
          <span className="tiny muted" style={{ flexShrink: 0 }}>
            {fmtRelative(m.receivedAt)}
          </span>
        </div>
        <div className="ellipsis small">{m.subject || "(sans objet)"}</div>
        <div className="row wrap">
          <CategoryBadge category={m.category} />
          {m.needsAction && <span className="badge wait">À traiter</span>}
          {m.hasAttachments && <Icon.Paperclip width={14} height={14} />}
          {m.inTrash && <span className="badge">Corbeille</span>}
          {m.simulated && <DemoBadge />}
        </div>
      </div>
    </button>
  );
}

function MessagesCard({ ids, title, compact, onClose }: { ids: string[]; title: string; compact?: boolean; onClose: () => void }) {
  const { applyUi } = useApp();
  const q = useQuery({ queryKey: ["messages", "ids", ids], queryFn: () => api<{ messages: MessageDTO[] }>(`/api/messages?ids=${ids.join(",")}`), enabled: ids.length > 0 });
  const list = q.data?.messages ?? [];
  return (
    <Card compact={compact} title={`${title} · ${ids.length}`} actions={<CloseBtn onClose={onClose} />}>
      {ids.length === 0 ? (
        <Empty>Aucun message.</Empty>
      ) : q.isLoading ? (
        <Loading />
      ) : (
        <div className="list">
          {(compact ? list.slice(0, 4) : list).map((m) => (
            <MessageRow key={m.id} m={m} onOpen={() => applyUi([{ type: "focus_message", id: m.id }])} />
          ))}
        </div>
      )}
    </Card>
  );
}

export function MessageDetail({ id, onClose, compact }: { id: string; onClose?: () => void; compact?: boolean }) {
  const { toast, applyUi } = useApp();
  const q = useQuery({ queryKey: ["messages", "detail", id], queryFn: () => api<{ message: MessageDetailDTO }>(`/api/messages/${id}`) });
  const act = useMutation({
    mutationFn: (v: { kind: string; extra?: Record<string, unknown> }) =>
      api<{ action: ActionDTO }>("/api/actions", { body: { kind: v.kind, params: { connectionId: q.data!.message.connectionId, messageId: id, ...(v.extra ?? {}) }, clientRequestId: uid() } }),
    onSuccess: (r) => {
      applyUi([{ type: "focus_action", id: r.action.id }]);
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (e: Error) => toast(e.message),
  });
  const recat = useMutation({
    mutationFn: (category: MailCategory) => api(`/api/messages/${id}/category`, { method: "PATCH", body: { category } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast("Catégorie corrigée pour ce message (aucune règle créée).");
    },
  });
  if (!q.data) return <Card compact={compact}>{q.isError ? <Empty>Message introuvable.</Empty> : <Loading />}</Card>;
  const m = q.data.message;
  if (compact) {
    return (
      <Card compact title={m.subject} actions={<CloseBtn onClose={onClose} />}>
        <div className="card-body small muted">{m.from.name ?? m.from.email}</div>
      </Card>
    );
  }
  const suspicious = m.categoryReason?.includes("manipulation");
  return (
    <Card
      title={
        <span className="row">
          {m.subject || "(sans objet)"} {m.simulated && <DemoBadge />}
        </span>
      }
      actions={<CloseBtn onClose={onClose} />}
    >
      <div className="card-body stack-12">
        <dl className="kv small">
          <dt>De</dt>
          <dd>
            {m.from.name ? `${m.from.name} ` : ""}&lt;{m.from.email}&gt;
          </dd>
          <dt>Reçu</dt>
          <dd>{fmtDateTime(m.receivedAt)}</dd>
          <dt>Classement</dt>
          <dd className="row wrap">
            <CategoryBadge category={m.category} />
            <span className="muted tiny">{m.categoryReason}</span>
            <select className="select" style={{ width: "auto", padding: "2px 8px", fontSize: 12 }} value={m.category} onChange={(e) => recat.mutate(e.target.value as MailCategory)} aria-label="Corriger la catégorie">
              {MAIL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {MAIL_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </dd>
        </dl>
        {suspicious && (
          <div className="danger-box">
            Ce message contient des instructions adressées à un assistant. Waverti ne les suit jamais : un e-mail ne peut ni donner de droits, ni changer un destinataire, ni créer une règle.
          </div>
        )}
        <div className="mail-body">{m.body}</div>
        {m.extracted && (m.extracted.requests.length > 0 || m.extracted.deadlines.length > 0) && (
          <div className="stack-8">
            <div className="section-title">Ce que j'en retiens</div>
            <ul className="checks">
              {m.extracted.requests.map((r, i) => (
                <li key={`r${i}`}>
                  <span className="muted">Demande</span> <span>{r.text}</span>
                </li>
              ))}
              {m.extracted.deadlines.map((d, i) => (
                <li key={`d${i}`}>
                  <span className="muted">Échéance</span>
                  <span>
                    {d.date ?? "?"} — {d.text} <span className="badge">{d.certainty === "certain" ? "écrit" : "déduit"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {m.thread.length > 1 && <p className="tiny muted">{m.thread.length} messages dans ce fil.</p>}
        <div className="row wrap">
          {!m.inTrash ? (
            <>
              <button className="btn small" onClick={() => act.mutate({ kind: "email.archive" })} disabled={act.isPending}>
                <Icon.Archive /> Archiver
              </button>
              <button className="btn small" onClick={() => act.mutate({ kind: "email.trash" })} disabled={act.isPending}>
                <Icon.Trash /> Corbeille
              </button>
            </>
          ) : (
            <button className="btn small" onClick={() => act.mutate({ kind: "email.untrash" })} disabled={act.isPending}>
              <Icon.Restore /> Restaurer
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export function DayTimeline({ events, slots, startHour = 8, endHour = 19 }: { events: EventDTO[]; slots?: { start: string; end: string }[]; startHour?: number; endHour?: number }) {
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const pos = (iso: string) => {
    const d = new Date(iso);
    return ((d.getHours() + d.getMinutes() / 60 - startHour) * 48);
  };
  return (
    <div className="timeline" style={{ height: (endHour - startHour) * 48 + 8 }}>
      {hours.map((h) => (
        <div className="hour" key={h} style={{ position: "absolute", top: (h - startHour) * 48, left: 0, right: 0 }}>
          <span>{String(h).padStart(2, "0")}:00</span>
        </div>
      ))}
      {events.map((e) => (
        <div key={e.id} className="ev" style={{ top: Math.max(0, pos(e.start)), height: Math.max(22, pos(e.end) - pos(e.start) - 2) }} title={e.title}>
          <strong>{fmtTime(e.start)}</strong> {e.title}
        </div>
      ))}
      {slots?.map((s, i) => (
        <div key={i} className="ev slot" style={{ top: Math.max(0, pos(s.start)), height: Math.max(22, pos(s.end) - pos(s.start) - 2) }}>
          Créneau libre {fmtTime(s.start)}
        </div>
      ))}
    </div>
  );
}

export function EventRow({ e }: { e: EventDTO }) {
  const pending = e.attendees.filter((a) => a.response === "needsAction").length;
  return (
    <div className="list-item" style={{ cursor: "default" }}>
      <div style={{ width: 64, flexShrink: 0 }} className="small">
        <strong>{fmtTime(e.start)}</strong>
        <div className="tiny muted">{fmtTime(e.end)}</div>
      </div>
      <div className="grow stack-8">
        <div className="row wrap">
          <span style={{ fontWeight: 500 }}>{e.title}</span>
          {e.recurring && <span className="badge">Récurrent</span>}
          {e.simulated && <DemoBadge />}
        </div>
        <div className="row wrap tiny muted">
          {e.location && <span>{e.location}</span>}
          {e.onlineMeetingUrl && (
            <span className="row">
              <Icon.Video width={14} height={14} /> Visio
            </span>
          )}
          {e.attendees.length > 0 && (
            <span>
              {e.attendees.length} participant(s){pending ? ` · ${pending} sans réponse` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EventsCard({ ids, title, compact, onClose }: { ids: string[]; title: string; compact?: boolean; onClose: () => void }) {
  const q = useQuery({ queryKey: ["events", "ids", ids], queryFn: () => api<{ events: EventDTO[] }>(`/api/events?ids=${ids.join(",")}`), enabled: ids.length > 0 });
  const evs = q.data?.events ?? [];
  const days = [...new Set(evs.map((e) => new Date(e.start).toDateString()))];
  return (
    <Card compact={compact} title={`${title} · ${ids.length}`} actions={<CloseBtn onClose={onClose} />}>
      {ids.length === 0 ? (
        <Empty>Aucun rendez-vous sur cette période.</Empty>
      ) : !q.data ? (
        <Loading />
      ) : compact ? (
        <div className="list">
          {evs.slice(0, 3).map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </div>
      ) : days.length === 1 ? (
        <div className="card-body">
          <p className="small muted" style={{ marginBottom: 10 }}>
            {fmtDay(evs[0].start)}
          </p>
          <DayTimeline events={evs} />
        </div>
      ) : (
        <div className="list">
          {evs.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </div>
      )}
    </Card>
  );
}

function SlotsCard({ slots, title, compact, onClose }: { slots: { start: string; end: string }[]; title: string; compact?: boolean; onClose: () => void }) {
  const day = slots[0] ? new Date(slots[0].start) : null;
  const from = day ? new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString() : null;
  const to = day ? new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString() : null;
  const sameDay = slots.every((s) => new Date(s.start).toDateString() === day?.toDateString());
  const q = useQuery({
    queryKey: ["events", "range", from, to],
    queryFn: () => api<{ events: EventDTO[] }>(`/api/events?from=${encodeURIComponent(from!)}&to=${encodeURIComponent(to!)}`),
    enabled: Boolean(from && sameDay && !compact),
  });
  return (
    <Card compact={compact} title={title} actions={<CloseBtn onClose={onClose} />}>
      {slots.length === 0 ? (
        <Empty>Aucun créneau libre trouvé.</Empty>
      ) : (
        <div className="card-body stack-12">
          <p className="small muted">Proposition calculée à partir de l'agenda et de vos horaires — rien n'est réservé.</p>
          <div className="chips">
            {slots.map((s, i) => (
              <span key={i} className="chip" aria-pressed="false">
                {fmtDateTime(s.start)} – {fmtTime(s.end)}
              </span>
            ))}
          </div>
          {sameDay && !compact && q.data && (
            <>
              <p className="small muted">{fmtDay(slots[0].start)}</p>
              <DayTimeline events={q.data.events} slots={slots} />
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tâches, actions, briefing, propositions
// ---------------------------------------------------------------------------

export function TaskRow({ t }: { t: TaskDTO }) {
  const { toast } = useApp();
  const done = useMutation({
    mutationFn: () => api(`/api/tasks/${t.id}/complete`, { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast(e.message),
  });
  return (
    <div className="list-item" style={{ cursor: "default" }}>
      <input type="checkbox" checked={t.status === "done"} disabled={t.status === "done" || done.isPending} onChange={() => done.mutate()} aria-label={`Terminer ${t.title}`} style={{ marginTop: 4 }} />
      <div className="grow">
        <div style={{ textDecoration: t.status === "done" ? "line-through" : undefined }}>{t.title}</div>
        <div className="tiny muted row wrap">
          {t.dueAt && <span>Échéance {fmtDateTime(t.dueAt)}</span>}
          <span>{t.createdBy === "rule" ? "Créée par une règle" : t.createdBy === "assistant" ? "Créée par l'assistant" : "Créée par vous"}</span>
        </div>
      </div>
    </div>
  );
}

function TasksCard({ ids, title, compact, onClose }: { ids: string[]; title: string; compact?: boolean; onClose: () => void }) {
  const q = useQuery({ queryKey: ["tasks", "ids", ids], queryFn: () => api<{ tasks: TaskDTO[] }>(`/api/tasks?ids=${ids.join(",")}`), enabled: ids.length > 0 });
  return (
    <Card compact={compact} title={`${title} · ${ids.length}`} actions={<CloseBtn onClose={onClose} />}>
      {ids.length === 0 ? <Empty>Aucune tâche.</Empty> : !q.data ? <Loading /> : <div className="list">{q.data.tasks.map((t) => <TaskRow key={t.id} t={t} />)}</div>}
    </Card>
  );
}

export function ActionRow({ a, onOpen }: { a: ActionDTO; onOpen: () => void }) {
  return (
    <button className="list-item" onClick={onOpen}>
      <div className="grow stack-8" style={{ minWidth: 0 }}>
        <div className="spread">
          <span className="ellipsis small" style={{ fontWeight: 500 }}>
            {a.summary}
          </span>
          <StatusBadge status={a.status} />
        </div>
        <div className="row wrap tiny muted">
          <span>{fmtRelative(a.createdAt)}</span>
          <span>{a.origin === "rule" ? `Règle « ${a.ruleName ?? ""} »` : a.origin === "voice" ? "Demande orale" : a.origin === "chat" ? "Demande écrite" : "Vous"}</span>
          {a.simulated && <DemoBadge />}
        </div>
      </div>
    </button>
  );
}

function ActionsCard({ ids, title, compact, onClose }: { ids: string[]; title: string; compact?: boolean; onClose: () => void }) {
  const { applyUi } = useApp();
  const q = useQuery({ queryKey: ["actions", "ids", ids], queryFn: () => api<{ actions: ActionDTO[] }>(`/api/actions?ids=${ids.join(",")}`), enabled: ids.length > 0 });
  return (
    <Card compact={compact} title={`${title} · ${ids.length}`} actions={<CloseBtn onClose={onClose} />}>
      {ids.length === 0 ? (
        <Empty>Rien à afficher.</Empty>
      ) : !q.data ? (
        <Loading />
      ) : (
        <div className="list">
          {q.data.actions.map((a) => (
            <ActionRow key={a.id} a={a} onOpen={() => applyUi([{ type: "focus_action", id: a.id }])} />
          ))}
        </div>
      )}
    </Card>
  );
}

const SECTION_TITLES: [keyof BriefingDTO["sections"], string, string][] = [
  ["importantMessages", "Messages importants", "Observé"],
  ["actionsDone", "Actions réellement accomplies", "Fait"],
  ["toValidate", "En attente de votre décision", "En attente"],
  ["agenda", "Rendez-vous et échéances", "Observé"],
  ["priorities", "Priorités proposées", "Recommandation"],
  ["errors", "Erreurs et connexions à rétablir", "À régler"],
];

export function BriefingView({ b, compact }: { b: BriefingDTO; compact?: boolean }) {
  const { applyUi, navigate } = useApp();
  const open = (item: BriefingItem) => {
    if (!item.source) return;
    if (item.source.type === "message") applyUi([{ type: "focus_message", id: item.source.id }]);
    else if (item.source.type === "action") applyUi([{ type: "focus_action", id: item.source.id }]);
    else if (item.source.type === "event") applyUi([{ type: "focus_event", id: item.source.id }]);
    else if (item.source.type === "connection") navigate("connections");
    else if (item.source.type === "task") navigate("tasks");
  };
  return (
    <div className="card-body stack-16 briefing-details">
      <p className="small muted">
        Période couverte : du {fmtDateTime(b.periodStart)} au {fmtDateTime(b.periodEnd)}
        {b.simulatedData && (
          <>
            {" "}
            · <DemoBadge /> données fictives incluses
          </>
        )}
      </p>
      {SECTION_TITLES.map(([key, label, kind]) => {
        const items = b.sections[key];
        if (!items.length || (compact && key !== "priorities" && key !== "toValidate")) return null;
        return (
          <div key={key} className="briefing-section" data-section={key}>
            <div className="section-title spread">
              <span>{label}</span>
              <span className="badge">{kind}</span>
            </div>
            <ul className="list">
              {items.map((it, i) => (
                <li key={i}>
                  {it.source ? (
                    <button className="list-item small" style={{ padding: "7px 0" }} onClick={() => open(it)}>
                      <span className="grow">{it.text}</span>
                      <span className="tiny muted">ouvrir</span>
                    </button>
                  ) : (
                    <div className="small" style={{ padding: "7px 0" }}>
                      {it.text}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function BriefingCard({ id, compact, onClose }: { id: string; compact?: boolean; onClose: () => void }) {
  const q = useQuery({ queryKey: ["briefing", id], queryFn: () => api<{ briefing: BriefingDTO }>(`/api/briefings/${id}`) });
  return (
    <Card compact={compact} title="Point du jour" actions={<CloseBtn onClose={onClose} />}>
      {q.data ? <BriefingView b={q.data.briefing} compact={compact} /> : <Loading />}
    </Card>
  );
}

interface RuleRow {
  id: string;
  name: string;
  status: string;
  scopeDescription: string;
  examplesAllowed: string[];
  examplesNeedApproval: string[];
  confirmedAt: string | null;
}

export function RuleProposal({ id, onClose }: { id: string; onClose?: () => void }) {
  const { toast } = useApp();
  const q = useQuery({ queryKey: ["rules", id], queryFn: () => api<{ rule: RuleRow }>(`/api/rules/${id}`) });
  const confirm = useMutation({
    mutationFn: () => api(`/api/rules/${id}/confirm`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
      toast("Règle activée.");
    },
  });
  const reject = useMutation({ mutationFn: () => api(`/api/rules/${id}`, { method: "PATCH", body: { status: "rejected" } }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rules"] }) });
  if (!q.data) return <Card>{<Loading />}</Card>;
  const r = q.data.rule;
  return (
    <Card title={`Règle proposée : ${r.name}`} actions={<CloseBtn onClose={onClose} />}>
      <div className="card-body stack-12">
        <p>{r.scopeDescription}</p>
        <div className="grid-2">
          <div>
            <div className="section-title">Sera fait automatiquement</div>
            <ul className="checks">{r.examplesAllowed.map((e, i) => <li key={i}><span className="ok">✓</span><span>{e}</span></li>)}</ul>
          </div>
          <div>
            <div className="section-title">Demandera votre validation</div>
            <ul className="checks">{r.examplesNeedApproval.map((e, i) => <li key={i}><span className="ko">!</span><span>{e}</span></li>)}</ul>
          </div>
        </div>
        {r.status === "proposed" ? (
          <div className="row">
            <button className="btn primary" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
              Confirmer et activer
            </button>
            <button className="btn ghost" onClick={() => reject.mutate()}>
              Ne pas créer
            </button>
          </div>
        ) : (
          <span className="badge accent">État : {r.status === "active" ? "active" : r.status}</span>
        )}
      </div>
    </Card>
  );
}

function MemoryProposal({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ["memories"], queryFn: () => api<{ memories: { id: string; content: string; status: string }[] }>("/api/memories") });
  const m = q.data?.memories.find((x) => x.id === id);
  const confirm = useMutation({ mutationFn: () => api(`/api/memories/${id}/confirm`, { method: "POST" }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["memories"] }) });
  const del = useMutation({ mutationFn: () => api(`/api/memories/${id}`, { method: "DELETE" }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["memories"] }); onClose(); } });
  return (
    <Card title="Préférence à retenir ?" actions={<CloseBtn onClose={onClose} />}>
      <div className="card-body stack-12">
        <p>{m?.content ?? "…"}</p>
        {m?.status === "proposed" ? (
          <div className="row">
            <button className="btn primary" onClick={() => confirm.mutate()}>
              Retenir
            </button>
            <button className="btn ghost" onClick={() => del.mutate()}>
              Ne pas retenir
            </button>
          </div>
        ) : (
          <span className="badge ok">Retenue — modifiable dans Profil</span>
        )}
      </div>
    </Card>
  );
}

function CloseBtn({ onClose }: { onClose?: () => void }) {
  if (!onClose) return null;
  return (
    <button className="btn ghost icon small" onClick={onClose} aria-label="Fermer ce panneau">
      <Icon.Close />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Panneau contextuel
// ---------------------------------------------------------------------------

function renderCard(c: PanelCard, compact: boolean, close: () => void) {
  switch (c.kind) {
    case "messages":
      return <MessagesCard ids={c.ids} title={c.title} compact={compact} onClose={close} />;
    case "message":
      return <MessageDetail id={c.id} compact={compact} onClose={close} />;
    case "events":
      return <EventsCard ids={c.ids} title={c.title} compact={compact} onClose={close} />;
    case "slots":
      return <SlotsCard slots={c.slots} title={c.title} compact={compact} onClose={close} />;
    case "tasks":
      return <TasksCard ids={c.ids} title={c.title} compact={compact} onClose={close} />;
    case "actions":
      return <ActionsCard ids={c.ids} title={c.title} compact={compact} onClose={close} />;
    case "action":
      return <ActionCard id={c.id} compact={compact} onClose={close} />;
    case "briefing":
      return <BriefingCard id={c.id} compact={compact} onClose={close} />;
    case "rule":
      return <RuleProposal id={c.id} onClose={close} />;
    case "memory":
      return <MemoryProposal id={c.id} onClose={close} />;
  }
}

export function ContextPanel() {
  const { panel, closeCard, focusCard } = useApp();
  const reduce = useReducedMotion();
  const [primary, ...rest] = panel.cards;
  const top = useRef<HTMLDivElement>(null);
  // Petit écran : le panneau est sous la conversation, on y amène l'élément devenu principal.
  useEffect(() => {
    if (primary && window.innerWidth < 960) top.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [primary?.key, reduce]);
  const t = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 380, damping: 34 };
  return (
    <div className="panel-grid" ref={top}>
      <AnimatePresence mode="popLayout" initial={false}>
        {primary && (
          <motion.div key={primary.key} layout layoutId={primary.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={t}>
            {renderCard(primary, false, () => closeCard(primary.key))}
          </motion.div>
        )}
      </AnimatePresence>
      {rest.length > 0 && (
        <div className="panel-secondary">
          <AnimatePresence initial={false}>
            {rest.map((c) => (
              <motion.div
                key={c.key}
                layout
                layoutId={c.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={t}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button, select, input, textarea, a")) return;
                  focusCard(c.key);
                }}
                style={{ cursor: "pointer" }}
                title="Afficher en principal"
              >
                {renderCard(c, true, () => closeCard(c.key))}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
