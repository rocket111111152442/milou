import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  billingEvents,
  emailOutbox,
  entitlements,
  eq,
  monitoringTasks,
  notifications,
  plans,
  profiles,
  subscriptions,
  trialUsage,
  sql,
} from "@waverti/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import { createSubscriptionCheckout, checkTrialEligibility, previewCheckout } from "../src/checkout";
import { getEntitlements } from "../src/store";
import { handleStripeWebhook, type WebhookDeps } from "../src/webhooks";
import { PLAN_CATALOG } from "../src/catalog";
import { loadCurrentSubscription } from "../src/store";
import { searchQuotaWindow } from "../src/search-quota";
import { addCard, createFakeStripe, makeSubscription, signedEvent, WEBHOOK_SECRET } from "./fake-stripe";

const PEPPER = "p".repeat(48);
const PRICES = { plus: "price_plus_test", pro: "price_pro_test", max: "price_max_test", business: "price_business_test" };

let t: TestDatabase;
let fake: ReturnType<typeof createFakeStripe>;
let deps: WebhookDeps;

beforeAll(async () => {
  t = await createTestDatabase();
  await t.db.update(plans).set({ stripePriceId: PRICES.plus }).where(eq(plans.id, "plus"));
  await t.db.update(plans).set({ stripePriceId: PRICES.pro }).where(eq(plans.id, "pro"));
  await t.db.update(plans).set({ stripePriceId: PRICES.business }).where(eq(plans.id, "business"));
  await t.db.update(plans).set({ stripePriceId: PRICES.max }).where(eq(plans.id, "max"));
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
    metadata: { waverti_user_id: u.id },
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
    expect((await getEntitlements(t.db, second.id)).planId).toBeNull();
    const blocked = await t.db.select().from(trialUsage).where(eq(trialUsage.userId, second.id));
    expect(blocked.map((b) => b.status)).toEqual(["blocked_duplicate"]);
    const n = await t.db.select().from(notifications).where(eq(notifications.userId, second.id));
    expect(n.map((x) => x.title)).toContain("Essai gratuit déjà utilisé");
  });

  describe("trial check is independent of event order", () => {
    const subCreated = (sub: ReturnType<typeof trialSub>) => signedEvent(fake.stripe, "customer.subscription.created", sub);
    const trialStartedCount = async (userId: string) =>
      (await t.db.select().from(notifications).where(eq(notifications.userId, userId))).filter((n) => n.title.includes("essai Waverti") && n.title.includes("a commencé"))
        .length;

    it("valid trial: subscription.created first, then checkout.session.completed → one start notice, one trial row", async () => {
      const u = await newCustomer("order.valid@example.test");
      const sub = trialSub(u, "plus", "fp_order_valid");
      const a = subCreated(sub);
      await handleStripeWebhook(deps, a.payload, a.signature);
      const b = checkoutCompleted(u, sub.id);
      await handleStripeWebhook(deps, b.payload, b.signature);
      expect(await trialStartedCount(u.id)).toBe(1);
      expect(await t.db.select().from(trialUsage).where(eq(trialUsage.userId, u.id))).toHaveLength(1);
      expect((await getEntitlements(t.db, u.id)).source).toBe("trial");
    });

    it("valid trial: checkout first, then subscription.created (and a replayed created) → still one start notice", async () => {
      const u = await newCustomer("order.valid2@example.test");
      const sub = trialSub(u, "plus", "fp_order_valid2");
      const b = checkoutCompleted(u, sub.id);
      await handleStripeWebhook(deps, b.payload, b.signature);
      const a = subCreated(sub);
      await handleStripeWebhook(deps, a.payload, a.signature);
      await handleStripeWebhook(deps, a.payload, a.signature);
      expect(await trialStartedCount(u.id)).toBe(1);
      expect(await t.db.select().from(trialUsage).where(eq(trialUsage.userId, u.id))).toHaveLength(1);
    });

    for (const order of ["created-first", "checkout-first"] as const) {
      it(`refused trial (${order}): never announces a start, cancels once, no charge confirmed by invoices`, async () => {
        const first = await newCustomer();
        const s1 = trialSub(first, "plus", `fp_refused_${order}`);
        const ev1 = checkoutCompleted(first, s1.id);
        await handleStripeWebhook(deps, ev1.payload, ev1.signature);

        const second = await newCustomer();
        const s2 = trialSub(second, "pro", `fp_refused_${order}`);
        fake.state.invoices = [{ subscription: s2.id, amount_paid: 0 }];
        const created = subCreated(s2);
        const done = checkoutCompleted(second, s2.id);
        const seq = order === "created-first" ? [created, done] : [done, created];
        for (const e of seq) expect((await handleStripeWebhook(deps, e.payload, e.signature)).status).toBe(200);
        // doublons
        for (const e of seq) await handleStripeWebhook(deps, e.payload, e.signature);

        expect(await trialStartedCount(second.id)).toBe(0);
        expect(fake.state.calls.filter((c) => c.method === "subscriptions.cancel" && c.args[0] === s2.id)).toHaveLength(1);
        expect((await t.db.select().from(trialUsage).where(eq(trialUsage.userId, second.id))).map((r) => r.status)).toEqual(["blocked_duplicate"]);
        expect((await getEntitlements(t.db, second.id)).planId).toBeNull();
        const notice = (await t.db.select().from(notifications).where(eq(notifications.userId, second.id))).filter((n) => n.title === "Essai gratuit déjà utilisé");
        expect(notice).toHaveLength(1);
        expect(notice[0]!.body).toContain("Aucun prélèvement n'a été effectué");
      });
    }

    it("refused trial: no 'no charge' claim when an invoice shows a payment", async () => {
      const first = await newCustomer();
      await handleStripeWebhook(deps, ...(((e) => [e.payload, e.signature] as const)(checkoutCompleted(first, trialSub(first, "plus", "fp_paid").id))));
      const second = await newCustomer();
      const s2 = trialSub(second, "plus", "fp_paid");
      fake.state.invoices = [{ subscription: s2.id, amount_paid: 599 }];
      const e = checkoutCompleted(second, s2.id);
      await handleStripeWebhook(deps, e.payload, e.signature);
      const [n] = (await t.db.select().from(notifications).where(eq(notifications.userId, second.id))).filter((x) => x.title === "Essai gratuit déjà utilisé");
      expect(n!.body).not.toContain("Aucun prélèvement n'a été effectué");
    });
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
    expect((await getEntitlements(t.db, u.id)).planId).toBeNull();
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
      parent: { subscription_details: { subscription: sub.id, metadata: { waverti_user_id: u.id } } },
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

  it("pauses every monitor when the subscription ends (no free plan), then resumes them on resubscription", async () => {
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
    expect(tasks.filter((x) => x.status === "paused_quota")).toHaveLength(5);
    expect((await getEntitlements(t.db, u.id)).planId).toBeNull();

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
      parent: { subscription_details: { subscription: sub.id, metadata: { waverti_user_id: u.id } } },
    });
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    expect((await getEntitlements(t.db, u.id)).source).toBe("grace");
    const n = await t.db.select().from(notifications).where(eq(notifications.userId, u.id));
    expect(n.some((x) => x.title.includes("Échec du paiement") && x.priority === "high")).toBe(true);
  });

  it("plan change mid-period (Plus → Max → Pro): quotas follow immediately, search counter period unchanged", async () => {
    const u = await newCustomer();
    const sub = makeSubscription({ customer: u.customer, priceId: PRICES.plus, status: "active", userId: u.id, planId: "plus" });
    fake.state.subscriptions.set(sub.id, sub);
    let ev = signedEvent(fake.stripe, "customer.subscription.created", sub);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    const before = await getEntitlements(t.db, u.id);
    expect(before).toMatchObject({ planId: "plus", maxWebTopics: 3 });
    const w1 = searchQuotaWindow(before, await loadCurrentSubscription(t.db, u.id));

    for (const [planId, price, topics] of [["max", PRICES.max, 20], ["pro", PRICES.pro, 10]] as const) {
      const changed = { ...sub, metadata: { ...sub.metadata, plan_id: planId }, items: { ...sub.items, data: [{ ...sub.items.data[0]!, price: { id: price, object: "price" } }] } } as unknown as typeof sub;
      fake.state.subscriptions.set(sub.id, changed);
      ev = signedEvent(fake.stripe, "customer.subscription.updated", changed);
      expect((await handleStripeWebhook(deps, ev.payload, ev.signature)).status).toBe(200);
      const e = await getEntitlements(t.db, u.id);
      expect(e).toMatchObject({ planId, maxWebTopics: topics });
      const w = searchQuotaWindow(e, await loadCurrentSubscription(t.db, u.id));
      expect(w.period).toBe(w1.period);
      expect(w.limit).toBe(Math.round((PLAN_CATALOG[planId].monthlySearchCalls * w.days) / 30));
    }
  });

  it("scheduled cancellation keeps access until the period end, then removes it", async () => {
    const u = await newCustomer();
    const sub = makeSubscription({ customer: u.customer, priceId: PRICES.pro, status: "active", userId: u.id, planId: "pro" });
    fake.state.subscriptions.set(sub.id, sub);
    let ev = signedEvent(fake.stripe, "customer.subscription.created", sub);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    const scheduled = { ...sub, cancel_at_period_end: true } as typeof sub;
    fake.state.subscriptions.set(sub.id, scheduled);
    ev = signedEvent(fake.stripe, "customer.subscription.updated", scheduled);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    expect(await getEntitlements(t.db, u.id)).toMatchObject({ planId: "pro", source: "subscription" });
    const [row] = await t.db.select({ c: subscriptions.cancelAtPeriodEnd }).from(subscriptions).where(eq(subscriptions.userId, u.id));
    expect(row!.c).toBe(true);
    fake.state.subscriptions.set(sub.id, { ...scheduled, status: "canceled" });
    ev = signedEvent(fake.stripe, "customer.subscription.deleted", scheduled);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    expect((await getEntitlements(t.db, u.id)).planId).toBeNull();
  });

  it("renewal: a paid invoice for the next period extends access and opens a new search quota period", async () => {
    const u = await newCustomer();
    const now = Math.floor(Date.now() / 1000);
    const sub = makeSubscription({ customer: u.customer, priceId: PRICES.plus, status: "active", userId: u.id, planId: "plus", periodEnd: now + 3600 });
    fake.state.subscriptions.set(sub.id, sub);
    let ev = signedEvent(fake.stripe, "customer.subscription.created", sub);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    const first = await getEntitlements(t.db, u.id);
    const w1 = searchQuotaWindow(first, await loadCurrentSubscription(t.db, u.id));
    // Stripe renouvelle : nouvelle période de 31 jours qui commence maintenant (démarrée 1 jour plus tard que la première).
    const start = now + 86400;
    const renewed = {
      ...sub,
      items: { ...sub.items, data: [{ ...sub.items.data[0]!, current_period_start: start, current_period_end: start + 31 * 86400 }] },
    } as typeof sub;
    fake.state.subscriptions.set(sub.id, renewed);
    ev = signedEvent(fake.stripe, "invoice.paid", {
      id: "in_renew_1",
      object: "invoice",
      customer: u.customer,
      amount_paid: 599,
      parent: { subscription_details: { subscription: sub.id, metadata: { waverti_user_id: u.id } } },
    });
    expect((await handleStripeWebhook(deps, ev.payload, ev.signature)).status).toBe(200);
    const after = await getEntitlements(t.db, u.id);
    expect(after.validUntil!.getTime()).toBeGreaterThan(first.validUntil!.getTime());
    const w2 = searchQuotaWindow(after, await loadCurrentSubscription(t.db, u.id), new Date((start + 3600) * 1000));
    expect(w2.period).not.toBe(w1.period);
    expect(w2).toMatchObject({ days: 31, limit: 93 });
  });

  it("trial_will_end: no duplicate reminder at the start of a 72h trial; one reminder when the end is near, shared with the worker", async () => {
    const u = await newCustomer();
    const pm = addCard(fake.state, "fp_trial_end");
    const sub = makeSubscription({ customer: u.customer, priceId: PRICES.max, status: "trialing", userId: u.id, planId: "max", trialEnd: Math.floor(Date.now() / 1000) + 72 * 3600, paymentMethod: pm });
    fake.state.subscriptions.set(sub.id, sub);
    // Stripe l'envoie dès le début d'un essai de 72 h : pas de rappel immédiat (le worker s'en charge ~24 h avant).
    let ev = signedEvent(fake.stripe, "customer.subscription.trial_will_end", sub);
    expect((await handleStripeWebhook(deps, ev.payload, ev.signature)).status).toBe(200);
    let n = await t.db.select().from(notifications).where(eq(notifications.userId, u.id));
    expect(n.some((x) => x.title.startsWith("Fin de votre essai"))).toBe(false);
    expect(n.some((x) => x.title === "Votre essai Waverti Max a commencé")).toBe(true);
    expect(await getEntitlements(t.db, u.id)).toMatchObject({ planId: "max", source: "trial", maxMonitors: 3 });

    // Fin proche (ex. essai raccourci par une horloge de test) : un seul rappel, avec date et montant.
    const soon = { ...sub, trial_end: Math.floor(Date.now() / 1000) + 20 * 3600 } as typeof sub;
    fake.state.subscriptions.set(sub.id, soon);
    ev = signedEvent(fake.stripe, "customer.subscription.trial_will_end", soon);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    const ev2 = signedEvent(fake.stripe, "customer.subscription.trial_will_end", soon);
    await handleStripeWebhook(deps, ev2.payload, ev2.signature);
    n = await t.db.select().from(notifications).where(eq(notifications.userId, u.id));
    const reminders = n.filter((x) => x.title.startsWith("Fin de votre essai Max"));
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.body).toContain("29,99 € TTC");
    const [row] = await t.db.select({ r: subscriptions.trialReminderSentAt }).from(subscriptions).where(eq(subscriptions.userId, u.id));
    expect(row!.r).not.toBeNull();

    const u2 = await newCustomer();
    const pm2 = addCard(fake.state, "fp_trial_end_2");
    const sub2 = { ...makeSubscription({ customer: u2.customer, priceId: PRICES.plus, status: "trialing", userId: u2.id, planId: "plus", trialEnd: Math.floor(Date.now() / 1000) + 20 * 3600, paymentMethod: pm2 }), cancel_at_period_end: true } as ReturnType<typeof makeSubscription>;
    fake.state.subscriptions.set(sub2.id, sub2);
    ev = signedEvent(fake.stripe, "customer.subscription.trial_will_end", sub2);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    n = await t.db.select().from(notifications).where(eq(notifications.userId, u2.id));
    expect(n.some((x) => x.title.startsWith("Fin de votre essai"))).toBe(false);
  });

  it("an old subscription item (retired extra-site option) grants nothing and is not counted", async () => {
    const u = await newCustomer();
    const sub = makeSubscription({ customer: u.customer, priceId: PRICES.business, status: "active", userId: u.id, planId: "business", legacyItemPrice: "price_old_extra_site", legacyItemQuantity: 3 });
    fake.state.subscriptions.set(sub.id, sub);
    const ev = signedEvent(fake.stripe, "customer.subscription.created", sub);
    expect((await handleStripeWebhook(deps, ev.payload, ev.signature)).status).toBe(200);
    expect(await getEntitlements(t.db, u.id)).toMatchObject({ planId: "business", businessSites: 1, businessScenarios: 1 });
    const [row] = await t.db.select({ extra: subscriptions.extraSites }).from(subscriptions).where(eq(subscriptions.userId, u.id));
    expect(row!.extra).toBe(0);
  });

  it("an ended subscription notice no longer mentions a free plan", async () => {
    const u = await newCustomer();
    const sub = makeSubscription({ customer: u.customer, priceId: PRICES.pro, status: "active", userId: u.id, planId: "pro" });
    fake.state.subscriptions.set(sub.id, sub);
    let ev = signedEvent(fake.stripe, "customer.subscription.created", sub);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    fake.state.subscriptions.set(sub.id, { ...sub, status: "canceled" });
    ev = signedEvent(fake.stripe, "customer.subscription.deleted", sub);
    await handleStripeWebhook(deps, ev.payload, ev.signature);
    const n = await t.db.select().from(notifications).where(eq(notifications.userId, u.id));
    const ended = n.find((x) => x.title === "Votre abonnement est terminé");
    expect(ended?.body).not.toMatch(/Découverte|gratuit/i);
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
    // Essai de 3 jours compté à partir de la validation (affiché « 3 jours » par Stripe), prix en euros sans conversion.
    expect(params.subscription_data.trial_period_days).toBe(3);
    expect(params.subscription_data.trial_end).toBeUndefined();
    expect(params.adaptive_pricing).toEqual({ enabled: false });
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
    expect(ent.every((e) => e.planId === null)).toBe(true);
  });
});
