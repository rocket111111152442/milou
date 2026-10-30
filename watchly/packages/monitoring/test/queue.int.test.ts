import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentDevices,
  emailOutbox,
  eq,
  monitoringJobs,
  monitoringResults,
  monitoringSchedules,
  monitoringTasks,
  notifications,
  profiles,
  subscriptions,
  sql,
} from "@watchly/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@watchly/database/testing";
import { recomputeEntitlements, QuotaError } from "@watchly/billing";
import type { PageObservation } from "@watchly/types";
import { claimAgentJobs, claimCloudJobs, recoverJobs, scheduleDueTasks } from "../src/queue";
import { StaleClaimError, submitResult } from "../src/results";
import { createMonitor, deleteMonitor, MonitorError, setMonitorPaused } from "../src/service";

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t?.drop();
});

/** Compte sans abonnement ni essai : aucun droit (il n'existe plus de formule gratuite). */
async function noPlanUser() {
  const u = await createTestUser(t);
  await recomputeEntitlements(t.db, u.id);
  return u;
}

/** Essai en cours (72 h) : 3 surveillances au maximum, 1 sujet. */
async function trialUser(planId: "plus" | "pro" | "max" = "plus") {
  const u = await createTestUser(t);
  await t.db.insert(subscriptions).values({
    userId: u.id,
    planId,
    stripeSubscriptionId: `sub_${u.id}`,
    stripeCustomerId: `cus_${u.id}`,
    status: "trialing",
    trialEnd: new Date(Date.now() + 2 * 86_400_000),
  });
  await recomputeEntitlements(t.db, u.id);
  return u;
}

async function paidUser(planId: "plus" | "pro" | "max" = "plus") {
  const u = await createTestUser(t);
  await t.db.insert(subscriptions).values({
    userId: u.id,
    planId,
    stripeSubscriptionId: `sub_${u.id}`,
    stripeCustomerId: `cus_${u.id}`,
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
  });
  await recomputeEntitlements(t.db, u.id);
  return u;
}

async function device(userId: string, online = true) {
  const [d] = await t.db
    .insert(agentDevices)
    .values({
      userId,
      name: "PC",
      platform: "linux",
      tokenHash: `h_${userId}_${Math.random()}`,
      status: "active",
      monitoringEnabled: true,
      consentLocalAt: new Date(),
      consentVersion: "test",
      lastSeenAt: online ? new Date() : new Date(Date.now() - 3_600_000),
    })
    .returning({ id: agentDevices.id });
  return d!.id;
}

const pageInput = (n: number, over: Record<string, unknown> = {}) => ({
  kind: "page" as const,
  name: `Produit ${n}`,
  url: `https://shop${n}.example.com/produit`,
  renderMode: "auto" as const,
  condition: { type: "price_below" as const, threshold: 100, currency: "EUR" as const },
  executionMode: "auto" as const,
  notify: { inapp: true, email: true, desktop: true },
  ...over,
});

function observation(price: number | null, url = "https://shop.example.com/produit"): PageObservation {
  return {
    kind: "page",
    url,
    finalUrl: url,
    httpStatus: 200,
    title: "Produit",
    price,
    currency: "EUR",
    priceSource: "jsonld",
    availability: "in_stock",
    availabilitySource: "jsonld",
    textHash: "a".repeat(64),
    textLength: 10,
    excerpt: "Produit",
    selectorFound: null,
    method: "http",
    fetchedAt: new Date().toISOString(),
  };
}

async function settleInitialJobs(userId: string) {
  await t.db.update(monitoringJobs).set({ status: "canceled" }).where(eq(monitoringJobs.userId, userId));
}

