import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { Badge, Button, Callout, Card, CardContent, CardHeader, CardTitle, LineChart, PageHeader, Stat, UptimeBars } from "@watchly/ui";
import { IncidentList, SiteStateIndicator } from "@watchly/ui/app";
import { isUuid } from "@watchly/database";
import { formatDateTime, formatPercent, formatRelative } from "@watchly/types";
import { requireUser } from "@/lib/auth";
import { loadEntitlements } from "@/lib/data/account";
import { getSiteDetail, listIncidents } from "@/lib/data/business";
import { NextLink } from "@/components/app/next-link";
import { EndpointsPanel, ScenariosPanel, SiteActions, VerificationPanel } from "./site-panels";

export const metadata: Metadata = { title: "Site professionnel" };

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/app/business/sites/${id}`);
  if (!isUuid(id)) notFound();
  const [d, ent, incidents] = await Promise.all([getSiteDetail(user.id, id), loadEntitlements(user.id), listIncidents(user.id, { siteId: id, limit: 20 })]);
  if (!d) notFound();
  const { site } = d;
  const verified = site.status === "verified";
  const states = d.endpoints.filter((e) => e.enabled).map((e) => e.state);
  const state = states.includes("down") ? "down" : states.includes("degraded") ? "degraded" : states.length && states.every((s) => s === "up") ? "up" : "unknown";
  const avg = d.responseSeries.filter((p) => p.v !== null);
  const avgMs = avg.length ? Math.round(avg.reduce((a, p) => a + (p.v ?? 0), 0) / avg.length) : null;

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-fg">
        <Link href="/app/business" className="hover:text-ink">
          Business
        </Link>{" "}
        / <span aria-current="page">{site.name}</span>
      </nav>
      <PageHeader
        title={site.name}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span>{site.domain}</span>
            {verified ? <SiteStateIndicator state={state} /> : <Badge tone="warning">Vérification requise</Badge>}
          </span>
        }
        actions={<SiteActions siteId={site.id} name={site.name} />}
      />

      {!verified ? (
        <VerificationPanel
          siteId={site.id}
          domain={site.domain}
          instructions={d.instructions}
          attempts={d.attempts.map((a) => ({ at: a.attemptedAt.toISOString(), method: a.method, success: a.success, detail: a.detail }))}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5">
              <Stat label="Disponibilité (30 jours)" value={formatPercent(d.uptime30d)} hint={d.uptime30d === null ? "Pas encore de mesure" : "Contrôles réussis / effectués"} />
            </Card>
            <Card className="p-5">
              <Stat label="Temps de réponse (24 h)" value={avgMs === null ? "—" : `${avgMs} ms`} hint="Moyenne des contrôles réussis" />
            </Card>
            <Card className="p-5">
              <Stat label="Incidents en cours" value={String(incidents.filter((i) => i.status === "open").length)} />
            </Card>
            <Card className="p-5">
              <Stat
                label="Certificat HTTPS"
                value={site.tlsError ? "Problème" : site.tlsValidTo ? `jusqu'au ${formatDateTime(site.tlsValidTo).split(" à")[0]}` : "—"}
                hint={site.tlsError ?? (site.tlsCheckedAt ? `Vérifié ${formatRelative(site.tlsCheckedAt.toISOString())}` : ent.businessTlsChecks ? "Première vérification en attente" : "Non inclus")}
              />
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Disponibilité sur 30 jours</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <UptimeBars days={d.uptimeDays} />
              {d.responseSeries.length ? (
                <LineChart points={d.responseSeries} unit=" ms" label="Temps de réponse sur 24 heures" />
              ) : (
                <p className="text-sm text-muted-fg">Les temps de réponse apparaîtront après les premiers contrôles.</p>
              )}
            </CardContent>
          </Card>

          <EndpointsPanel
            siteId={site.id}
            domain={site.domain}
            limit={ent.businessEndpointsPerSite}
            intervalSeconds={ent.businessHttpIntervalSeconds}
            endpoints={d.endpoints.map((e) => ({
              id: e.id,
              name: e.name,
              url: e.url,
              method: e.method,
              enabled: e.enabled,
              state: e.state,
              lastCheckedAt: e.lastCheckedAt?.toISOString() ?? null,
              lastResponseMs: e.lastResponseMs,
              lastStatusCode: e.lastStatusCode,
              lastError: e.lastError,
              expectedKeyword: e.expectedKeyword,
            }))}
          />

          <ScenariosPanel
            siteId={site.id}
            domain={site.domain}
            limit={ent.businessScenariosPerSite}
            scenarios={d.scenarios.map((s) => ({
              id: s.id,
              name: s.name,
              startUrl: s.startUrl,
              steps: s.steps.length,
              enabled: s.enabled,
              lastStatus: s.lastStatus,
              lastRunAt: s.lastRunAt?.toISOString() ?? null,
              lastError: s.lastError,
              nextRunAt: s.nextRunAt.toISOString(),
            }))}
          />

          <section className="flex flex-col gap-3" aria-labelledby="site-incidents">
            <h2 id="site-incidents" className="font-display text-lg font-bold">
              Incidents
            </h2>
            <Card className="p-2">
              <IncidentList incidents={incidents} hrefFor={(i) => `/app/business/incidents/${i.id}`} renderLink={NextLink} />
            </Card>
          </section>

          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Rapports</p>
              <p className="text-sm text-muted-fg">Statistiques quotidiennes réelles par point de contrôle, sans extrapolation.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/business/sites/${site.id}/rapport`}>
                  <FileText aria-hidden="true" /> Rapport mensuel
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <a href={`/api/business/sites/${site.id}/report?jours=30`}>
                  <Download aria-hidden="true" /> Export CSV (30 jours)
                </a>
              </Button>
            </div>
          </Card>
          {!ent.businessSites ? (
            <Callout tone="warning">Votre formule actuelle n'inclut plus Business : les contrôles de ce site sont suspendus.</Callout>
          ) : null}
        </>
      )}
    </div>
  );
}
