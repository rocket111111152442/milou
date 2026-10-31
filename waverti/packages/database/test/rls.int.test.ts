import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pgErrorCode, withUser } from "../src/client";
import { agentDevices, monitoringTasks, notifications, profiles } from "../src/schema";
import { createTestDatabase, createTestUser, type TestDatabase } from "../src/testing";

let t: TestDatabase;
let alice: { id: string };
let bob: { id: string };

async function expectDenied(run: () => Promise<unknown>) {
  const err = await run().then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, "expected a permission error").not.toBeNull();
  expect(pgErrorCode(err)).toBe("42501");
}

beforeAll(async () => {
  t = await createTestDatabase();
  alice = await createTestUser(t, "alice@example.test");
  bob = await createTestUser(t, "bob@example.test");
  for (const u of [alice, bob]) {
    await t.db.insert(monitoringTasks).values({
      userId: u.id,
      kind: "page",
      name: `task of ${u.id}`,
      condition: { type: "page_changed" },
    });
    await t.db.insert(notifications).values({ userId: u.id, type: "system", title: "t", body: "b" });
    await t.db.insert(agentDevices).values({
      userId: u.id,
      name: "PC",
      platform: "linux",
      tokenHash: `hash-${u.id}`,
      status: "active",
      monitoringEnabled: false,
    });
  }
});

afterAll(async () => {
  await t?.drop();
});

describe("row level security", () => {
  it("a user only sees their own monitoring tasks", async () => {
    const rows = await withUser(t.db, alice.id, (tx) => tx.select().from(monitoringTasks));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(alice.id);
  });

  it("a user only sees their own notifications and profile", async () => {
    const n = await withUser(t.db, bob.id, (tx) => tx.select().from(notifications));
    expect(n.length).toBeGreaterThan(0);
    expect(n.every((r) => r.userId === bob.id)).toBe(true);
    const p = await withUser(t.db, bob.id, (tx) => tx.select().from(profiles));
    expect(p.map((r) => r.id)).toEqual([bob.id]);
  });

  it("app_user cannot write tasks directly (quotas are enforced server-side)", async () => {
    await expectDenied(() =>
      withUser(t.db, alice.id, (tx) =>
        tx.insert(monitoringTasks).values({ userId: alice.id, kind: "page", name: "bypass", condition: {} }),
      ),
    );
  });

  it("app_user cannot escalate its role", async () => {
    await expectDenied(() =>
      withUser(t.db, alice.id, (tx) => tx.execute(sql`update profiles set role = 'admin' where id = ${alice.id}`)),
    );
  });

  it("app_user cannot read device token hashes", async () => {
    await expectDenied(() =>
      withUser(t.db, alice.id, (tx) => tx.select({ h: agentDevices.tokenHash }).from(agentDevices)),
    );
    const ok = await withUser(t.db, alice.id, (tx) =>
      tx.select({ id: agentDevices.id, name: agentDevices.name }).from(agentDevices),
    );
    expect(ok).toHaveLength(1);
  });

  it("app_user without a current user sees public plans only, and no one else's rows", async () => {
    const plans = await t.db.transaction(async (tx) => {
      await tx.execute(sql`set local role app_user`);
      return tx.execute(sql`select id from plans`);
    });
    expect(plans.length).toBe(4);
    const tasks = await t.db.transaction(async (tx) => {
      await tx.execute(sql`set local role app_user`);
      return tx.execute(sql`select id from monitoring_tasks`);
    });
    expect(tasks.length).toBe(0);
  });

  it("identity tables (password hashes, sessions, tokens, recovery codes) are never readable by app_user", async () => {
    for (const table of ["users", "user_sessions", "auth_tokens", "mfa_recovery_codes"]) {
      await expectDenied(() => withUser(t.db, alice.id, (tx) => tx.execute(sql.raw(`select * from ${table} limit 1`))));
    }
  });

  it("operational tables are not readable by app_user", async () => {
    for (const table of [
      "billing_events",
      "api_usage",
      "admin_audit_logs",
      "app_settings",
      "search_cache",
      "page_cache",
      "email_outbox",
      "trial_usage",
      "worker_heartbeats",
      "rate_limits",
    ]) {
      await expectDenied(() => withUser(t.db, alice.id, (tx) => tx.execute(sql.raw(`select * from ${table} limit 1`))));
    }
  });

  it("rejects malformed user ids before touching the database", async () => {
    await expect(withUser(t.db, "1 or 1=1", async () => 1)).rejects.toThrow(/invalid user id/);
  });
});
