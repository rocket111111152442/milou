import type * as React from "react";
import { Globe, Search, Laptop, Cloud, ChevronRight } from "lucide-react";
import {
  formatInterval,
  formatRelative,
  type MonitorSummary,
  type ResultView,
} from "@waverti/types";
import { cn } from "../lib/cn";
import { Badge } from "../components/badge";
import { EmptyState } from "../components/feedback";
import { defaultRenderLink, type RenderLink } from "./link";

export function MonitorStatusBadge({ monitor }: { monitor: Pick<MonitorSummary, "status" | "lastStatus"> }) {
  if (monitor.status === "paused") return <Badge tone="neutral">En pause</Badge>;
  if (monitor.status === "paused_quota") return <Badge tone="warning">Suspendue (quota)</Badge>;
  if (monitor.status === "error" || monitor.lastStatus === "error") return <Badge tone="danger">Erreur</Badge>;
  if (monitor.lastStatus === "triggered") return <Badge tone="info">Alerte envoyée</Badge>;
  if (monitor.lastStatus === "skipped") return <Badge tone="warning">Contrôle suspendu</Badge>;
  if (monitor.lastStatus === "pending") return <Badge tone="outline">En attente</Badge>;
  return <Badge tone="success">Active</Badge>;
}

export function ExecutorLabel({ executor }: { executor: "agent" | "cloud" | null }) {
  if (!executor) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-fg [&_svg]:size-3.5">
      {executor === "agent" ? <Laptop aria-hidden="true" /> : <Cloud aria-hidden="true" />}
      {executor === "agent" ? "Sur votre ordinateur" : "Serveurs Waverti"}
    </span>
  );
}

/** Liseré coloré à gauche d'une surveillance : l'état se voit d'un coup d'œil (en plus du libellé, jamais seul). */
function statusStripe(m: Pick<MonitorSummary, "status" | "lastStatus">): string {
  const c =
    m.status === "paused"
      ? "before:bg-line-strong"
      : m.status === "error" || m.lastStatus === "error"
        ? "before:bg-danger"
        : m.status === "paused_quota" || m.lastStatus === "skipped"
          ? "before:bg-[#c26a00]"
          : m.lastStatus === "triggered"
            ? "before:bg-violet"
            : "before:bg-success";
  return cn("before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:content-['']", c);
}

export function MonitorList({
  monitors,
  hrefFor,
  renderLink = defaultRenderLink,
  emptyAction,
  now,
}: {
  monitors: MonitorSummary[];
  hrefFor: (m: MonitorSummary) => string;
  renderLink?: RenderLink;
  emptyAction?: React.ReactNode;
  now?: Date;
}) {
  if (monitors.length === 0) {
    return (
      <EmptyState
        icon={<Search />}
        title="Aucune surveillance pour l'instant"
        description="Indiquez une page à surveiller (prix, stock, modification) ou un sujet à rechercher sur Internet. Waverti s'occupe des vérifications."
        action={emptyAction}
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {monitors.map((m) => (
        <li key={m.id} className={cn("card-glass relative overflow-hidden rounded-2xl shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0", statusStripe(m))}>
          {renderLink({
            href: hrefFor(m),
            className:
              "group flex items-center gap-4 py-4 pl-5 pr-4 sm:pl-6 sm:pr-5 focus-visible:-outline-offset-2",
            children: (
              <>
                <span
                  aria-hidden="true"
                  className={cn("grid size-11 shrink-0 place-items-center rounded-2xl text-white [&_svg]:size-[18px]", m.kind === "page" ? "bg-[linear-gradient(135deg,#1d3fd6,#3b6bff)]" : "bg-[linear-gradient(135deg,#5a2de0,#8a3bff)]")}
                >
                  {m.kind === "page" ? <Globe /> : <Search />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-ink">{m.name}</span>
                    <MonitorStatusBadge monitor={m} />
                  </span>
                  <span className="truncate text-sm text-ink-soft">
                    {m.conditionLabel} · {m.targetLabel}
                  </span>
                </span>
                <span className="hidden flex-col items-end gap-1 text-right sm:flex">
                  {m.lastValue ? <span className="rounded-full bg-tint-blue px-2.5 py-0.5 font-display font-semibold tabular-nums text-[#1d3fd6]">{m.lastValue}</span> : null}
                  <span className="text-xs text-muted-fg">
                    {m.lastCheckedAt ? `Vérifiée ${formatRelative(m.lastCheckedAt, now)}` : "Pas encore vérifiée"} · {formatInterval(m.intervalMinutes)}
                  </span>
                  <ExecutorLabel executor={m.lastExecutor} />
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
              </>
            ),
          })}
        </li>
      ))}
    </ul>
  );
}

const outcomeStyle: Record<ResultView["outcome"], { label: string; dot: string }> = {
  ok: { label: "Aucun changement", dot: "bg-line-strong" },
  changed: { label: "Changement détecté", dot: "bg-blue" },
  triggered: { label: "Condition remplie", dot: "bg-violet" },
  error: { label: "Erreur", dot: "bg-danger" },
};

export function ResultTimeline({ results, now, emptyLabel = "Aucun contrôle effectué pour l'instant." }: {
  results: ResultView[];
  now?: Date;
  emptyLabel?: string;
}) {
  if (results.length === 0) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted-fg">{emptyLabel}</p>;
  }
  return (
    <ol className="relative flex flex-col">
      {results.map((r, i) => {
        const s = outcomeStyle[r.outcome];
        return (
          <li key={r.id} className="relative flex gap-4 pb-5 last:pb-0">
            {i < results.length - 1 ? (
              <span aria-hidden="true" className="absolute left-[5px] top-4 h-full w-px bg-line" />
            ) : null}
            <span aria-hidden="true" className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-white", s.dot)} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium text-ink">{s.label}</span>
                <time dateTime={r.checkedAt} className="text-xs text-muted-fg">
                  {formatRelative(r.checkedAt, now)}
                </time>
              </div>
              <p className="text-sm text-muted-fg">{r.summary}</p>
              <div className="flex flex-wrap items-center gap-3">
                {r.value ? <span className="text-sm font-semibold tabular-nums">{r.value}</span> : null}
                <ExecutorLabel executor={r.executedBy} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
