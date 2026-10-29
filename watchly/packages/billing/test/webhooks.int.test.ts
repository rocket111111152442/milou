import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  billingEvents,
  emailOutbox,
  entitlements,
  eq,
  monitoringTasks,
  notifications,
  planAddons,
  plans,
  profiles,
  subscriptions,
  trialUsage,
  sql,
} from "@watchly/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@watchly/database/testing";
import { createSubscriptionCheckout, checkTrialEligibility, previewCheckout } from "../src/checkout";
import { getEntitlements } from "../src/store";
import { handleStripeWebhook, type WebhookDeps } from "../src/webhooks";
import { PLAN_CATALOG } from "../src/catalog";
import { addCard, createFakeStripe, makeSubscription, signedEvent, WEBHOOK_SECRET } from "./fake-stripe";

const PEPPER = "p".repeat(48);
const PRICES = { plus: "price_plus_test", pro: "price_pro_test", business: "price_business_test", extra: "price_extra_test" };

let t: TestDatabase;
let fake: ReturnType<typeof createFakeStripe>;
let deps: WebhookDeps;

beforeAll(async () => {
  t = await createTestDatabase();
  await t.db.update(plans).set({ stripePriceId: PRICES.plus }).where(eq(plans.id, "plus"));
  await t.db.update(plans).set({ stripePriceId: PRICES.pro }).where(eq(plans.id, "pro"));
  await t.db.update(plans).set({ stripePriceId: PRICES.business }).where(eq(plans.id, "business"));
  await t.db.update(planAddons).set({ stripePriceId: PRICES.extra }).where(eq(planAddons.id, "business_extra_site"));
});
afterAll(async () => {
  await t?.drop();
});
beforeEach(() => {
  fake = createFakeStripe();
  deps = { db: t.db, stripe: fake.stripe, webhookSecret: WEBHOOK_SECRET, pepper: PEPPER };
});

async function newCustomer(email?: string) {
  const user = await createTestUser(t, email);
  const customer = `cus_${user.id.slice(0, 8)}`;
  await t.db.update(profiles).set({ stripeCustomerId: customer }).where(eq(profiles.id, user.id));
  return { ...user, customer };
}

function trialSub(u: { id: string; customer: string }, planId: "plus" | "pro" | "business", fingerprint: string) {
  const pm = addCard(fake.state, fingerprint);
  const sub = makeSubscription({
    customer: u.customer,
    priceId: PRICES[planId],
    status: "trialing",
    userId: u.id,
    planId,
    trialEnd: Math.floor(Date.now() / 1000) + 72 * 3600,
    paymentMethod: pm,
  });
  fake.state.subscriptions.set(sub.id, sub);
  return sub;
}

function checkoutCompleted(u: { id: string; customer: string }, subId: string) {
  return signedEvent(fake.stripe, "checkout.session.completed", {
    id: `cs_${subId}`,
    object: "checkout.session",
    mode: "subscription",
    customer: u.customer,
    subscription: subId,
    client_reference_id: u.id,
    metadata: { watchly_user_id: u.id },
  });
}

describe("catalog", () => {
  it("matches the plans seeded in the database", async () => {
    const rows = await t.db.select().from(plans);
    for (const r of rows) {
      const c = PLAN_CATALOG[r.id as keyof typeof PLAN_CATALOG];
      expect(c, r.id).toBeDefined();
      expect({ price: r.priceCents, max: r.maxMonitors, topics: r.maxWebTopics, interval: r.pageIntervalMinutes, sites: r.businessSitesIncluded }).toEqual({
        price: c.priceCents,
        max: c.maxMonitors,
        topics: c.maxWebTopics,
        interval: c.pageIntervalMinutes,
        sites: c.businessSitesIncluded,
      });
    }
  });
});

