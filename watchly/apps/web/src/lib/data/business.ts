import "server-only";
import {
  and,
  asc,
  browserTestRuns,
  browserTestScenarios,
  businessEndpoints,
  businessSites,
  desc,
  eq,
  incidentEvents,
  incidents,
  siteVerifications,
  sql,
  withUser,
} from "@watchly/database";
import { verificationInstructions } from "@watchly/monitoring/business";
import type { IncidentView, SiteSummary, UptimeDayView } from "@watchly/types";
import { getDb } from "../db";

const STATE_RANK = { down: 3, degraded: 2, up: 1, unknown: 0 } as const;
type EpState = keyof typeof STATE_RANK;

function worstState(states: EpState[]): EpState {
  return states.reduce<EpState>((w, s) => (STATE_RANK[s] > STATE_RANK[w] ? s : w), states.length ? "up" : "unknown");
}

/** Disponibilité = contrôles réussis / contrôles effectués (hors re-vérifications), null sans mesure. */
function ratio(checks: number, failures: number): number | null {
  return checks > 0 ? (checks - failures) / checks : null;
}

export async function listSites(userId: string): Promise<SiteSummary[]> {
  return withUser(getDb(), userId, async (tx) => {
    const sites = await tx.select().from(businessSites).orderBy(asc(businessSites.createdAt));
    if (!sites.length) return [];
    const eps = await tx.select({ siteId: businessEndpoints.siteId, state: businessEndpoints.state, enabled: businessEndpoints.enabled }).from(businessEndpoints);
    const stats = await tx.execute<{ site_id: string; checks: number; failures: number; avg_ms: number | null }>(sql`
      select site_id, sum(checks)::int as checks, sum(failures)::int as failures,
        round(sum(avg_response_ms::bigint * (checks - failures))::numeric / nullif(sum(checks - failures) filter (where avg_response_ms is not null), 0))::int as avg_ms
      from business_daily_stats where day >= current_date - 29 group by site_id`);
    const open = await tx.execute<{ site_id: string; n: number }>(sql`select site_id, count(*)::int as n from incidents where status = 'open' group by site_id`);
    const statBy = new Map(stats.map((s) => [s.site_id, s]));
    const openBy = new Map(open.map((o) => [o.site_id, o.n]));
    return sites.map((s) => {
      const st = statBy.get(s.id);
      return {
        id: s.id,
        name: s.name,
        domain: s.domain,
        status: s.status,
        state: worstState(eps.filter((e) => e.siteId === s.id && e.enabled).map((e) => e.state)),
        uptime30d: st ? ratio(st.checks, st.failures) : null,
        openIncidents: openBy.get(s.id) ?? 0,
        avgResponseMs: st?.avg_ms ?? null,
        tlsValidTo: s.tlsValidTo?.toISOString() ?? null,
      };
    });
  });
}

function toIncidentView(i: typeof incidents.$inferSelect, siteName: string): IncidentView {
  return {
    id: i.id,
    siteName,
    title: i.title,
    kind: i.kind,
    status: i.status,
    startedAt: i.startedAt.toISOString(),
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
    durationSeconds: i.resolvedAt ? Math.round((i.resolvedAt.getTime() - i.startedAt.getTime()) / 1000) : null,
    cause: i.cause,
  };
}

export async function listIncidents(userId: string, opts: { siteId?: string; limit?: number } = {}): Promise<IncidentView[]> {
  return withUser(getDb(), userId, async (tx) => {
    const rows = await tx
      .select({ i: incidents, siteName: businessSites.name })
      .from(incidents)
      .innerJoin(businessSites, eq(businessSites.id, incidents.siteId))
      .where(opts.siteId ? eq(incidents.siteId, opts.siteId) : undefined)
      .orderBy(desc(incidents.startedAt))
      .limit(opts.limit ?? 50);
    return rows.map((r) => toIncidentView(r.i, r.siteName));
  });
}

/** 30 derniers jours, du plus ancien au plus récent ; jour sans mesure = null (jamais inventé). */
export function buildUptimeDays(rows: Array<{ day: string; checks: number; failures: number }>, today = new Date()): UptimeDayView[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: UptimeDayView[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i)).toISOString().slice(0, 10);
    const r = byDay.get(d);
    out.push({ day: d, checks: r?.checks ?? 0, failures: r?.failures ?? 0, uptime: r ? ratio(r.checks, r.failures) : null });
  }
  return out;
}