describe("monitor service — quotas and validation", () => {
  it("refuses any monitor without a subscription or trial (no free plan)", async () => {
    const u = await noPlanUser();
    await expect(createMonitor(t.db, u.id, pageInput(1))).rejects.toThrow(/essai gratuit de 3 jours/);
  });

  it("limits a trial to 3 active monitors", async () => {
    const u = await trialUser("max");
    for (let i = 0; i < 3; i++) await createMonitor(t.db, u.id, pageInput(i));
    await expect(createMonitor(t.db, u.id, pageInput(4))).rejects.toBeInstanceOf(QuotaError);
  });

  it("cannot be bypassed by concurrent creations (row lock)", async () => {
    const u = await trialUser();
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => createMonitor(t.db, u.id, pageInput(i))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const [c] = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from monitoring_tasks where user_id = ${u.id}`);
    expect(c!.n).toBe(3);
  });

  it("rejects intervals shorter than the plan, and more than one web topic during a trial", async () => {
    const u = await trialUser("pro");
    await expect(createMonitor(t.db, u.id, pageInput(1, { intervalMinutes: 5 }))).rejects.toThrow(/fréquence minimale/);
    const topic = { kind: "web_topic" as const, name: "Sortie", request: "Préviens-moi de la date de sortie officielle", officialDomains: [], notify: { inapp: true, email: true, desktop: true } };
    const first = await createMonitor(t.db, u.id, topic);
    // Essai : recherche au plus une fois par jour, même en Pro.
    expect(first.intervalMinutes).toBe(1440);
    await expect(createMonitor(t.db, u.id, { ...topic, name: "Autre" })).rejects.toBeInstanceOf(QuotaError);
  });

  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
    "http://localhost/admin",
    "http://intranet/",
    "http://exemple.fr:6379/",
    "gopher://exemple.fr/",
  ])("refuses unsafe target %s", async (url) => {
    const u = await paidUser();
    await expect(createMonitor(t.db, u.id, pageInput(1, { url }))).rejects.toBeInstanceOf(MonitorError);
  });
});

describe("hybrid job queue", () => {
  it("runs a subscriber's first check in the cloud immediately; a local-only monitor only on their PC", async () => {
    const paid = await paidUser();
    const mCloud = await createMonitor(t.db, paid.id, pageInput(10));
    const mLocal = await createMonitor(t.db, paid.id, pageInput(11, { executionMode: "local_only" }));
    const cloud = await claimCloudJobs(t.db, { workerId: "w1", max: 50 });
    const taskIds = cloud.map((c) => c.taskId);
    expect(taskIds).toContain(mCloud.id);
    expect(taskIds).not.toContain(mLocal.id);
    const dev = await device(paid.id);
    const agent = await claimAgentJobs(t.db, { userId: paid.id, deviceId: dev, max: 3 });
    expect(agent.map((a) => a.taskId)).toEqual([mLocal.id]);
  });

  it("never hands a user's jobs to another user's computer", async () => {
    const a = await paidUser();
    const b = await paidUser();
    await createMonitor(t.db, a.id, pageInput(20, { executionMode: "local_only" }));
    const devB = await device(b.id);
    const claimed = await claimAgentJobs(t.db, { userId: b.id, deviceId: devB, max: 3 });
    expect(claimed).toHaveLength(0);
  });

  it("stops every local and cloud check as soon as the rights end, even for jobs already queued", async () => {
    const u = await trialUser();
    const dev = await device(u.id);
    const mLocal = await createMonitor(t.db, u.id, pageInput(30, { executionMode: "local_only" }));
    const mCloud = await createMonitor(t.db, u.id, pageInput(31, { executionMode: "cloud_only" }));
    // Fin des droits sans recalcul encore effectué : les tâches sont toujours « actives » et leurs travaux en file.
    await t.db.execute(sql`update entitlements set plan_id = null, source = 'none' where user_id = ${u.id}`);
    expect(await claimAgentJobs(t.db, { userId: u.id, deviceId: dev, max: 3 })).toHaveLength(0);
    const cloud = await claimCloudJobs(t.db, { workerId: "w-end", max: 50 });
    expect(cloud.map((c) => c.taskId)).not.toContain(mCloud.id);
    // Après recalcul (abonnement annulé), les surveillances passent en pause, données conservées.
    await t.db.update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.userId, u.id));
    await recomputeEntitlements(t.db, u.id);
    const tasks = await t.db.select().from(monitoringTasks).where(eq(monitoringTasks.userId, u.id));
    expect(tasks.map((x) => x.status).sort()).toEqual(["paused_quota", "paused_quota"]);
    expect(tasks.map((x) => x.id).sort()).toEqual([mLocal.id, mCloud.id].sort());
    // Rien n'est planifié pour un compte sans droits.
    await t.db.update(monitoringSchedules).set({ nextRunAt: new Date(Date.now() - 1000) }).where(eq(monitoringSchedules.taskId, mCloud.id));
    await t.db.update(monitoringTasks).set({ status: "active" }).where(eq(monitoringTasks.id, mCloud.id));
    expect((await scheduleDueTasks(t.db)).map((c) => c.taskId)).not.toContain(mCloud.id);
  });

  it("prefers the online PC, then relays to the cloud after the grace period", async () => {
    const u = await paidUser();
    await device(u.id, true);
    const m = await createMonitor(t.db, u.id, pageInput(30));
    await settleInitialJobs(u.id);
    const slot = new Date(Date.now() - 1000);
    await t.db.update(monitoringSchedules).set({ nextRunAt: slot }).where(eq(monitoringSchedules.taskId, m.id));
    const created = await scheduleDueTasks(t.db, { agentGraceSeconds: 600 });
    const job = created.find((c) => c.taskId === m.id)!;
    expect(job).toMatchObject({ preferredExecutor: "agent", allowCloud: true });
    expect((await claimCloudJobs(t.db, { workerId: "w", max: 50 })).map((c) => c.taskId)).not.toContain(m.id);
    const later = new Date(Date.now() + 11 * 60_000);
    const relayed = await claimCloudJobs(t.db, { workerId: "w", max: 50, now: later });
    expect(relayed.map((c) => c.taskId)).toContain(m.id);
  });

  it("treats a PC paused by its user as unavailable: the cloud relays immediately", async () => {
    const u = await paidUser();
    const dev = await device(u.id, true);
    await t.db.update(agentDevices).set({ lastState: "paused" }).where(eq(agentDevices.id, dev));
    const m = await createMonitor(t.db, u.id, pageInput(35));
    await settleInitialJobs(u.id);
    await t.db.update(monitoringSchedules).set({ nextRunAt: new Date(Date.now() - 1000) }).where(eq(monitoringSchedules.taskId, m.id));
    const created = await scheduleDueTasks(t.db, { agentGraceSeconds: 600 });
    expect(created.find((c) => c.taskId === m.id)).toMatchObject({ preferredExecutor: "cloud" });
    expect((await claimCloudJobs(t.db, { workerId: "w", max: 50 })).map((c) => c.taskId)).toContain(m.id);
  });

  it("guarantees that PC and server never run the same check twice (concurrent claims)", async () => {
    const u = await paidUser();
    const dev = await device(u.id);
    const m = await createMonitor(t.db, u.id, pageInput(40));
    await settleInitialJobs(u.id);
    await t.db.insert(monitoringJobs).values({
      taskId: m.id,
      userId: u.id,
      kind: "page",
      slotAt: new Date(Date.now() - 60_000),
      preferredExecutor: "agent",
      allowCloud: true,
      allowAgent: true,
      agentDeadlineAt: new Date(Date.now() - 1000),
    });
    const attempts = await Promise.all([
      ...Array.from({ length: 4 }, () => claimAgentJobs(t.db, { userId: u.id, deviceId: dev, max: 3 })),
      ...Array.from({ length: 4 }, (_, i) => claimCloudJobs(t.db, { workerId: `w${i}`, max: 50 })),
    ]);
    const claimsForTask = attempts.flat().filter((c) => c.taskId === m.id);
    expect(claimsForTask).toHaveLength(1);
  });

  it("schedules each slot once, advances without drift and keeps a single live job per task", async () => {
    const u = await paidUser("pro");
    const m = await createMonitor(t.db, u.id, pageInput(50));
    const slot = new Date(Math.floor(Date.now() / 60_000) * 60_000 - 60_000);
    await t.db.update(monitoringSchedules).set({ nextRunAt: slot }).where(eq(monitoringSchedules.taskId, m.id));
    await scheduleDueTasks(t.db);
    const [s] = await t.db.select().from(monitoringSchedules).where(eq(monitoringSchedules.taskId, m.id));
    expect(s!.nextRunAt.getTime() - slot.getTime()).toBe(120 * 60_000);
    // L'exécution initiale est encore en attente : aucun second job vivant n'a pu être créé.
    const live = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from monitoring_jobs where task_id = ${m.id} and status in ('pending','claimed')`);
    expect(live[0]!.n).toBe(1);
  });

  it("recovers after a worker crash: the lease expires, the job is reclaimed and the stale worker cannot write", async () => {
    const u = await paidUser();
    const m = await createMonitor(t.db, u.id, pageInput(60));
    const [first] = (await claimCloudJobs(t.db, { workerId: "crashing", max: 50, leaseSeconds: 1 })).filter((c) => c.taskId === m.id);
    expect(first).toBeDefined();
    const afterLease = new Date(Date.now() + 5000);
    const rec = await recoverJobs(t.db, afterLease);
    expect(rec.requeued).toBeGreaterThanOrEqual(1);
    const [second] = (await claimCloudJobs(t.db, { workerId: "healthy", max: 50, now: afterLease })).filter((c) => c.taskId === m.id);
    expect(second!.jobId).toBe(first!.jobId);
    expect(second!.claimToken).not.toBe(first!.claimToken);
    await expect(
      submitResult(t.db, { jobId: first!.jobId, claimToken: first!.claimToken, executor: "cloud", durationMs: 10, observation: observation(120) }),
    ).rejects.toBeInstanceOf(StaleClaimError);
    const ok = await submitResult(t.db, { jobId: second!.jobId, claimToken: second!.claimToken, executor: "cloud", durationMs: 10, observation: observation(120) });
    expect(ok.duplicate).toBe(false);
  });

  it("fails a job after max attempts", async () => {
    const u = await paidUser();
    const m = await createMonitor(t.db, u.id, pageInput(61));
    let now = Date.now();
    for (let i = 0; i < 3; i++) {
      await claimCloudJobs(t.db, { workerId: "w", max: 50, leaseSeconds: 1, now: new Date(now) });
      now += 5000;
      await recoverJobs(t.db, new Date(now));
    }
    const [job] = await t.db.select().from(monitoringJobs).where(eq(monitoringJobs.taskId, m.id));
    expect(job!.status).toBe("failed");
  });

  it("records results idempotently and notifies once with the right channels", async () => {
    const paid = await paidUser();
    const m = await createMonitor(t.db, paid.id, pageInput(70));
    const [claim] = (await claimCloudJobs(t.db, { workerId: "w", max: 50 })).filter((c) => c.taskId === m.id);
    const input = { jobId: claim!.jobId, claimToken: claim!.claimToken, executor: "cloud" as const, durationMs: 50, observation: observation(80) };
    const r1 = await submitResult(t.db, input);
    const r2 = await submitResult(t.db, input);
    expect(r1).toMatchObject({ triggered: true, duplicate: false });
    expect(r2.duplicate).toBe(true);
    expect(await t.db.select().from(monitoringResults).where(eq(monitoringResults.taskId, m.id))).toHaveLength(1);
    const notifs = await t.db.select().from(notifications).where(eq(notifications.taskId, m.id));
    expect(notifs).toHaveLength(1);
    expect(notifs[0]).toMatchObject({ type: "price", emailStatus: "pending", desktopStatus: "pending", sourceUrl: "https://shop.example.com/produit" });
    expect(await t.db.select().from(emailOutbox).where(eq(emailOutbox.notificationId, notifs[0]!.id))).toHaveLength(1);
    const [task] = await t.db.select().from(monitoringTasks).where(eq(monitoringTasks.id, m.id));
    expect(task!.lastStatus).toBe("triggered");
  });

  it("does not send e-mail alerts when the user turned them off for a monitor", async () => {
    const u = await paidUser();
    const dev = await device(u.id);
    const m = await createMonitor(t.db, u.id, pageInput(80, { executionMode: "local_only", notify: { inapp: true, email: false, desktop: true } }));
    const [claim] = await claimAgentJobs(t.db, { userId: u.id, deviceId: dev, max: 1 });
    await submitResult(t.db, { jobId: claim!.jobId, claimToken: claim!.claimToken, executor: "agent", deviceId: dev, durationMs: 50, observation: observation(50) });
    const [n] = await t.db.select().from(notifications).where(eq(notifications.taskId, m.id));
    expect(n).toBeDefined();
    expect(n!.emailStatus).not.toBe("pending");
    expect(await t.db.select().from(emailOutbox).where(eq(emailOutbox.notificationId, n!.id))).toHaveLength(0);
  });

  it("rejects results from another device than the one holding the claim", async () => {
    const u = await paidUser();
    const dev1 = await device(u.id);
    const dev2 = await device(u.id);
    await createMonitor(t.db, u.id, pageInput(90, { executionMode: "local_only" }));
    const [claim] = await claimAgentJobs(t.db, { userId: u.id, deviceId: dev1, max: 1 });
    await expect(
      submitResult(t.db, { jobId: claim!.jobId, claimToken: claim!.claimToken, executor: "agent", deviceId: dev2, durationMs: 1, observation: observation(1) }),
    ).rejects.toBeInstanceOf(StaleClaimError);
  });

  it("skips local-only checks when the computer stays offline (never relayed to the cloud)", async () => {
    const u = await paidUser();
    const m = await createMonitor(t.db, u.id, pageInput(100, { executionMode: "local_only" }));
    const muchLater = new Date(Date.now() + 13 * 3_600_000);
    const r = await recoverJobs(t.db, muchLater);
    expect(r.skipped).toBeGreaterThanOrEqual(1);
    const [task] = await t.db.select().from(monitoringTasks).where(eq(monitoringTasks.id, m.id));
    expect(task!.lastStatus).toBe("skipped");
  });

  it("does not schedule checks of suspended accounts", async () => {
    const u = await paidUser();
    const m = await createMonitor(t.db, u.id, pageInput(110));
    await settleInitialJobs(u.id);
    await t.db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, u.id));
    await t.db.update(monitoringSchedules).set({ nextRunAt: new Date(Date.now() - 1000) }).where(eq(monitoringSchedules.taskId, m.id));
    const created = await scheduleDueTasks(t.db);
    expect(created.map((c) => c.taskId)).not.toContain(m.id);
  });

  it("pausing cancels pending jobs, deleting removes everything of the monitor", async () => {
    const u = await paidUser();
    const m = await createMonitor(t.db, u.id, pageInput(120));
    await setMonitorPaused(t.db, u.id, m.id, true);
    const jobs = await t.db.select().from(monitoringJobs).where(eq(monitoringJobs.taskId, m.id));
    expect(jobs.every((j) => j.status === "canceled")).toBe(true);
    const other = await paidUser();
    await expect(deleteMonitor(t.db, other.id, m.id)).rejects.toBeInstanceOf(MonitorError);
    await deleteMonitor(t.db, u.id, m.id);
    expect(await t.db.select().from(monitoringJobs).where(eq(monitoringJobs.taskId, m.id))).toHaveLength(0);
  });
});
