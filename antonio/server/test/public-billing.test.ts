import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db, schema, closeDb } from "../src/db/client.js";
import { createSession, register, SESSION_COOKIE } from "../src/auth/service.js";
import { config, resetConfigForTests } from "../src/config.js";
import { assertPlanUsage, checkoutFor, refreshSubscription } from "../src/billing/service.js";
import { makeUser } from "./helpers.js";

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); });
afterAll(async () => { await app.close(); await closeDb(); delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_WEBHOOK_SECRET; delete process.env.BILLING_ENABLED; resetConfigForTests(); });
const cookie = async (user: { userId: string; orgId: string }) => `${SESSION_COOKIE}=${await createSession(user.userId, user.orgId)}`;

describe("Public accounts and billing", () => {
  it("exposes service availability without secrets or authentication", async () => {
    const res = await app.inject({ url: "/api/public/status" });
    expect(res.statusCode).toBe(200);
    expect(res.json().billingEnabled).toBe(false);
    expect(res.json().offers.map((p: { euros: number }) => p.euros)).toEqual([20, 49, 99]);
    expect(res.body).not.toContain("SECRET");
  });
  it("stores a plan preference without activating a paid subscription", async () => {
    const { user } = await register({ email: `plan-${Date.now()}@test.example`, password: "motdepasse-solide", displayName: "Client", withDemo: false, requestedPlan: "pro" });
    const [row] = await db().select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id));
    expect(row.requestedPlan).toBe("pro"); expect(row.plan).toBeNull(); expect(row.status).toBe("early_access");
  });
  it("requires authentication for checkout and does not charge while disabled", async () => {
    expect((await app.inject({ method: "POST", url: "/api/billing/checkout", payload: { plan: "pro", requestId: "b00dca29-b874-4d87-887c-4a611e94b832" } })).statusCode).toBe(401);
    const actor = await makeUser();
    const res = await app.inject({ method: "POST", url: "/api/billing/checkout", headers: { cookie: await cookie(actor) }, payload: { plan: "pro", requestId: "b00dca29-b874-4d87-887c-4a611e94b832" } });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("billing_unavailable");
  });
  it("rejects forged Stripe signatures and accepts an identical signed event idempotently", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_local_fixture";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_local_fixture";
    resetConfigForTests();
    const payload = JSON.stringify({ id: "evt_local_once", object: "event", type: "checkout.session.completed", data: { object: { subscription: null } } });
    const forged = await app.inject({ method: "POST", url: "/api/webhooks/stripe", headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=forged" }, payload });
    expect(forged.statusCode).toBe(400);
    const signature = new Stripe(config().STRIPE_SECRET_KEY!).webhooks.generateTestHeaderString({ payload, secret: config().STRIPE_WEBHOOK_SECRET! });
    for (let i = 0; i < 2; i++) expect((await app.inject({ method: "POST", url: "/api/webhooks/stripe", headers: { "content-type": "application/json", "stripe-signature": signature }, payload })).statusCode).toBe(200);
    const rows = await db().select().from(schema.billingEvents).where(eq(schema.billingEvents.id, "evt_local_once"));
    expect(rows).toHaveLength(1);
    delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_WEBHOOK_SECRET; resetConfigForTests();
  });
  it("does not grant paid features to an inactive subscription", async () => {
    process.env.BILLING_ENABLED = "true"; process.env.STRIPE_SECRET_KEY = "sk_test_local_fixture"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_local_fixture"; resetConfigForTests();
    try {
      const actor = await makeUser();
      await expect(assertPlanUsage(actor.userId, "voice")).rejects.toMatchObject({ code: "subscription_required" });
      await db().update(schema.subscriptions).set({ plan: "essentiel", status: "active" }).where(eq(schema.subscriptions.userId, actor.userId));
      await expect(assertPlanUsage(actor.userId, "voice")).rejects.toMatchObject({ code: "voice_limit" });
    } finally { delete process.env.BILLING_ENABLED; delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_WEBHOOK_SECRET; resetConfigForTests(); }
  });
});