export async function getSiteDetail(userId: string, siteId: string) {
  return withUser(getDb(), userId, async (tx) => {
    const [site] = await tx.select().from(businessSites).where(eq(businessSites.id, siteId)).limit(1);
    if (!site) return null;
    const [endpoints, scenarios, attempts, daily, series, runs] = await Promise.all([
      tx.select().from(businessEndpoints).where(eq(businessEndpoints.siteId, siteId)).orderBy(asc(businessEndpoints.createdAt)),
      tx.select().from(browserTestScenarios).where(eq(browserTestScenarios.siteId, siteId)).orderBy(asc(browserTestScenarios.createdAt)),
      tx.select().from(siteVerifications).where(eq(siteVerifications.siteId, siteId)).orderBy(desc(siteVerifications.attemptedAt)).limit(5),
      tx.execute<{ day: string; checks: number; failures: number }>(sql`
        select day::text as day, sum(checks)::int as checks, sum(failures)::int as failures
        from business_daily_stats where site_id = ${siteId} and day >= current_date - 29 group by day`),
      tx.execute<{ t: Date; v: number | null }>(sql`
        select date_trunc('minute', checked_at) as t, round(avg(response_ms) filter (where ok))::int as v
        from business_checks where site_id = ${siteId} and checked_at > now() - interval '24 hours' and not is_confirmation
        group by 1 order by 1`),
      tx.select().from(browserTestRuns).where(eq(browserTestRuns.siteId, siteId)).orderBy(desc(browserTestRuns.startedAt)).limit(10),
    ]);
    const stats = daily.reduce((a, d) => ({ checks: a.checks + d.checks, failures: a.failures + d.failures }), { checks: 0, failures: 0 });
    return {
      site,
      endpoints,
      scenarios,
      attempts,
      runs,
      uptimeDays: buildUptimeDays(daily),
      uptime30d: ratio(stats.checks, stats.failures),
      responseSeries: series.map((p) => ({ t: new Date(p.t).toISOString(), v: p.v })),
      instructions: verificationInstructions(site.domain, site.verificationToken),
    };
  });
}

export async function getIncident(userId: string, id: string) {
  return withUser(getDb(), userId, async (tx) => {
    const [row] = await tx
      .select({ i: incidents, siteName: businessSites.name, domain: businessSites.domain })
      .from(incidents)
      .innerJoin(businessSites, eq(businessSites.id, incidents.siteId))
      .where(eq(incidents.id, id))
      .limit(1);
    if (!row) return null;
    const events = await tx.select().from(incidentEvents).where(eq(incidentEvents.incidentId, id)).orderBy(asc(incidentEvents.at), asc(incidentEvents.id));
    let endpointName: string | null = null;
    if (row.i.endpointId) {
      const [e] = await tx.select({ name: businessEndpoints.name, url: businessEndpoints.url }).from(businessEndpoints).where(eq(businessEndpoints.id, row.i.endpointId));
      endpointName = e ? `${e.name} (${e.url})` : null;
    }
    if (row.i.scenarioId) {
      const [s] = await tx.select({ name: browserTestScenarios.name }).from(browserTestScenarios).where(eq(browserTestScenarios.id, row.i.scenarioId));
      endpointName = s ? `Scénario « ${s.name} »` : null;
    }
    return { incident: toIncidentView(row.i, row.siteName), raw: row.i, domain: row.domain, events, target: endpointName };
  });
}

/** Lignes du rapport (statistiques quotidiennes réelles par point de contrôle). */
export async function getReportRows(userId: string, siteId: string, days: number) {
  return withUser(getDb(), userId, (tx) =>
    tx.execute<{ day: string; endpoint: string; url: string; checks: number; failures: number; avg_response_ms: number | null; p95_response_ms: number | null; downtime_seconds: number }>(sql`
      select d.day::text as day, e.name as endpoint, e.url, d.checks, d.failures, d.avg_response_ms, d.p95_response_ms, d.downtime_seconds
      from business_daily_stats d join business_endpoints e on e.id = d.endpoint_id
      where d.site_id = ${siteId} and d.day >= current_date - ${days - 1}::int
      order by d.day, e.name`),
  );
}

export async function countOpenIncidents(userId: string): Promise<number> {
  const [r] = await withUser(getDb(), userId, (tx) =>
    tx.select({ n: sql<number>`count(*)::int` }).from(incidents).where(and(eq(incidents.status, "open"))),
  );
  return r?.n ?? 0;
}