describe("stripe webhooks", () => {
  it("rejects unsigned or tampered payloads", async () => {
    const u = await newCustomer();
    const sub = trialSub(u, "plus", "fp_tamper");
    const { payload, signature } = checkoutCompleted(u, sub.id);
    expect((await handleStripeWebhook(deps, payload, null)).status).toBe(400);
    expect((await handleStripeWebhook(deps, payload.replace("trialing", "active") + " ", signature)).status).toBe(400);
    const forged = signature.replace(/v1=[a-f0-9]+/, "v1=" + "0".repeat(64));
    expect((await handleStripeWebhook(deps, payload, forged)).status).toBe(400);
  });

  it("starts a 72h trial with restricted quotas, records trial usage and notifies once", async () => {
    const u = await newCustomer("trial.user@example.test");
    const sub = trialSub(u, "pro", "fp_unique_1");
    const ev = checkoutCompleted(u, sub.id);
    const res = await handleStripeWebhook(deps, ev.payload, ev.signature);
    expect(res).toMatchObject({ status: 200, body: { status: "processed" } });

    const [row] = await t.db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, sub.id));
    expect(row).toMatchObject({ status: "trialing", planId: "pro", userId: u.id });
    const e = await getEntitlements(t.db, u.id);
    expect(e).toMatchObject({ source: "trial", planId: "pro", maxMonitors: 3, maxWebTopics: 1 });
    const usage = await t.db.select().from(trialUsage).where(eq(trialUsage.userId, u.id));
    expect(usage).toHaveLength(1);
    expect(usage[0]!.emailHash).not.toContain("trial.user");
    expect(usage[0]!.cardFingerprintHash).not.toContain("fp_unique_1");

    // Rejeu du même événement : acquitté sans retraitement
    const replay = await handleStripeWebhook(deps, ev.payload, ev.signature);
    expect(replay.body).toMatchObject({ duplicate: true });
    const notifs = await t.db.select().from(notifications).where(eq(notifications.userId, u.id));
    expect(notifs.filter((n) => n.type === "trial")).toHaveLength(1);
    const emails = await t.db.select().from(emailOutbox).where(eq(emailOutbox.userId, u.id));
    expect(emails).toHaveLength(1);
    expect(emails[0]!.subject).toMatch(/essai/i);
  });

  it("processes concurrent deliveries of the same event exactly once", async () => {
    const u = await newCustomer();
    const sub = trialSub(u, "plus", "fp_concurrent");
    const ev = checkoutCompleted(u, sub.id);
    const results = await Promise.all(Array.from({ length: 5 }, () => handleStripeWebhook(deps, ev.payload, ev.signature)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.duplicate === false)).toHaveLength(1);
    const [event] = await t.db.select().from(billingEvents).where(eq(billingEvents.id, ev.event.id));
    expect(event!.status).toBe("processed");
    const usage = await t.db.select().from(trialUsage).where(eq(trialUsage.userId, u.id));
    expect(usage).toHaveLength(1);
  });

  it("blocks a second trial with the same card on another account without any charge", async () => {
    const first = await newCustomer();
    const s1 = trialSub(first, "plus", "fp_shared_card");
    let ev = checkoutCompleted(first, s1.id);
    await handleStripeWebhook(deps, ev.payload, ev.signature);

    const second = await newCustomer();
    const s2 = trialSub(second, "pro", "fp_shared_card");
    ev = checkoutCompleted(second, s2.id);
    const res = await handleStripeWebhook(deps, ev.payload, ev.signature);
    expect(res.status).toBe(200);
    expect(fake.state.calls.some((c) => c.method === "subscriptions.cancel" && c.args[0] === s2.id)).toBe(true);
    const [row] = await t.db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, s2.id));
    expect(row!.status).toBe("canceled");
    expect((await getEntitlements(t.db, second.id)).planId).toBe("discovery");
    const blocked = await t.db.select().from(trialUsage).where(eq(trialUsage.userId, second.id));
    expect(blocked.map((b) => b.status)).toEqual(["blocked_duplicate"]);
    const n = await t.db.select().from(notifications).where(eq(notifications.userId, second.id));
    expect(n.map((x) => x.title)).toContain("Essai gratuit déjà utilisé");
  });

  it("applies the latest Stripe state even when events arrive out of order", async () => {
    const u = await newCustomer();
    const sub = trialSub(u, "plus", "fp_order");
    // Stripe a déjà annulé l'abonnement ; l'ancien événement « created » arrive en retard.
    fake.state.subscriptions.set(sub.id, { ...sub, status: "canceled", ended_at: Math.floor(Date.now() / 1000) });
    const late = signedEvent(fake.stripe, "customer.subscription.created", sub, { created: Math.floor(Date.now() / 1000) - 60 });
    await handleStripeWebhook(deps, late.payload, late.signature);
    const [row] = await t.db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, sub.id));
    expect(row!.status).toBe("canceled");
    expect((await getEntitlements(t.db, u.id)).planId).toBe("discovery");
  });

  it("activates full quotas after the first successful payment and marks the trial converted", async () => {
    const u = await newCustomer();
    const sub = trialSub(u, "business", "fp_convert");
    let ev = checkoutCompleted(u, sub.id);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    expect((await getEntitlements(t.db, u.id)).businessSites).toBe(1);

    fake.state.subscriptions.set(sub.id, { ...sub, status: "active", trial_end: Math.floor(Date.now() / 1000) });
    ev = signedEvent(fake.stripe, "invoice.paid", {
      id: "in_convert",
      object: "invoice",
      customer: u.customer,
      amount_paid: 3999,
      parent: { subscription_details: { subscription: sub.id, metadata: { watchly_user_id: u.id } } },
    });
    expect((await handleStripeWebhook(deps, ev.payload, ev.signature)).status).toBe(200);
    const e = await getEntitlements(t.db, u.id);
    expect(e).toMatchObject({ source: "subscription", maxMonitors: 100, businessSites: 1 });
    const [usage] = await t.db.select().from(trialUsage).where(eq(trialUsage.userId, u.id));
    expect(usage!.status).toBe("converted");
    const [p] = await t.db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, u.id));
    expect(p!.role).toBe("business");
    // Le montant encaissé est conservé pour le suivi du chiffre d'affaires (administration).
    const [evt] = await t.db.execute<{ summary: { amount_paid: number; livemode: boolean } }>(sql`select summary from billing_events where type = 'invoice.paid' and summary->>'id' = 'in_convert'`);
    expect(evt!.summary).toMatchObject({ amount_paid: 3999, livemode: false });
  });

  it("pauses monitors above quota when the subscription ends, then resumes them on upgrade", async () => {
    const u = await newCustomer();
    const sub = makeSubscription({ customer: u.customer, priceId: PRICES.plus, status: "active", userId: u.id, planId: "plus" });
    fake.state.subscriptions.set(sub.id, sub);
    let ev = signedEvent(fake.stripe, "customer.subscription.created", sub);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    for (let i = 0; i < 5; i++) {
      await t.db.insert(monitoringTasks).values({ userId: u.id, kind: "page", name: `m${i}`, condition: { type: "page_changed" } });
    }
    fake.state.subscriptions.set(sub.id, { ...sub, status: "canceled" });
    ev = signedEvent(fake.stripe, "customer.subscription.deleted", sub);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    let tasks = await t.db.select().from(monitoringTasks).where(eq(monitoringTasks.userId, u.id));
    expect(tasks.filter((x) => x.status === "paused_quota")).toHaveLength(2);
    expect(tasks.filter((x) => x.status === "active")).toHaveLength(3);

    const sub2 = makeSubscription({ customer: u.customer, priceId: PRICES.pro, status: "active", userId: u.id, planId: "pro" });
    fake.state.subscriptions.set(sub2.id, sub2);
    ev = signedEvent(fake.stripe, "customer.subscription.created", sub2);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    tasks = await t.db.select().from(monitoringTasks).where(eq(monitoringTasks.userId, u.id));
    expect(tasks.every((x) => x.status === "active")).toBe(true);
  });

  it("notifies a payment failure and keeps a grace period", async () => {
    const u = await newCustomer();
    const sub = makeSubscription({ customer: u.customer, priceId: PRICES.plus, status: "past_due", userId: u.id, planId: "plus", periodEnd: Math.floor(Date.now() / 1000) - 86400 });
    fake.state.subscriptions.set(sub.id, sub);
    const ev = signedEvent(fake.stripe, "invoice.payment_failed", {
      id: "in_failed_1",
      object: "invoice",
      customer: u.customer,
      amount_paid: 0,
      parent: { subscription_details: { subscription: sub.id, metadata: { watchly_user_id: u.id } } },
    });
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    expect((await getEntitlements(t.db, u.id)).source).toBe("grace");
    const n = await t.db.select().from(notifications).where(eq(notifications.userId, u.id));
    expect(n.some((x) => x.title.includes("Échec du paiement") && x.priority === "high")).toBe(true);
  });

  it("ignores unrelated event types but records them", async () => {
    const ev = signedEvent(fake.stripe, "customer.created", { id: "cus_x", object: "customer" });
    const res = await handleStripeWebhook(deps, ev.payload, ev.signature);
    expect(res.body).toMatchObject({ status: "ignored" });
  });

  it("returns 500 (so Stripe retries) and records the failure when processing fails", async () => {
    const ev = signedEvent(fake.stripe, "customer.subscription.updated", {
      id: "sub_unknown",
      object: "subscription",
      customer: "cus_nobody",
      metadata: {},
    });
    const res = await handleStripeWebhook(deps, ev.payload, ev.signature);
    expect(res.status).toBe(500);
    const [row] = await t.db.select().from(billingEvents).where(eq(billingEvents.id, ev.event.id));
    expect(row!.status).toBe("failed");
  });
});

