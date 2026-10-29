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

async function freeUser() {
  const u = await createTestUser(t);
  await recomputeEntitlements(t.db, u.id);
  return u;
}

async function paidUser(planId: "plus" | "pro" = "plus") {
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
  it("enforces the free plan limit and forces local execution", async () => {
    const u = await freeUser();
    for (let i = 0; i < 3; i++) {
      const m = await createMonitor(t.db, u.id, pageInput(i, { executionMode: "cloud_only" }));
      expect(m).toMatchObject({ executionMode: "local_only", intervalMinutes: 720 });
    }
    await expect(createMonitor(t.db, u.id, pageInput(4))).rejects.toBeInstanceOf(QuotaError);
  });

  it("cannot be bypassed by concurrent creations (row lock)", async () => {
    const u = await freeUser();
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => createMonitor(t.db, u.id, pageInput(i))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const [c] = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from monitoring_tasks where user_id = ${u.id}`);
    expect(c!.n).toBe(3);
  });

  it("rejects intervals shorter than the plan and web topics on the free plan", async () => {
    const u = await freeUser();
    await expect(createMonitor(t.db, u.id, pageInput(1, { intervalMinutes: 5 }))).rejects.toThrow(/fréquence minimale/);
    await expect(
      createMonitor(t.db, u.id, { kind: "web_topic", name: "Sortie", request: "Préviens-moi de la date de sortie officielle", officialDomains: [], notify: { inapp: true, email: true, desktop: true } }),
    ).rejects.toBeInstanceOf(QuotaError);
  });

  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
    "http://localhost/admin",
    "http://intranet/",
    "http://exemple.fr:6379/",
    "gopher://exemple.fr/",
  ])("refuses unsafe target %s", async (url) => {
    const u = await freeUser();
    await expect(createMonitor(t.db, u.id, pageInput(1, { url }))).rejects.toBeInstanceOf(MonitorError);
  });
});

describe("hybrid job queue", () => {
  it("lets a paid user's first check run in the cloud immediately, and a free user's only on their PC", async () => {
    const paid = await paidUser();
    const free = await freeUser();
    const mPaid = await createMonitor(t.db, paid.id, pageInput(10));
    const mFree = await createMonitor(t.db, free.id, pageInput(11));
    const cloud = await claimCloudJobs(t.db, { workerId: "w1", max: 50 });
    const taskIds = cloud.map((c) => c.taskId);
    expect(taskIds).toContain(mPaid.id);
    expect(taskIds).not.toContain(mFree.id);
    const dev = await device(free.id);
    const agent = await claimAgentJobs(t.db, { userId: free.id, deviceId: dev, max: 3 });
    expect(agent.map((a) => a.taskId)).toEqual([mFree.id]);
  });

  it("never hands a user's jobs to another user's computer", async () => {
    const a = await freeUser();
    const b = await freeUser();
    await createMonitor(t.db, a.id, pageInput(20));
    const devB = await device(b.id);
    const claimed = await claimAgentJobs(t.db, { userId: b.id, deviceId: devB, max: 3 });
    expect(claimed).toHaveLength(0);
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

  it("does not send e-mail alerts on the free plan", async () => {
    const u = await freeUser();
    const dev = await device(u.id);
    const m = await createMonitor(t.db, u.id, pageInput(80));
    const [claim] = await claimAgentJobs(t.db, { userId: u.id, deviceId: dev, max: 1 });
    await submitResult(t.db, { jobId: claim!.jobId, claimToken: claim!.claimToken, executor: "agent", deviceId: dev, durationMs: 50, observation: observation(50) });
    const [n] = await t.db.select().from(notifications).where(eq(notifications.taskId, m.id));
    expect(n!.emailStatus).toBe("skipped");
  });

  it("rejects results from another device than the one holding the claim", async () => {
    const u = await freeUser();
    const dev1 = await device(u.id);
    const dev2 = await device(u.id);
    await createMonitor(t.db, u.id, pageInput(90));
    const [claim] = await claimAgentJobs(t.db, { userId: u.id, deviceId: dev1, max: 1 });
    await expect(
      submitResult(t.db, { jobId: claim!.jobId, claimToken: claim!.claimToken, executor: "agent", deviceId: dev2, durationMs: 1, observation: observation(1) }),
    ).rejects.toBeInstanceOf(StaleClaimError);
  });

  it("suspends local checks of the free plan when the computer stays offline", async () => {
    const u = await freeUser();
    const m = await createMonitor(t.db, u.id, pageInput(100));
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
    const other = await freeUser();
    await expect(deleteMonitor(t.db, other.id, m.id)).rejects.toBeInstanceOf(MonitorError);
    await deleteMonitor(t.db, u.id, m.id);
    expect(await t.db.select().from(monitoringJobs).where(eq(monitoringJobs.taskId, m.id))).toHaveLength(0);
  });
});
