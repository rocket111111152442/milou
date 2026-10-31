import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { adminAuditLogs, betaGrants, entitlements, eq, profiles } from "@waverti/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import { applyInvitation } from "../src/lib/beta-apply";

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
  process.env.WAVERTI_SIGNUP_ALLOWLIST = "invite@example.test, chef@example.test";
  process.env.WAVERTI_BETA_AUTO_GRANT = "pro:30";
  process.env.WAVERTI_BOOTSTRAP_ADMINS = "chef@example.test";
});
afterAll(async () => {
  delete process.env.WAVERTI_SIGNUP_ALLOWLIST;
  delete process.env.WAVERTI_BETA_AUTO_GRANT;
  delete process.env.WAVERTI_BOOTSTRAP_ADMINS;
  await t?.drop();
});

describe("invitation à la confirmation de l'adresse", () => {
  it("accès bêta limité pour une adresse invitée, une seule fois", async () => {
    const u = await createTestUser(t, "invite@example.test");
    await applyInvitation(t.db, u.id);
    await applyInvitation(t.db, u.id);
    const grants = await t.db.select().from(betaGrants).where(eq(betaGrants.userId, u.id));
    expect(grants).toHaveLength(1);
    expect(grants[0]!.planId).toBe("pro");
    const [e] = await t.db.select().from(entitlements).where(eq(entitlements.userId, u.id));
    expect(e).toMatchObject({ source: "admin_grant", maxMonitors: 10 });
    const [p] = await t.db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, u.id));
    expect(p!.role).toBe("user");
  });

  it("administrateur d'amorçage : rôle admin conservé après le calcul des droits", async () => {
    const u = await createTestUser(t, "chef@example.test");
    await applyInvitation(t.db, u.id);
    const [p] = await t.db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, u.id));
    expect(p!.role).toBe("admin");
    const logs = await t.db.select({ action: adminAuditLogs.action }).from(adminAuditLogs).where(eq(adminAuditLogs.targetId, u.id));
    expect(logs.map((l) => l.action).sort()).toEqual(["beta.grant", "user.grant_admin"]);
  });

  it("rien pour une adresse non invitée", async () => {
    const u = await createTestUser(t, "autre@example.test");
    await applyInvitation(t.db, u.id);
    expect(await t.db.select().from(betaGrants).where(eq(betaGrants.userId, u.id))).toHaveLength(0);
  });
});
