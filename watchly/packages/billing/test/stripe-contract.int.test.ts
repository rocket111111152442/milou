/**
 * Test de contrat : nos appels Stripe sont envoyés à stripe-mock, qui valide les paramètres
 * contre le schéma OpenAPI officiel de Stripe. Ignoré si STRIPE_MOCK_URL n'est pas défini.
 * Lancer : docker run -p 12111:12111 stripe/stripe-mock  puis  STRIPE_MOCK_URL=http://localhost:12111
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, planAddons, plans } from "@watchly/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@watchly/database/testing";
import { createSubscriptionCheckout } from "../src/checkout";
import { createStripeClient } from "../src/stripe";

const MOCK = process.env.STRIPE_MOCK_URL;
const PEPPER = "q".repeat(48);
let t: TestDatabase;

describe.skipIf(!MOCK)("stripe-mock contract", () => {
  beforeAll(async () => {
    t = await createTestDatabase();
    await t.db.update(plans).set({ stripePriceId: "price_1PlusTest" }).where(eq(plans.id, "plus"));
    await t.db.update(planAddons).set({ stripePriceId: "price_1ExtraTest" }).where(eq(planAddons.id, "business_extra_site"));
  });
  afterAll(async () => {
    await t?.drop();
  });

  it("creates customer and trial Checkout session with parameters accepted by the Stripe API schema", async () => {
    const stripe = createStripeClient("sk_test_123", MOCK);
    const u = await createTestUser(t, "contract@example.test");
    const res = await createSubscriptionCheckout(t.db, stripe, { userId: u.id, email: u.email, planId: "plus", appUrl: "https://app.test", pepper: PEPPER });
    expect(res.sessionId).toMatch(/^cs_/);
    expect(res.url).toMatch(/^https:\/\//);
  });

  it("accepts the cancellation, plan change and add-on parameters", async () => {
    const stripe = createStripeClient("sk_test_123", MOCK);
    await expect(stripe.subscriptions.update("sub_123", { cancel_at_period_end: true })).resolves.toBeTruthy();
    await expect(
      stripe.subscriptions.update("sub_123", {
        items: [{ id: "si_123", price: "price_1ProTest" }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
        metadata: { plan_id: "pro" },
      }),
    ).resolves.toBeTruthy();
    await expect(
      stripe.subscriptionItems.create({ subscription: "sub_123", price: "price_1ExtraTest", quantity: 2, proration_behavior: "create_prorations" }),
    ).resolves.toBeTruthy();
    await expect(stripe.subscriptions.cancel("sub_123", { invoice_now: false, prorate: false })).resolves.toBeTruthy();
    await expect(stripe.billingPortal.sessions.create({ customer: "cus_123", return_url: "https://app.test/app/abonnement", locale: "fr" })).resolves.toBeTruthy();
  });

  it("refuses live keys while payments are not legally validated", () => {
    expect(() => createStripeClient("sk_live_123", MOCK)).toThrow(/live refusée/);
  });
});