describe("Read-only integration API", () => {
  it("limits a token to its owner and makes revocation effective immediately", async () => {
    const owner = await makeUser("Propriétaire");
    const other = await makeUser("Autre entreprise");
    await db().insert(schema.tasks).values([{ orgId: owner.orgId, userId: owner.userId, title: "Tâche visible" }, { orgId: other.orgId, userId: other.userId, title: "Secret autre compte" }]);
    const ownerCookie = await cookie(owner);
    const created = await app.inject({ method: "POST", url: "/api/integrations/tokens", headers: { cookie: ownerCookie }, payload: { name: "Mon outil" } });
    expect(created.statusCode).toBe(200);
    const { id, token } = created.json();
    const list = await app.inject({ url: "/api/integrations/tokens", headers: { cookie: ownerCookie } });
    expect(list.body).not.toContain(token);
    const data = await app.inject({ url: "/api/integrations/export", headers: { authorization: `Bearer ${token}` } });
    expect(data.statusCode).toBe(200); expect(data.body).toContain("Tâche visible"); expect(data.body).not.toContain("Secret autre compte");
    expect((await app.inject({ method: "DELETE", url: `/api/integrations/tokens/${id}`, headers: { cookie: await cookie(other) } })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/api/integrations/tokens/${id}`, headers: { cookie: ownerCookie } })).statusCode).toBe(200);
    expect((await app.inject({ url: "/api/integrations/export", headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401);
  });
  it("rejects invalid and expired tokens", async () => {
    expect((await app.inject({ url: "/api/integrations/export", headers: { authorization: "Bearer wvt_fake" } })).statusCode).toBe(401);
    const actor = await makeUser(); const actorCookie = await cookie(actor);
    const created = (await app.inject({ method: "POST", url: "/api/integrations/tokens", headers: { cookie: actorCookie }, payload: { name: "Expiré" } })).json();
    await db().update(schema.integrationTokens).set({ expiresAt: new Date(0) }).where(eq(schema.integrationTokens.id, created.id));
    expect((await app.inject({ url: "/api/integrations/export", headers: { authorization: `Bearer ${created.token}` } })).statusCode).toBe(401);
  });
});

describe("Stripe concurrency and delayed events", () => {
  it("reuses one checkout for concurrent requests and computes the price on the server", async () => {
    const actor = await makeUser();
    process.env.BILLING_ENABLED = "true"; process.env.STRIPE_SECRET_KEY = "sk_test_fixture"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture"; resetConfigForTests();
    const pending: unknown[] = [];
    const create = vi.fn(async (params) => { expect(params.line_items[0].price_data.unit_amount).toBe(4900); const session = { id: "cs_once", url: "https://checkout.stripe.com/test-fixture", metadata: { waverti_user_id: actor.userId, waverti_plan: "pro" }, mode: "subscription" }; pending.push(session); return session; });
    const client = { customers: { create: vi.fn(async () => ({ id: `cus_${actor.userId}` })) }, subscriptions: { list: vi.fn(async () => ({ data: [] })) }, checkout: { sessions: { list: vi.fn(async () => ({ data: pending })), create, expire: vi.fn() } } } as unknown as Stripe;
    try {
      const results = await Promise.all([checkoutFor({ ...actor, email: actor.email }, "pro", "first", client), checkoutFor({ ...actor, email: actor.email }, "pro", "second", client)]);
      expect(create).toHaveBeenCalledTimes(1); expect(results[0].url).toBe(results[1].url);
    } finally { delete process.env.BILLING_ENABLED; delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_WEBHOOK_SECRET; resetConfigForTests(); }
  });
  it("does not let the cancellation of an old subscription overwrite the current one", async () => {
    const actor = await makeUser();
    await db().update(schema.subscriptions).set({ stripeSubscriptionId: "sub_new_fixture", plan: "pro", status: "active" }).where(eq(schema.subscriptions.userId, actor.userId));
    const client = { subscriptions: { retrieve: vi.fn(async (id: string) => id === "sub_old_fixture" ? { id, created: 100, status: "canceled", customer: "cus_old_fixture", metadata: { waverti_user_id: actor.userId, waverti_plan: "essentiel" } } : { id, created: 200, status: "active" }) } } as unknown as Stripe;
    await refreshSubscription("sub_old_fixture", client);
    const [row] = await db().select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, actor.userId));
    expect(row.status).toBe("active"); expect(row.plan).toBe("pro"); expect(row.stripeSubscriptionId).toBe("sub_new_fixture");
  });
});
