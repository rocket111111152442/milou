import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ACTION_STATUS_LABELS, MAIL_CATEGORIES, MAIL_CATEGORY_LABELS, type ActionDTO, type ActionStatus, type BriefingDTO, type EventDTO, type MailCategory, type MessageDTO, type TaskDTO } from "@antonio/shared";
import { api, queryClient } from "../lib/api";
import { fmtDay } from "../lib/format";
import { useApp } from "../lib/app-state";
import { ActionCard } from "../components/ActionCard";
import { ActionRow, BriefingView, DayTimeline, EventRow, MessageDetail, MessageRow, TaskRow } from "../components/panels";
import { Card, Empty, Loading, PageHead, Seg } from "../components/ui";

export function BriefingPage() {
  const { toast } = useApp();
  const q = useQuery({ queryKey: ["briefing", "latest"], queryFn: () => api<{ briefing: BriefingDTO | null }>("/api/briefings/latest") });
  const gen = useMutation({
    mutationFn: () => api<{ briefing: BriefingDTO }>("/api/briefings", { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["briefing"] }),
    onError: (e: Error) => toast(e.message),
  });
  const b = q.data?.briefing;
  return (
    <div className="page stack-16">
      <PageHead
        title="Point du jour"
        subtitle="L’essentiel de votre journée."
        actions={
          <button className="btn primary" onClick={() => gen.mutate()} disabled={gen.isPending}>
            Faire le point maintenant
          </button>
        }
      />
      {q.isLoading ? (
        <Loading />
      ) : !b ? (
        <Card>
          <Empty>Aucun point préparé pour l'instant.</Empty>
        </Card>
      ) : (
        <>
          <Card title="À l'oral">
            <div className="card-body">
              <p>{b.spoken}</p>
            </div>
          </Card>
          <Card title="Détail">
            <BriefingView b={b} />
          </Card>
        </>
      )}
    </div>
  );
}

export function InboxPage() {
  const [filter, setFilter] = useState<"to_handle" | "all" | "trash" | "sent" | MailCategory>("to_handle");
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const params = new URLSearchParams();
  if (filter === "to_handle") params.set("needsAction", "true");
  else if (filter === "trash") params.set("trash", "true");
  else if (filter === "sent") params.set("sent", "true");
  else if (filter !== "all") params.set("category", filter);
  if (text) params.set("text", text);
  const q = useQuery({ queryKey: ["messages", "inbox", params.toString()], queryFn: () => api<{ messages: MessageDTO[] }>(`/api/messages?${params}`) });
  return (
    <div className="page stack-16">
      <PageHead title="Boîte de réception" subtitle="Vos e-mails, au même endroit." />
      <div className="row wrap">
        <select className="select" style={{ width: "auto" }} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filtre">
          <option value="to_handle">À traiter</option>
          <option value="all">Tous</option>
          {MAIL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {MAIL_CATEGORY_LABELS[c]}
            </option>
          ))}
          <option value="sent">Envoyés</option>
          <option value="trash">Corbeille</option>
        </select>
        <input className="input grow" style={{ maxWidth: 360 }} placeholder="Rechercher (objet, expéditeur, extrait)" value={text} onChange={(e) => setText(e.target.value)} aria-label="Rechercher" />
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <Card>
          {q.isLoading ? (
            <Loading />
          ) : q.data!.messages.length === 0 ? (
            <Empty>Aucun message.</Empty>
          ) : (
            <div className="list">
              {q.data!.messages.map((m) => (
                <MessageRow key={m.id} m={m} active={open === m.id} onOpen={() => setOpen(m.id)} />
              ))}
            </div>
          )}
        </Card>
        {open ? <MessageDetail id={open} onClose={() => setOpen(null)} /> : <Card><Empty>Sélectionnez un message.</Empty></Card>}
      </div>
    </div>
  );
}

