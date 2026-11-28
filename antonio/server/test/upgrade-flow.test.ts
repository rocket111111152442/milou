import { afterAll, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { db, schema, closeDb } from "../src/db/client.js";
import { resetConfigForTests } from "../src/config.js";
import { planFromSubscription, subscriptionFor, upgradeSubscriptionFor } from "../src/billing/service.js";
import { makeUser } from "./helpers.js";

afterAll(async () => { await closeDb(); });

const enable = () => { process.env.BILLING_ENABLED = "true"; process.env.STRIPE_SECRET_KEY = "sk_test_fixture"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture"; resetConfigForTests(); };
const disable = () => { delete process.env.BILLING_ENABLED; delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_WEBHOOK_SECRET; resetConfigForTests(); };

function subscription(userId: string, price: Partial<Stripe.Price>, extra: Partial<Stripe.Subscription> = {}) {
  return { id: `sub_${userId}`, status: "active", customer: `cus_${userId}`, created: 1, cancel_at_period_end: false, pending_update: null,
    metadata: { waverti_user_id: userId, waverti_plan: "essentiel" }, items: { data: [{ id: "si_1", price }] }, ...extra } as unknown as Stripe.Subscription;
}

async function setup(pending: boolean) {
  const actor = await makeUser();
  await db().insert(schema.subscriptions).values({ userId: actor.userId, requestedPlan: "essentiel", plan: "essentiel", status: "active", stripeCustomerId: `cus_${actor.userId}`, stripeSubscriptionId: `sub_${actor.userId}` })
    .onConflictDoUpdate({ target: schema.subscriptions.userId, set: { plan: "essentiel", status: "active", stripeCustomerId: `cus_${actor.userId}`, stripeSubscriptionId: `sub_${actor.userId}` } });
  const before = subscription(actor.userId, { id: "price_checkout", metadata: {}, lookup_key: null });
  const newPrice = { id: "price_pro", unit_amount: 4900, lookup_key: "waverti_pro_monthly", metadata: { waverti_plan: "pro" }, product: { id: "prod", active: true } } as unknown as Stripe.Price;
  let state = before;
  const update = vi.fn(async (_id: string, params: Stripe.SubscriptionUpdateParams) => {
    if (params.items) {
      if (pending) return { ...before, pending_update: { expires_at: 1 }, latest_invoice: { status: "open", hosted_invoice_url: "https://invoice.stripe.com/i/test" } };
      state = subscription(actor.userId, newPrice);
      return { ...state, latest_invoice: { status: "paid" } };
    }
    state = { ...state, metadata: params.metadata as Stripe.Metadata };
    return state;
  });
  const client = { subscriptions: { retrieve: vi.fn(async () => state), update }, prices: { list: vi.fn(async () => ({ data: [newPrice] })), create: vi.fn() } } as unknown as Stripe;
  return { actor, client, update };
}

describe("Changement d'offre", () => {
  it("applique l'offre supérieure quand le paiement passe", async () => {
    enable();
    try {
      const { actor, client, update } = await setup(false);
      const result = await upgradeSubscriptionFor(actor, "pro", "req1", client);
      expect(result).toMatchObject({ ok: true, plan: "pro" });
      expect(update.mock.calls[0][1]).toMatchObject({ items: [{ id: "si_1", price: "price_pro" }], payment_behavior: "pending_if_incomplete" });
      expect(update.mock.calls[0][1]).not.toHaveProperty("metadata");
      expect((await subscriptionFor(actor.userId))?.plan).toBe("pro");
    } finally { disable(); }
  });
  it("renvoie la page de paiement Stripe quand la banque demande une confirmation, sans changer l'offre", async () => {
    enable();
    try {
      const { actor, client, update } = await setup(true);
      const result = await upgradeSubscriptionFor(actor, "pro", "req2", client);
      expect(result).toMatchObject({ ok: false, status: "payment_required", paymentUrl: "https://invoice.stripe.com/i/test" });
      expect(update).toHaveBeenCalledTimes(1);
      expect((await subscriptionFor(actor.userId))?.plan).toBe("essentiel");
    } finally { disable(); }
  });
  it("lit l'offre depuis le prix facturé avant la métadonnée", () => {
    const sub = subscription("u", { lookup_key: "waverti_business_monthly", metadata: {} });
    expect(planFromSubscription(sub)).toBe("business");
    expect(planFromSubscription(subscription("u", { lookup_key: null, metadata: {} }))).toBe("essentiel");
  });
});
