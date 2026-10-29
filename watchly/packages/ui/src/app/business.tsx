import type * as React from "react";
import { Building2, ShieldCheck, ServerCrash, CircleCheck } from "lucide-react";
import {
  formatDateTime,
  formatDuration,
  formatPercent,
  formatRelative,
  type IncidentView,
  type SiteSummary,
} from "@watchly/types";
import { Badge } from "../components/badge";
import { EmptyState, StatusDot } from "../components/feedback";
import { defaultRenderLink, type RenderLink } from "./link";

const stateLabel = {
  up: "Opérationnel",
  down: "Panne",
  degraded: "Dégradé",
  unknown: "Pas encore vérifié",
} as const;

export function SiteStateIndicator({ state }: { state: SiteSummary["state"] }) {
  return <StatusDot tone={state} pulse={state === "up" || state === "down"} label={stateLabel[state]} />;
}

export function SiteList({
  sites,
  hrefFor,
  renderLink = defaultRenderLink,
  emptyAction,
}: {
  sites: SiteSummary[];
  hrefFor: (s: SiteSummary) => string;
  renderLink?: RenderLink;
  emptyAction?: React.ReactNode;
}) {
  if (sites.length === 0) {
    return (
      <EmptyState
        icon={<Building2 />}
        title="Aucun site professionnel"
        description="Ajoutez votre site, prouvez que vous en êtes responsable (DNS ou fichier), puis choisissez les pages à contrôler chaque minute."
        action={emptyAction}
      />
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {sites.map((s) => (
        <li key={s.id}>
          {renderLink({
            href: hrefFor(s),
            className:
              "flex h-full flex-col gap-4 rounded-xl border border-line bg-white p-5 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-lift",
            children: (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold">{s.name}</p>
                    <p className="truncate text-sm text-muted-fg">{s.domain}</p>
                  </div>
                  {s.status === "verified" ? (
                    <SiteStateIndicator state={s.state} />
                  ) : s.status === "pending_verification" ? (
                    <Badge tone="warning">Vérification requise</Badge>
                  ) : (
                    <Badge tone="danger">Suspendu</Badge>
                  )}
                </div>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-fg">Disponibilité 30 j</dt>
                    <dd className="font-semibold tabular-nums">{formatPercent(s.uptime30d)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-fg">Réponse moy.</dt>
                    <dd className="font-semibold tabular-nums">{s.avgResponseMs === null ? "—" : `${s.avgResponseMs} ms`}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-fg">Incidents ouverts</dt>
                    <dd className="font-semibold tabular-nums">{s.openIncidents}</dd>
                  </div>
                </dl>
                {s.tlsValidTo ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-fg">
                    <ShieldCheck className="size-3.5" aria-hidden="true" /> Certificat valide jusqu'au {formatDateTime(s.tlsValidTo)}
                  </p>
                ) : null}
              </>
            ),
          })}
        </li>
      ))}
    </ul>
  );
}

export function IncidentList({
  incidents,
  hrefFor,
  renderLink = defaultRenderLink,
  now,
}: {
  incidents: IncidentView[];
  hrefFor: (i: IncidentView) => string;
  renderLink?: RenderLink;
  now?: Date;
}) {
  if (incidents.length === 0) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted-fg">Aucun incident enregistré.</p>;
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
      {incidents.map((i) => (
        <li key={i.id}>
          {renderLink({
            href: hrefFor(i),
            className: "flex items-center gap-4 px-4 py-3.5 hover:bg-surface/70 sm:px-5",
            children: (
              <>
                <span aria-hidden="true" className={i.status === "open" ? "text-danger" : "text-success"}>
                  {i.status === "open" ? <ServerCrash className="size-5" /> : <CircleCheck className="size-5" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{i.title}</span>
                  <span className="text-xs text-muted-fg">
                    {i.siteName} · début {formatRelative(i.startedAt, now)}
                    {i.status === "resolved" ? ` · durée ${formatDuration(i.durationSeconds)}` : ""}
                  </span>
                </span>
                <Badge tone={i.status === "open" ? "danger" : "success"}>{i.status === "open" ? "En cours" : "Résolu"}</Badge>
              </>
            ),
          })}
        </li>
      ))}
    </ul>
  );
}
