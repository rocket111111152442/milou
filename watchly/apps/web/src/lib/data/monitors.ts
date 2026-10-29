import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNull,
  lt,
  monitoringResults,
  monitoringSchedules,
  monitoringTargets,
  monitoringTasks,
  notifications,
  sql,
  withUser,
} from "@watchly/database";
import {
  CONDITION_LABELS,
  formatPrice,
  STATUS_LABELS,
  type Condition,
  type MonitorSummary,
  type NotificationView,
  type OverviewData,
  type ResultView,
} from "@watchly/types";
import { getDb } from "../db";
import { getQuotaViews, getSubscriptionView, listDevices, loadEntitlements } from "./account";

const INTENT_LABELS: Record<string, string> = {
  release_date: "Date de sortie",
  announcement: "Annonce",
  job_offer: "Nouvelle offre",
  official_publication: "Publication officielle",
  generic: "Nouvelle information",
};

export function conditionLabel(c: Condition | Record<string, unknown>): string {
  const cond = c as Condition;
  switch (cond.type) {
    case "price_below":
      return `Prix sous ${formatPrice(cond.threshold)}`;
    case "price_drop":
      return cond.minPercent ? `Baisse de prix ≥ ${cond.minPercent} %` : "Baisse de prix";
    case "text_appears":
      return `Apparition de « ${cond.text} »`;
    case "text_disappears":
      return `Disparition de « ${cond.text} »`;
    case "page_changed":
      return cond.sensitivity === "any" ? "Toute modification" : "Modification significative";
    case "web_topic":
      return `${INTENT_LABELS[cond.intent] ?? "Recherche"}${cond.requireOfficial ? " (officielle)" : ""}`;
    default:
      return CONDITION_LABELS[(cond as { type: keyof typeof CONDITION_LABELS }).type] ?? "Surveillance";
  }
}

const AVAIL: Record<string, string> = { in_stock: "En stock", out_of_stock: "Rupture", preorder: "Précommande", unknown: "Inconnue" };

export function valueFromObservation(obs: Record<string, unknown> | null, cond: Record<string, unknown>): string | null {
  if (!obs) return null;
  if (obs.kind === "web_topic") return STATUS_LABELS[obs.status as keyof typeof STATUS_LABELS] ?? null;
  if (cond.type === "back_in_stock") return AVAIL[String(obs.availability)] ?? null;
  if (typeof obs.price === "number") return formatPrice(obs.price, typeof obs.currency === "string" ? obs.currency : "EUR");
  return null;
}

type Row = {
  id: string;
  name: string;
  kind: "page" | "web_topic";
  status: MonitorSummary["status"];
  condition: Record<string, unknown>;
  lastStatus: MonitorSummary["lastStatus"];
  lastCheckedAt: Date | null;
  host: string | null;
  topic: string | null;
  intervalMinutes: number | null;
  nextRunAt: Date | null;
};

async function lastResults(userId: string, taskIds: string[]) {
  if (!taskIds.length) return new Map<string, { observation: Record<string, unknown> | null; executedBy: "agent" | "cloud" }>();
  const rows = await withUser(getDb(), userId, (tx) =>
    tx.execute<{ task_id: string; observation: Record<string, unknown> | null; executed_by: "agent" | "cloud" }>(sql`
      select distinct on (task_id) task_id, observation, executed_by from monitoring_results
      where task_id in ${taskIds} and outcome <> 'error'
      order by task_id, checked_at desc`),
  );
  return new Map(rows.map((r) => [r.task_id, { observation: r.observation, executedBy: r.executed_by }]));
}

function toSummary(r: Row, last: { observation: Record<string, unknown> | null; executedBy: "agent" | "cloud" } | undefined): MonitorSummary {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    status: r.status,
    conditionLabel: conditionLabel(r.condition),
    targetLabel: r.kind === "page" ? (r.host ?? "") : "Recherche sur Internet",
    lastStatus: r.lastStatus,
    lastCheckedAt: r.lastCheckedAt?.toISOString() ?? null,
    nextRunAt: r.status === "active" || r.status === "error" ? (r.nextRunAt?.toISOString() ?? null) : null,
    intervalMinutes: r.intervalMinutes ?? 0,
    lastValue: valueFromObservation(last?.observation ?? null, r.condition),
    lastExecutor: last?.executedBy ?? null,
  };
}

export async function listMonitors(userId: string, filter: { kind?: "page" | "web_topic"; q?: string } = {}): Promise<MonitorSummary[]> {
  const rows = await withUser(getDb(), userId, (tx) =>
    tx
      .select({
        id: monitoringTasks.id,
        name: monitoringTasks.name,
        kind: monitoringTasks.kind,
        status: monitoringTasks.status,
        condition: monitoringTasks.condition,
        lastStatus: monitoringTasks.lastStatus,
        lastCheckedAt: monitoringTasks.lastCheckedAt,
        host: monitoringTargets.host,
        topic: monitoringTargets.topic,
        intervalMinutes: monitoringSchedules.intervalMinutes,
        nextRunAt: monitoringSchedules.nextRunAt,
      })
      .from(monitoringTasks)
      .leftJoin(monitoringTargets, eq(monitoringTargets.taskId, monitoringTasks.id))
      .leftJoin(monitoringSchedules, eq(monitoringSchedules.taskId, monitoringTasks.id))
      .where(
        and(
          filter.kind ? eq(monitoringTasks.kind, filter.kind) : undefined,
          filter.q ? sql`${monitoringTasks.name} ilike ${`%${filter.q.replace(/[%_]/g, "")}%`}` : undefined,
        ),
      )
      .orderBy(desc(monitoringTasks.createdAt)),
  );
  const last = await lastResults(userId, rows.map((r) => r.id));
  return rows.map((r) => toSummary(r as Row, last.get(r.id)));
}

