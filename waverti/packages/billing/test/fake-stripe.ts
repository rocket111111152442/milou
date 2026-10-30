/**
 * Faux Stripe en mémoire pour les tests d'intégration : instance Stripe réelle (vérification de
 * signature authentique via stripe.webhooks) dont les appels réseau sont remplacés.
 */
import Stripe from "stripe";

export const WEBHOOK_SECRET = "whsec_test_" + "a".repeat(32);

export interface FakeState {
  subscriptions: Map<string, Stripe.Subscription>;
  paymentMethods: Map<string, Stripe.PaymentMethod>;
  calls: Array<{ method: string; args: unknown[] }>;
}

let counter = 0;
const nextId = (p: string) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}`;

export function makeSubscription(input: {
  customer: string;
  priceId: string;
  status: Stripe.Subscription.Status;
  userId: string;
  planId: string;
  trialEnd?: number | null;
  periodEnd?: number;
  paymentMethod?: string | null;
  extraSitePrice?: string;
  extraSites?: number;
}): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  const items: unknown[] = [
    {
      id: nextId("si"),
      object: "subscription_item",
      price: { id: input.priceId, object: "price" },
      quantity: 1,
      current_period_start: now,
      current_period_end: input.periodEnd ?? now + 30 * 86400,
    },
  ];
  if (input.extraSitePrice && input.extraSites) {
    items.push({
      id: nextId("si"),
      object: "subscription_item",
      price: { id: input.extraSitePrice, object: "price" },
      quantity: input.extraSites,
      current_period_start: now,
      current_period_end: input.periodEnd ?? now + 30 * 86400,
    });
  }
  return {
    id: nextId("sub"),
    object: "subscription",
    customer: input.customer,
    status: input.status,
    metadata: { waverti_user_id: input.userId, plan_id: input.planId },
    items: { object: "list", data: items, has_more: false, url: "" },
    trial_start: input.trialEnd ? now : null,
    trial_end: input.trialEnd ?? null,
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ended_at: null,
    default_payment_method: input.paymentMethod ?? null,
  } as unknown as Stripe.Subscription;
}

export function createFakeStripe(): { stripe: Stripe; state: FakeState } {
  const stripe = new Stripe("sk_test_fake_key_for_tests");
  const state: FakeState = { subscriptions: new Map(), paymentMethods: new Map(), calls: [] };
  const rec = (method: string, args: unknown[]) => state.calls.push({ method, args });

  Object.assign(stripe.subscriptions, {
    retrieve: async (id: string, ...rest: unknown[]) => {
      rec("subscriptions.retrieve", [id, ...rest]);
      const s = state.subscriptions.get(id);
      if (!s) throw new Error(`no such subscription ${id}`);
      const pm = s.default_payment_method;
      if (typeof pm === "string" && state.paymentMethods.has(pm)) {
        return { ...s, default_payment_method: state.paymentMethods.get(pm) };
      }
      return s;
    },
    cancel: async (id: string, ...rest: unknown[]) => {
      rec("subscriptions.cancel", [id, ...rest]);
      const s = state.subscriptions.get(id)!;
      const canceled = { ...s, status: "canceled", canceled_at: Math.floor(Date.now() / 1000), ended_at: Math.floor(Date.now() / 1000) } as Stripe.Subscription;
      state.subscriptions.set(id, canceled);
      return canceled;
    },
    update: async (id: string, params: Record<string, unknown>) => {
      rec("subscriptions.update", [id, params]);
      const s = state.subscriptions.get(id)!;
      const next = { ...s, ...(params.cancel_at_period_end !== undefined ? { cancel_at_period_end: params.cancel_at_period_end } : {}) } as Stripe.Subscription;
      state.subscriptions.set(id, next);
      return next;
    },
  });
  Object.assign(stripe.paymentMethods, {
    retrieve: async (id: string) => {
      rec("paymentMethods.retrieve", [id]);
      return state.paymentMethods.get(id);
    },
  });
  Object.assign(stripe.customers, {
    create: async (params: unknown) => {
      rec("customers.create", [params]);
      return { id: nextId("cus") };
    },
  });
  Object.assign(stripe.checkout.sessions, {
    create: async (params: unknown, opts: unknown) => {
      rec("checkout.sessions.create", [params, opts]);
      const id = nextId("cs");
      return { id, url: `https://checkout.stripe.com/c/pay/${id}` };
    },
  });
  return { stripe, state };
}

export function addCard(state: FakeState, fingerprint: string): string {
  const id = nextId("pm");
  state.paymentMethods.set(id, { id, object: "payment_method", card: { fingerprint } } as unknown as Stripe.PaymentMethod);
  return id;
}

/** Construit un événement signé exactement comme Stripe (en-tête Stripe-Signature). */
export function signedEvent(stripe: Stripe, type: string, object: unknown, opts: { id?: string; created?: number } = {}) {
  const event = {
    id: opts.id ?? nextId("evt"),
    object: "event",
    type,
    created: opts.created ?? Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object },
    api_version: "2026-09-30.endive",
  };
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, signature, event };
}
