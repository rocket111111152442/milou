import { Bell, BellRing, ExternalLink, TrendingDown, PackageCheck, FileDiff, Newspaper, ServerCrash, ShieldCheck, CreditCard, CircleCheck } from "lucide-react";
import type * as React from "react";
import { formatRelative, type NotificationView } from "@watchly/types";
import { cn } from "../lib/cn";
import { Badge } from "../components/badge";
import { EmptyState } from "../components/feedback";

const typeIcon: Record<string, React.ReactNode> = {
  price: <TrendingDown />,
  stock: <PackageCheck />,
  page_change: <FileDiff />,
  keyword: <FileDiff />,
  web_topic: <Newspaper />,
  business_down: <ServerCrash />,
  business_recovered: <CircleCheck />,
  business_tls: <ShieldCheck />,
  business_scenario: <ServerCrash />,
  subscription: <CreditCard />,
  trial: <CreditCard />,
  system: <Bell />,
};

const priorityTone = {
  low: null,
  normal: null,
  high: <Badge tone="warning">Important</Badge>,
  critical: <Badge tone="danger">Prioritaire</Badge>,
} as const;

export function NotificationList({
  items,
  onMarkRead,
  now,
  renderOpenLink,
  compact = false,
}: {
  items: NotificationView[];
  onMarkRead?: (id: string) => void;
  now?: Date;
  renderOpenLink?: (n: NotificationView) => React.ReactNode;
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BellRing />}
        title="Aucune alerte"
        description="Lorsqu'une condition est remplie, l'alerte apparaît ici avec sa source et l'heure de détection."
      />
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
      {items.map((n) => (
        <li key={n.id} className={cn("flex gap-4 px-4 sm:px-5", compact ? "py-3" : "py-4", !n.readAt && "bg-info-soft/40")}>
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-white [&_svg]:size-4",
              n.type === "business_down" ? "text-danger" : n.type === "business_recovered" ? "text-success" : "text-ink-soft",
            )}
          >
            {typeIcon[n.type] ?? <Bell />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              {!n.readAt ? <span className="sr-only">Non lue :</span> : null}
              <p className="font-medium text-ink">{n.title}</p>
              {priorityTone[n.priority]}
            </div>
            {!compact ? <p className="text-sm leading-relaxed text-muted-fg">{n.body}</p> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-fg">
              {n.taskName ? <span>Surveillance : {n.taskName}</span> : null}
              <time dateTime={n.createdAt}>{formatRelative(n.createdAt, now)}</time>
              {n.sourceUrl ? (
                <a
                  href={n.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-blue hover:underline"
                >
                  Source <ExternalLink className="size-3" aria-hidden="true" />
                  <span className="sr-only">(nouvel onglet)</span>
                </a>
              ) : null}
              {renderOpenLink ? renderOpenLink(n) : null}
            </div>
          </div>
          {onMarkRead && !n.readAt ? (
            <button
              type="button"
              onClick={() => onMarkRead(n.id)}
              className="h-8 shrink-0 self-start rounded-full px-3 text-xs font-medium text-ink-soft hover:bg-surface"
            >
              Marquer comme lue
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