describe("checkout", () => {
  it("creates a Checkout session with a 72h trial for an eligible user and shows the first charge date", async () => {
    const u = await createTestUser(t, "checkout.ok@example.test");
    const now = new Date("2026-11-02T10:00:00Z");
    const preview = await previewCheckout(t.db, u, "pro", now, PEPPER);
    expect(preview).toMatchObject({ trial: true, trialHours: 72, priceCents: 1499 });
    expect(preview.firstChargeAt.toISOString()).toBe("2026-11-05T10:00:00.000Z");

    const res = await createSubscriptionCheckout(t.db, fake.stripe, { userId: u.id, email: u.email, planId: "pro", appUrl: "https://app.test", now, pepper: PEPPER });
    expect(res.trialEnd?.toISOString()).toBe("2026-11-05T10:00:00.000Z");
    const call = fake.state.calls.find((c) => c.method === "checkout.sessions.create")!;
    const params = call.args[0] as Record<string, any>;
    expect(params).toMatchObject({
      mode: "subscription",
      payment_method_collection: "always",
      client_reference_id: u.id,
      line_items: [{ price: PRICES.pro, quantity: 1 }],
    });
    expect(params.subscription_data.trial_end).toBe(Math.floor(now.getTime() / 1000) + 72 * 3600);
    expect(params.subscription_data.trial_settings.end_behavior.missing_payment_method).toBe("cancel");
    const [p] = await t.db.select({ c: profiles.stripeCustomerId }).from(profiles).where(eq(profiles.id, u.id));
    expect(p!.c).toMatch(/^cus_/);
  });

  it("does not offer a second trial to the same (aliased) e-mail", async () => {
    const a = await newCustomer("Jane.Doe@gmail.com");
    const sub = trialSub(a, "plus", "fp_alias");
    const ev = checkoutCompleted(a, sub.id);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    const b = await createTestUser(t, "janedoe+again@gmail.com");
    expect(await checkTrialEligibility(t.db, b.id, b.email, PEPPER)).toEqual({ eligible: false, reason: "already_used" });
    await createSubscriptionCheckout(t.db, fake.stripe, { userId: b.id, email: b.email, planId: "plus", appUrl: "https://app.test", pepper: PEPPER });
    const params = fake.state.calls.find((c) => c.method === "checkout.sessions.create")!.args[0] as Record<string, any>;
    expect(params.subscription_data.trial_end).toBeUndefined();
  });

  it("refuses a second checkout while a subscription is live", async () => {
    const u = await newCustomer();
    const sub = trialSub(u, "plus", "fp_live");
    const ev = checkoutCompleted(u, sub.id);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    await expect(
      createSubscriptionCheckout(t.db, fake.stripe, { userId: u.id, email: u.email, planId: "pro", appUrl: "https://app.test", pepper: PEPPER }),
    ).rejects.toThrow(/déjà un abonnement/);
  });

  it("never lets a client-provided plan id bypass validation", async () => {
    const u = await createTestUser(t);
    await expect(
      createSubscriptionCheckout(t.db, fake.stripe, { userId: u.id, email: u.email, planId: "discovery", appUrl: "https://app.test", pepper: PEPPER }),
    ).rejects.toThrow(/Formule inconnue/);
    await expect(
      createSubscriptionCheckout(t.db, fake.stripe, { userId: u.id, email: u.email, planId: "admin'--", appUrl: "https://app.test", pepper: PEPPER }),
    ).rejects.toThrow(/Formule inconnue/);
    const ent = await t.db.select().from(entitlements).where(eq(entitlements.userId, u.id));
    expect(ent.every((e) => e.planId === "discovery")).toBe(true);
  });
});
