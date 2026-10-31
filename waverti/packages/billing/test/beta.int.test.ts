import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { betaGrants, eq, monitoringTasks, subscriptions, withUser } from "@waverti/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import { BETA_CAPS, getEntitlements, recomputeEntitlements, searchQuotaWindow, loadCurrentSubscription } from "../src";

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t?.drop();
});

const day = 86_400_000;
async function grant(userId: string, planId: string, days: number, startsAt = new Date()) {
  await t.db.insert(betaGrants).values({ userId, planId, reason: "Bêta privée test", startsAt, expiresAt: new Date(startsAt.getTime() + days * day) });
}

describe("accès bêta privé sans paiement", () => {
  it("donne des droits limités (quotas stricts) et temporaires, sans abonnement", async () => {
    const u = await createTestUser(t);
    expect((await recomputeEntitlements(t.db, u.id)).planId).toBeNull();
    await grant(u.id, "max", 30);
    const e = await recomputeEntitlements(t.db, u.id);
    expect(e).toMatchObject({ planId: "max", source: "admin_grant", maxMonitors: BETA_CAPS.maxMonitors, maxWebTopics: BETA_CAPS.maxWebTopics, dailySearchCalls: 2 });
    expect(e.monthlySearchCalls).toBeLessThanOrEqual(BETA_CAPS.monthlySearchCalls);
    expect(e.validUntil!.getTime()).toBeGreaterThan(Date.now() + 29 * day);
    // Quota de recherche absolu (comme l'essai), jamais proratisé à la hausse.
    expect(searchQuotaWindow(e, null)).toMatchObject({ limit: e.monthlySearchCalls, dailyLimit: 2 });
  });

  it("expire automatiquement : droits retirés et surveillances suspendues", async () => {
    const u = await createTestUser(t);
    await grant(u.id, "plus", 10, new Date(Date.now() - 11 * day));
    await t.db.insert(monitoringTasks).values({ userId: u.id, kind: "page", name: "m", condition: { type: "page_changed" } });
    const e = await getEntitlements(t.db, u.id);
    expect(e.planId).toBeNull();
    const [task] = await t.db.select().from(monitoringTasks).where(eq(monitoringTasks.userId, u.id));
    expect(task!.status).toBe("paused_quota");
    // Un droit valable devient invalide au passage de la date (recalcul à l'échéance).
    const v = await createTestUser(t);
    await grant(v.id, "plus", 5);
    const now = await recomputeEntitlements(t.db, v.id);
    expect(now.source).toBe("admin_grant");
    expect((await recomputeEntitlements(t.db, v.id, new Date(Date.now() + 6 * day))).planId).toBeNull();
  });

  it("révocation immédiate ; un abonnement réel reste prioritaire", async () => {
    const u = await createTestUser(t);
    await grant(u.id, "pro", 20);
    expect((await recomputeEntitlements(t.db, u.id)).source).toBe("admin_grant");
    await t.db.update(betaGrants).set({ revokedAt: new Date() }).where(eq(betaGrants.userId, u.id));
    expect((await recomputeEntitlements(t.db, u.id)).planId).toBeNull();

    const s = await createTestUser(t);
    await grant(s.id, "plus", 20);
    await t.db.insert(subscriptions).values({ userId: s.id, planId: "pro", stripeSubscriptionId: `sub_${s.id}`, stripeCustomerId: `cus_${s.id}`, status: "active", currentPeriodEnd: new Date(Date.now() + 20 * day) });
    const e = await recomputeEntitlements(t.db, s.id);
    expect(e).toMatchObject({ source: "subscription", planId: "pro", maxMonitors: 100 });
    expect(searchQuotaWindow(e, await loadCurrentSubscription(t.db, s.id)).dailyLimit).toBeNull();
  });

  it("la base refuse plus de 60 jours, et un utilisateur ne peut ni lire ni écrire un accès bêta", async () => {
    const u = await createTestUser(t);
    await expect(grant(u.id, "plus", 61)).rejects.toThrow();
    await expect(withUser(t.db, u.id, (tx) => tx.select().from(betaGrants))).rejects.toMatchObject({ cause: { code: "42501" } });
    await expect(
      withUser(t.db, u.id, (tx) => tx.insert(betaGrants).values({ userId: u.id, planId: "max", reason: "auto-attribution", expiresAt: new Date(Date.now() + day) })),
    ).rejects.toMatchObject({ cause: { code: "42501" } });
  });
});
