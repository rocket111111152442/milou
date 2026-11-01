import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, plans, profiles } from "@waverti/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import { handleStripeWebhook, type WebhookDeps } from "../src/webhooks";
import { resolveCheckoutReturn } from "../src/checkout-return";
import { createSubscriptionCheckout } from "../src/checkout";
import { addCard, createFakeStripe, makeSubscription, signedEvent, WEBHOOK_SECRET } from "./fake-stripe";

const PEPPER = "p".repeat(48);
const PRICE = "price_plus_test";
let t: TestDatabase;
let fake: ReturnType<typeof createFakeStripe>;
let deps: WebhookDeps;

beforeAll(async () => {
  t = await createTestDatabase();
  await t.db.update(plans).set({ stripePriceId: PRICE }).where(eq(plans.id, "plus"));
});
afterAll(async () => {
  await t?.drop();
});
beforeEach(() => {
  fake = createFakeStripe();
  fake.state.sessions = new Map();
  deps = { db: t.db, stripe: fake.stripe, webhookSecret: WEBHOOK_SECRET, pepper: PEPPER };
});

async function setup(fingerprint: string) {
  const user = await createTestUser(t);
  const customer = `cus_${user.id.slice(0, 8)}`;
  await t.db.update(profiles).set({ stripeCustomerId: customer }).where(eq(profiles.id, user.id));
  const pm = addCard(fake.state, fingerprint);
  const sub = makeSubscription({ customer, priceId: PRICE, status: "trialing", userId: user.id, planId: "plus", trialEnd: Math.floor(Date.now() / 1000) + 72 * 3600, paymentMethod: pm });
  fake.state.subscriptions.set(sub.id, sub);
  const sessionId = `cs_test_${user.id.replace(/-/g, "").slice(0, 20)}`;
  fake.state.sessions!.set(sessionId, { id: sessionId, object: "checkout.session", mode: "subscription", status: "complete", client_reference_id: user.id, customer, subscription: sub.id, metadata: { waverti_user_id: user.id } });
  const completed = () =>
    signedEvent(fake.stripe, "checkout.session.completed", { id: sessionId, object: "checkout.session", mode: "subscription", customer, subscription: sub.id, client_reference_id: user.id, metadata: { waverti_user_id: user.id } });
  return { user, customer, sub, sessionId, completed };
}

describe("checkout return state", () => {
  it("is unverified without session id, with a malformed id, with an unknown session or another account's session", async () => {
    const a = await setup("fp_ret_a");
    const b = await setup("fp_ret_b");
    for (const id of [undefined, "", "not-a-session", "cs_test_unknown00000000"]) {
      expect(await resolveCheckoutReturn(t.db, fake.stripe, a.user.id, id)).toEqual({ kind: "unverified" });
    }
    // Paramètre falsifié : la session de B présentée par A ne donne rien.
    expect(await resolveCheckoutReturn(t.db, fake.stripe, a.user.id, b.sessionId)).toEqual({ kind: "unverified" });
  });

  it("is incomplete while the Stripe session is not complete", async () => {
    const a = await setup("fp_ret_inc");
    fake.state.sessions!.set(a.sessionId, { ...fake.state.sessions!.get(a.sessionId)!, status: "open" });
    expect(await resolveCheckoutReturn(t.db, fake.stripe, a.user.id, a.sessionId)).toEqual({ kind: "incomplete" });
  });

  it("is confirming until the webhook ran, then confirmed (delayed confirmation, valid trial)", async () => {
    const a = await setup("fp_ret_ok");
    expect(await resolveCheckoutReturn(t.db, fake.stripe, a.user.id, a.sessionId)).toEqual({ kind: "confirming" });
    const created = signedEvent(fake.stripe, "customer.subscription.created", a.sub);
    await handleStripeWebhook(deps, created.payload, created.signature);
    expect(await resolveCheckoutReturn(t.db, fake.stripe, a.user.id, a.sessionId)).toEqual({ kind: "confirmed", status: "trialing" });
  });

  it("reports a refused trial with 'no charge' only when the invoices confirm it", async () => {
    const first = await setup("fp_ret_dup");
    const e1 = first.completed();
    await handleStripeWebhook(deps, e1.payload, e1.signature);
    const second = await setup("fp_ret_dup");
    fake.state.invoices = [{ subscription: second.sub.id, amount_paid: 0 }];
    const e2 = second.completed();
    await handleStripeWebhook(deps, e2.payload, e2.signature);
    expect(await resolveCheckoutReturn(t.db, fake.stripe, second.user.id, second.sessionId)).toEqual({ kind: "trial_refused", noCharge: true });
    fake.state.invoices = [{ subscription: second.sub.id, amount_paid: 599 }];
    expect(await resolveCheckoutReturn(t.db, fake.stripe, second.user.id, second.sessionId)).toEqual({ kind: "trial_refused", noCharge: false });
    // Le premier compte reste confirmé.
    expect(await resolveCheckoutReturn(t.db, fake.stripe, first.user.id, first.sessionId)).toEqual({ kind: "confirmed", status: "trialing" });
  });
});

describe("no second subscription while one is being confirmed", () => {
  it("refuses a new Checkout when Stripe already holds a live subscription for the customer", async () => {
    const a = await setup("fp_ret_dbl");
    // Abonnement présent chez Stripe, webhook pas encore reçu : rien en base.
    await expect(
      createSubscriptionCheckout(t.db, fake.stripe, { userId: a.user.id, email: a.user.email, planId: "plus", appUrl: "https://example.test", pepper: PEPPER }),
    ).rejects.toMatchObject({ code: "already_subscribed" });
  });
});
