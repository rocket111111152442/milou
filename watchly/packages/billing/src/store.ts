import {
  and,
  desc,
  entitlements as entitlementsTable,
  eq,
  inArray,
  monitoringTasks,
  plans as plansTable,
  profiles,
  subscriptions,
  type Database,
  type Executor,
  type Transaction,
} from "@watchly/database";
import {
  computeEntitlements,
  roleForEntitlements,
  type Entitlements,
  type PlanRow,
  type SubscriptionSnapshot,
} from "./entitlements";
import { planQuotaEnforcement } from "./quotas";

export async function loadPlans(db: Executor): Promise<Map<string, PlanRow>> {
  const rows = await db.select().from(plansTable);
  return new Map(rows.map((r) => [r.id, r]));
}

/** Abonnement « vivant » le plus récent (ou le dernier connu) d'un utilisateur. */
export async function loadCurrentSubscription(db: Executor, userId: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(5);
  const live = rows.find((r) => ["trialing", "active", "past_due", "unpaid"].includes(r.status));
  return live ?? rows[0] ?? null;
}

function toRow(userId: string, e: Entitlements) {
  return {
    userId,
    planId: e.planId,
    source: e.source,
    subscriptionStatus: e.subscriptionStatus,
    maxMonitors: e.maxMonitors,
    maxWebTopics: e.maxWebTopics,
    pageIntervalMinutes: e.pageIntervalMinutes,
    webIntervalMinutes: e.webIntervalMinutes,
    cloudRelay: e.cloudRelay,
    emailAlerts: e.emailAlerts,
    historyDays: e.historyDays,
    advancedHistory: e.advancedHistory,
    dataExports: e.dataExports,
    monthlySearchCalls: e.monthlySearchCalls,
    dailySearchCalls: e.dailySearchCalls,
    monthlyEmailAlerts: e.monthlyEmailAlerts,
    businessSites: e.businessSites,
    businessEndpointsPerSite: e.businessEndpointsPerSite,
    businessHttpIntervalSeconds: e.businessHttpIntervalSeconds,
    businessScenariosPerSite: e.businessScenariosPerSite,
    businessScenariosTotal: e.businessScenarios,
    businessScenarioIntervalMinutes: e.businessScenarioIntervalMinutes,
    businessTlsChecks: e.businessTlsChecks,
    priorityAlerts: e.priorityAlerts,
    validUntil: e.validUntil,
    computedAt: new Date(),
  };
}

function fromRow(r: typeof entitlementsTable.$inferSelect): Entitlements {
  return {
    planId: r.planId,
    source: r.source,
    subscriptionStatus: (r.subscriptionStatus as Entitlements["subscriptionStatus"]) ?? null,
    maxMonitors: r.maxMonitors,
    maxWebTopics: r.maxWebTopics,
    pageIntervalMinutes: r.pageIntervalMinutes,
    webIntervalMinutes: r.webIntervalMinutes,
    cloudRelay: r.cloudRelay,
    emailAlerts: r.emailAlerts,
    historyDays: r.historyDays,
    advancedHistory: r.advancedHistory,
    dataExports: r.dataExports,
    monthlySearchCalls: r.monthlySearchCalls,
    dailySearchCalls: r.dailySearchCalls,
    monthlyEmailAlerts: r.monthlyEmailAlerts,
    businessSites: r.businessSites,
    businessEndpointsPerSite: r.businessEndpointsPerSite,
    businessHttpIntervalSeconds: r.businessHttpIntervalSeconds,
    businessScenariosPerSite: r.businessScenariosPerSite,
    businessScenarios: r.businessScenariosTotal,
    businessScenarioIntervalMinutes: r.businessScenarioIntervalMinutes,
    businessTlsChecks: r.businessTlsChecks,
    priorityAlerts: r.priorityAlerts,
    validUntil: r.validUntil,
  };
}

/**
 * Recalcule et persiste les droits d'un utilisateur, ajuste son rôle (user/business) et
 * suspend/réactive les surveillances selon les nouveaux quotas. Idempotent.
 */
export async function recomputeEntitlements(
  db: Database | Transaction,
  userId: string,
  now: Date = new Date(),
): Promise<Entitlements> {
  return (db as Database).transaction(async (tx) => {
    // Sérialise les recalculs concurrents pour un même utilisateur (webhooks simultanés).
    await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId)).for("update");
    const plans = await loadPlans(tx);
    const sub = await loadCurrentSubscription(tx, userId);
    const snapshot: SubscriptionSnapshot | null = sub
      ? {
          planId: sub.planId,
          status: sub.status,
          extraSites: sub.extraSites,
          trialEnd: sub.trialEnd,
          currentPeriodEnd: sub.currentPeriodEnd,
        }
      : null;
    const e = computeEntitlements(plans, snapshot, now);
    const row = toRow(userId, e);
    await tx.insert(entitlementsTable).values(row).onConflictDoUpdate({ target: entitlementsTable.userId, set: row });

    const [profile] = await tx.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId));
    if (profile) {
      const role = roleForEntitlements(profile.role, e);
      if (role !== profile.role) await tx.update(profiles).set({ role }).where(eq(profiles.id, userId));
    }

    const monitors = await tx
      .select({ id: monitoringTasks.id, kind: monitoringTasks.kind, status: monitoringTasks.status, createdAt: monitoringTasks.createdAt })
      .from(monitoringTasks)
      .where(eq(monitoringTasks.userId, userId));
    const { pause, resume } = planQuotaEnforcement(e, monitors);
    if (pause.length) {
      await tx
        .update(monitoringTasks)
        .set({ status: "paused_quota" })
        .where(and(eq(monitoringTasks.userId, userId), inArray(monitoringTasks.id, pause)));
    }
    if (resume.length) {
      await tx
        .update(monitoringTasks)
        .set({ status: "active" })
        .where(and(eq(monitoringTasks.userId, userId), inArray(monitoringTasks.id, resume)));
    }
    return e;
  });
}

/** Droits courants ; calculés à la volée s'ils n'existent pas encore ou ont expiré. */
export async function getEntitlements(db: Database, userId: string, now: Date = new Date()): Promise<Entitlements> {
  const [row] = await db.select().from(entitlementsTable).where(eq(entitlementsTable.userId, userId)).limit(1);
  if (!row || (row.validUntil && row.validUntil.getTime() <= now.getTime())) {
    return recomputeEntitlements(db, userId, now);
  }
  return fromRow(row);
}