export function AgendaPage() {
  const [range, setRange] = useState<"day" | "week">("week");
  const [offset, setOffset] = useState(0);
  const { from, to } = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (range === "week") {
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow + offset * 7);
      const end = new Date(d);
      end.setDate(end.getDate() + 7);
      return { from: d, to: end };
    }
    d.setDate(d.getDate() + offset);
    const end = new Date(d);
    end.setDate(end.getDate() + 1);
    return { from: d, to: end };
  }, [range, offset]);
  const q = useQuery({ queryKey: ["events", "range", from.toISOString(), to.toISOString()], queryFn: () => api<{ events: EventDTO[] }>(`/api/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`) });
  const byDay = useMemo(() => {
    const m = new Map<string, EventDTO[]>();
    for (const e of q.data?.events ?? []) {
      const k = new Date(e.start).toDateString();
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [q.data]);
  return (
    <div className="page stack-16">
      <PageHead
        title="Agenda"
        subtitle="Vos rendez-vous et disponibilités."
        actions={
          <>
            <Seg label="Période" value={range} onChange={(v) => { setRange(v); setOffset(0); }} options={[{ value: "day", label: "Jour" }, { value: "week", label: "Semaine" }]} />
            <button className="btn small" onClick={() => setOffset((o) => o - 1)} aria-label="Précédent">‹</button>
            <button className="btn small" onClick={() => setOffset(0)}>Aujourd'hui</button>
            <button className="btn small" onClick={() => setOffset((o) => o + 1)} aria-label="Suivant">›</button>
          </>
        }
      />
      {q.isLoading ? (
        <Loading />
      ) : range === "day" ? (
        <Card title={fmtDay(from.toISOString())}>
          <div className="card-body">
            <DayTimeline events={q.data!.events} />
          </div>
        </Card>
      ) : byDay.size === 0 ? (
        <Card>
          <Empty>Aucun rendez-vous cette semaine.</Empty>
        </Card>
      ) : (
        [...byDay.entries()].map(([k, evs]) => (
          <Card key={k} title={fmtDay(evs[0].start)}>
            <div className="list">{evs.map((e) => <EventRow key={e.id} e={e} />)}</div>
          </Card>
        ))
      )}
    </div>
  );
}

export function TasksPage() {
  const { toast } = useApp();
  const [title, setTitle] = useState("");
  const q = useQuery({ queryKey: ["tasks", "all"], queryFn: () => api<{ tasks: TaskDTO[] }>("/api/tasks") });
  const add = useMutation({
    mutationFn: () => api("/api/tasks", { body: { title } }),
    onSuccess: () => {
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast(e.message),
  });
  return (
    <div className="page stack-16">
      <PageHead
        title="Tâches"
        subtitle="Ce qu’il vous reste à faire."
        actions={<a className="btn" href="/api/tasks/export.csv">Exporter (CSV)</a>}
      />
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (title.trim()) add.mutate(); }}>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle tâche" aria-label="Nouvelle tâche" />
        <button className="btn primary" type="submit">Ajouter</button>
      </form>
      <Card>{q.isLoading ? <Loading /> : q.data!.tasks.length === 0 ? <Empty>Aucune tâche.</Empty> : <div className="list">{q.data!.tasks.map((t) => <TaskRow key={t.id} t={t} />)}</div>}</Card>
      <p className="tiny muted">Export à importer dans votre autre outil.</p>
    </div>
  );
}

export function ApprovalsPage() {
  const q = useQuery({ queryKey: ["actions", "awaiting"], queryFn: () => api<{ actions: ActionDTO[] }>("/api/actions?status=awaiting_approval,uncertain") });
  return (
    <div className="page stack-16">
      <PageHead title="Validations" subtitle="Vérifiez chaque action avant de l’autoriser." />
      {q.isLoading ? <Loading /> : q.data!.actions.length === 0 ? <Card><Empty>Rien n'attend votre validation.</Empty></Card> : q.data!.actions.map((a) => <ActionCard key={a.id} id={a.id} />)}
    </div>
  );
}

export function HistoryPage() {
  const [status, setStatus] = useState<"" | ActionStatus>("");
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["actions", "history", status], queryFn: () => api<{ actions: ActionDTO[] }>(`/api/actions?days=90${status ? `&status=${status}` : ""}`) });
  return (
    <div className="page stack-16">
      <PageHead
        title="Historique des actions"
        subtitle="Les actions de votre assistant, en un coup d’œil."
        actions={
          <select className="select" style={{ width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value as ActionStatus | "")} aria-label="Filtrer par état">
            <option value="">Tous les états</option>
            {(Object.keys(ACTION_STATUS_LABELS) as ActionStatus[]).map((s) => <option key={s} value={s}>{ACTION_STATUS_LABELS[s]}</option>)}
          </select>
        }
      />
      <div className="grid-2" style={{ alignItems: "start" }}>
        <Card>{q.isLoading ? <Loading /> : q.data!.actions.length === 0 ? <Empty>Aucune action.</Empty> : <div className="list">{q.data!.actions.map((a) => <ActionRow key={a.id} a={a} onOpen={() => setOpen(a.id)} />)}</div>}</Card>
        {open ? <ActionCard id={open} onClose={() => setOpen(null)} /> : <Card><Empty>Sélectionnez une action pour voir son détail.</Empty></Card>}
      </div>
    </div>
  );
}
