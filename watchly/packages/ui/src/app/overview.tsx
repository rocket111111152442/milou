import type * as React from "react";
import { Activity, Bell, Clock, Laptop, Cloud, Plus } from "lucide-react";
import { formatDateTime, formatRelative, type DeviceView, type OverviewData } from "@watchly/types";
import { Badge } from "../components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/card";
import { Progress, Stat, StatusDot } from "../components/feedback";
import { NotificationList } from "./notifications";
import { ResultTimeline } from "./monitors";
import { defaultRenderLink, type RenderLink } from "./link";

export function DeviceStatusList({ devices, cloudRelay, now }: { devices: DeviceView[]; cloudRelay: boolean; now?: Date }) {
  const online = devices.filter((d) => d.online);
  return (
    <div className="flex flex-col gap-3">
      {devices.length === 0 ? (
        <p className="text-sm text-muted-fg">
          Aucun ordinateur connecté. {cloudRelay ? "Vos contrôles compatibles sont effectués par les serveurs Watchly." : "Installez l'application pour activer vos surveillances locales."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
              <span className="flex items-center gap-2.5 text-sm">
                <Laptop className="size-4 text-muted" aria-hidden="true" />
                <span className="font-medium">{d.name}</span>
              </span>
              <StatusDot
                tone={d.online ? (d.monitoringEnabled ? "up" : "degraded") : "unknown"}
                pulse={d.online && d.monitoringEnabled}
                label={d.online ? (d.monitoringEnabled ? "Actif" : "Surveillance désactivée") : `Hors ligne · ${formatRelative(d.lastSeenAt, now)}`}
                className="text-xs text-muted-fg"
              />
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-fg">
        <Cloud className="size-3.5" aria-hidden="true" />
        {cloudRelay
          ? online.length
            ? "Relais cloud prêt si votre ordinateur devient indisponible."
            : "Relais cloud actif : les serveurs Watchly prennent le relais."
          : "Aucun abonnement actif : vos surveillances sont en pause."}
      </p>
    </div>
  );
}

export function OverviewView({
  data,
  renderLink = defaultRenderLink,
  newMonitorHref = "/app/surveillances/nouvelle",
  alertsHref = "/app/alertes",
  subscriptionHref = "/app/abonnement",
  monitorHref = (id: string) => `/app/surveillances/${id}`,
  now,
  cloudRelay,
}: {
  data: OverviewData;
  renderLink?: RenderLink;
  newMonitorHref?: string;
  alertsHref?: string;
  subscriptionHref?: string;
  monitorHref?: (id: string) => string;
  now?: Date;
  cloudRelay: boolean;
}) {
  const sub = data.subscription;
  const link = (href: string, children: React.ReactNode, className = "text-sm font-medium text-blue hover:underline") =>
    renderLink({ href, className, children });
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Surveillances actives" value={data.activeMonitors} icon={<Activity />} />
        <Stat label="Alertes (7 jours)" value={data.alertsLast7Days} icon={<Bell />} />
        <Stat
          label="Prochaine vérification"
          value={<span className="text-xl">{data.upcoming[0]?.nextRunAt ? formatRelative(data.upcoming[0].nextRunAt, now) : "—"}</span>}
          hint={data.upcoming[0]?.name}
          icon={<Clock />}
        />
        <Stat
          label="Formule"
          value={<span className="text-xl">{sub.planName}</span>}
          hint={
            sub.isTrial && sub.trialEndsAt
              ? `Essai jusqu'au ${formatDateTime(sub.trialEndsAt)}`
              : sub.cancelAtPeriodEnd && sub.currentPeriodEnd
                ? `Se termine le ${formatDateTime(sub.currentPeriodEnd)}`
                : sub.status === "past_due"
                  ? "Paiement en attente"
                  : undefined
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle as="h2">Alertes récentes</CardTitle>
            {link(alertsHref, "Tout voir")}
          </CardHeader>
          <CardContent>
            <NotificationList items={data.recentAlerts} compact now={now} />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">État de votre ordinateur</CardTitle>
            </CardHeader>
            <CardContent>
              <DeviceStatusList devices={data.devices} cloudRelay={cloudRelay} now={now} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle as="h2">Quotas</CardTitle>
              {link(subscriptionHref, "Gérer")}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {data.quotas.map((q) => (
                <Progress key={q.key} label={q.label} value={q.used} max={q.limit} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle as="h2">Derniers résultats</CardTitle>
          </CardHeader>
          <CardContent>
            <ResultTimeline
              now={now}
              results={data.latestResults.map((r) => ({ ...r, summary: `${r.monitorName} — ${r.summary}` }))}
              emptyLabel="Les résultats de vos premiers contrôles apparaîtront ici."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle as="h2">Prochaines vérifications</CardTitle>
            {link(newMonitorHref, (
              <span className="inline-flex items-center gap-1">
                <Plus className="size-4" aria-hidden="true" /> Nouvelle
              </span>
            ))}
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-muted-fg">Aucune vérification planifiée.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {data.upcoming.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    {link(monitorHref(u.id), u.name, "truncate font-medium text-ink hover:text-blue")}
                    <Badge tone="outline">{formatRelative(u.nextRunAt, now)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