export async function getMonitorDetail(userId: string, id: string) {
  return withUser(getDb(), userId, async (tx) => {
    const [task] = await tx.select().from(monitoringTasks).where(eq(monitoringTasks.id, id)).limit(1);
    if (!task) return null;
    const [target] = await tx.select().from(monitoringTargets).where(eq(monitoringTargets.taskId, id)).limit(1);
    const [schedule] = await tx.select().from(monitoringSchedules).where(eq(monitoringSchedules.taskId, id)).limit(1);
    const results = await tx
      .select()
      .from(monitoringResults)
      .where(eq(monitoringResults.taskId, id))
      .orderBy(desc(monitoringResults.checkedAt))
      .limit(50);
    const series = await tx
      .select({ checkedAt: monitoringResults.checkedAt, observation: monitoringResults.observation })
      .from(monitoringResults)
      .where(and(eq(monitoringResults.taskId, id), gte(monitoringResults.checkedAt, new Date(Date.now() - 90 * 86_400_000))))
      .orderBy(asc(monitoringResults.checkedAt))
      .limit(500);
    return { task, target: target ?? null, schedule: schedule ?? null, results, series };
  });
}

export function toResultView(r: typeof monitoringResults.$inferSelect, condition: Record<string, unknown>): ResultView {
  const obs = r.observation;
  return {
    id: r.id,
    checkedAt: r.checkedAt.toISOString(),
    outcome: r.outcome,
    executedBy: r.executedBy,
    summary: r.outcome === "error" ? (r.errorMessage ?? "Erreur") : summarizeResult(r),
    value: valueFromObservation(obs, condition),
    sourceUrl: obs && typeof obs.finalUrl === "string" ? obs.finalUrl : null,
  };
}

function summarizeResult(r: typeof monitoringResults.$inferSelect): string {
  const obs = r.observation as Record<string, unknown> | null;
  const change = r.changeSummary as Record<string, unknown> | null;
  if (obs?.kind === "web_topic") {
    const f = (obs.findings as unknown[] | undefined)?.length ?? 0;
    return `${STATUS_LABELS[obs.status as keyof typeof STATUS_LABELS]} · ${f} résultat(s) pertinent(s)${r.fromCache ? " (résultats mutualisés)" : ""}`;
  }
  if (change?.price) {
    const p = change.price as { from: number; to: number };
    return `Prix : ${formatPrice(p.from)} → ${formatPrice(p.to)}`;
  }
  if (r.outcome === "triggered") return "Alerte envoyée";
  if (typeof change?.ratio === "number") return `Contenu modifié (${Math.round((change.ratio as number) * 100)} %)`;
  return r.fromCache ? "Aucun changement (résultat mutualisé récent)" : "Aucun changement";
}

export function toNotificationView(n: typeof notifications.$inferSelect): NotificationView {
  return {
    id: n.id,
    type: n.type,
    priority: n.priority,
    title: n.title,
    body: n.body,
    taskName: n.taskName,
    sourceUrl: n.sourceUrl,
    linkPath: n.linkPath,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt?.toISOString() ?? null,
  };
}

export async function listNotifications(userId: string, opts: { unread?: boolean; limit?: number; before?: Date } = {}): Promise<NotificationView[]> {
  const rows = await withUser(getDb(), userId, (tx) =>
    tx
      .select()
      .from(notifications)
      .where(and(opts.unread ? isNull(notifications.readAt) : undefined, opts.before ? lt(notifications.createdAt, opts.before) : undefined))
      .orderBy(desc(notifications.createdAt))
      .limit(Math.min(200, opts.limit ?? 50)),
  );
  return rows.map(toNotificationView);
}

export async function listHistory(userId: string, limit = 100) {
  return withUser(getDb(), userId, (tx) =>
    tx
      .select({
        result: monitoringResults,
        name: monitoringTasks.name,
        condition: monitoringTasks.condition,
      })
      .from(monitoringResults)
      .innerJoin(monitoringTasks, eq(monitoringTasks.id, monitoringResults.taskId))
      .orderBy(desc(monitoringResults.checkedAt))
      .limit(limit),
  );
}

export async function getOverview(userId: string): Promise<{ data: OverviewData; cloudRelay: boolean }> {
  const ent = await loadEntitlements(userId);
  const [monitors, devices, subscription, quotas, alerts, history] = await Promise.all([
    listMonitors(userId),
    listDevices(userId),
    getSubscriptionView(userId),
    getQuotaViews(userId, ent),
    listNotifications(userId, { limit: 5 }),
    listHistory(userId, 5),
  ]);
  const [week] = await withUser(getDb(), userId, (tx) =>
    tx
      .select({ n: count() })
      .from(notifications)
      .where(gte(notifications.createdAt, new Date(Date.now() - 7 * 86_400_000))),
  );
  const upcoming = monitors
    .filter((m) => m.nextRunAt)
    .sort((a, b) => (a.nextRunAt! < b.nextRunAt! ? -1 : 1))
    .slice(0, 5)
    .map((m) => ({ id: m.id, name: m.name, nextRunAt: m.nextRunAt, kind: m.kind }));
  return {
    cloudRelay: ent.cloudRelay,
    data: {
      activeMonitors: monitors.filter((m) => m.status === "active" || m.status === "error").length,
      alertsLast7Days: week?.n ?? 0,
      upcoming,
      latestResults: history.map((h) => ({ ...toResultView(h.result, h.condition), monitorId: h.result.taskId, monitorName: h.name })),
      recentAlerts: alerts,
      devices,
      subscription,
      quotas,
    },
  };
}
