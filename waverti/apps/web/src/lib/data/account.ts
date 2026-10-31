import "server-only";
import {
  agentDevices,
  and,
  count,
  desc,
  entitlements,
  eq,
  isNull,
  monitoringTasks,
  notifications,
  plans,
  subscriptions,
  withUser,
} from "@waverti/database";
import { getEntitlements, type Entitlements } from "@waverti/billing";
import type { DeviceView, QuotaView, SubscriptionView } from "@waverti/types";
import { getDb } from "../db";

export const AGENT_ONLINE_MS = 3 * 60_000;

export async function loadEntitlements(userId: string): Promise<Entitlements> {
  return getEntitlements(getDb(), userId);
}

export async function getSubscriptionView(userId: string): Promise<SubscriptionView & { subscriptionId: string | null }> {
  const db = getDb();
  const ent = await getEntitlements(db, userId);
  return withUser(db, userId, async (tx) => {
    const [sub] = await tx.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).limit(1);
    const [plan] = ent.planId ? await tx.select({ name: plans.name }).from(plans).where(eq(plans.id, ent.planId)).limit(1) : [];
    const live = sub && ["trialing", "active", "past_due", "unpaid"].includes(sub.status);
    return {
      subscriptionId: live ? sub.id : null,
      planId: ent.planId,
      planName: plan?.name ?? ent.planId,
      status: live ? sub.status : null,
      isTrial: ent.source === "trial",
      trialEndsAt: live && sub.trialEnd ? sub.trialEnd.toISOString() : null,
      currentPeriodEnd: live && sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
      cancelAtPeriodEnd: Boolean(live && sub.cancelAtPeriodEnd),
      betaEndsAt: ent.source === "admin_grant" && ent.validUntil ? ent.validUntil.toISOString() : null,
    };
  });
}

export async function listDevices(userId: string, now = Date.now()): Promise<DeviceView[]> {
  return withUser(getDb(), userId, async (tx) => {
    const rows = await tx
      .select({
        id: agentDevices.id,
        name: agentDevices.name,
        platform: agentDevices.platform,
        lastSeenAt: agentDevices.lastSeenAt,
        monitoringEnabled: agentDevices.monitoringEnabled,
        appVersion: agentDevices.appVersion,
      })
      .from(agentDevices)
      .where(eq(agentDevices.status, "active"))
      .orderBy(desc(agentDevices.lastSeenAt));
    return rows.map((d) => ({
      id: d.id,
      name: d.name,
      platform: d.platform,
      online: Boolean(d.lastSeenAt && now - d.lastSeenAt.getTime() < AGENT_ONLINE_MS),
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      monitoringEnabled: d.monitoringEnabled,
      appVersion: d.appVersion,
    }));
  });
}

export async function getQuotaViews(userId: string, ent: Entitlements): Promise<QuotaView[]> {
  return withUser(getDb(), userId, async (tx) => {
    const [all] = await tx.select({ n: count() }).from(monitoringTasks);
    const [topics] = await tx.select({ n: count() }).from(monitoringTasks).where(eq(monitoringTasks.kind, "web_topic"));
    const out: QuotaView[] = [{ key: "monitors", label: "Surveillances", used: all?.n ?? 0, limit: ent.maxMonitors }];
    if (ent.maxWebTopics > 0) out.push({ key: "topics", label: "Sujets sur Internet", used: topics?.n ?? 0, limit: ent.maxWebTopics });
    return out;
  });
}

export async function unreadCount(userId: string): Promise<number> {
  return withUser(getDb(), userId, async (tx) => {
    const [r] = await tx.select({ n: count() }).from(notifications).where(isNull(notifications.readAt));
    return r?.n ?? 0;
  });
}

export async function readEntitlementsRow(userId: string) {
  return withUser(getDb(), userId, async (tx) => {
    const [r] = await tx.select().from(entitlements).where(and(eq(entitlements.userId, userId)));
    return r ?? null;
  });
}
