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
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
      {monitors.map((m) => (
        <li key={m.id}>
          {renderLink({
            href: hrefFor(m),
            className:
              "group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface/70 sm:px-5 focus-visible:-outline-offset-2",
            children: (
              <>
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-soft [&_svg]:size-[18px]"
                >
                  {m.kind === "page" ? <Globe /> : <Search />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-ink">{m.name}</span>
                    <MonitorStatusBadge monitor={m} />
                  </span>
                  <span className="truncate text-sm text-muted-fg">
                    {m.conditionLabel} · {m.targetLabel}
                  </span>
                </span>
                <span className="hidden flex-col items-end gap-1 text-right sm:flex">
                  {m.lastValue ? <span className="font-display font-semibold tabular-nums">{m.lastValue}</span> : null}
                  <span className="text-xs text-muted-fg">
                    Vérifiée {formatRelative(m.lastCheckedAt, now)} · {formatInterval(m.intervalMinutes)}
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
