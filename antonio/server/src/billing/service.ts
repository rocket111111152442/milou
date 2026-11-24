import Stripe from "stripe";
import { eq, and, gte, sql } from "drizzle-orm";
import { OFFERS, offerFor, type PlanId } from "@antonio/shared";
import { config } from "../config.js";
import { db, schema } from "../db/client.js";
import { AppError } from "../lib/audit.js";

export const CREDIT_TOPUPS = [
  { euros: 20, creditMicros: 8_000_000 },
  { euros: 50, creditMicros: 20_000_000 },
  { euros: 100, creditMicros: 40_000_000 },
] as const;

export async function apiCreditBalance(userId: string) {
  const [row] = await db().select({ balance: sql<string>`coalesce(sum(${schema.apiCreditLedger.amountMicros}), 0)` })
    .from(schema.apiCreditLedger).where(eq(schema.apiCreditLedger.userId, userId));
  return Number(row?.balance ?? 0);
}

export async function creditTopupFor(user: { userId: string; email: string }, euros: number, requestId: string, client?: Stripe) {
  if (!billingEnabled()) throw new AppError(503, "billing_unavailable", "Les paiements ne sont pas encore ouverts.");
  await paidOffer(user.userId);
  const pack = CREDIT_TOPUPS.find((item) => item.euros === euros);
  if (!pack) throw new AppError(400, "invalid_topup", "Choisissez une recharge proposée.");
  const stripe = client ?? stripeClient();
  const subscription = await subscriptionFor(user.userId);
  const customer = subscription?.stripeCustomerId ?? (await stripe.customers.create({ email: user.email, metadata: { waverti_user_id: user.userId } }, { idempotencyKey: `waverti-customer:${user.userId}` })).id;
  const session = await stripe.checkout.sessions.create({
    mode: "payment", locale: "fr", client_reference_id: user.userId, customer,
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: pack.euros * 100, product_data: { name: `Recharge Waverti ${pack.euros} €`, description: `${formatUsd(pack.creditMicros)} de crédit d’utilisation IA.` } } }],
    metadata: { waverti_user_id: user.userId, waverti_topup_euros: String(pack.euros), waverti_credit_micros: String(pack.creditMicros) },
    payment_intent_data: { metadata: { waverti_user_id: user.userId, waverti_topup_euros: String(pack.euros), waverti_credit_micros: String(pack.creditMicros) } },
    success_url: `${config().APP_BASE_URL}/consommation?recharge_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config().APP_BASE_URL}/consommation?recharge_annule=1`,
  }, { idempotencyKey: `waverti-topup:${user.userId}:${requestId}` });
  return { url: session.url };
}

export async function grantTopupFromSession(session: Stripe.Checkout.Session, userId: string) {
  if (session.mode !== "payment" || session.payment_status !== "paid" || session.client_reference_id !== userId || session.metadata?.waverti_user_id !== userId) return false;
  const pack = CREDIT_TOPUPS.find((item) => item.euros === Number(session.metadata?.waverti_topup_euros));
  if (!pack || Number(session.metadata?.waverti_credit_micros) !== pack.creditMicros || session.amount_total !== pack.euros * 100 || session.currency !== "eur") return false;
  await db().insert(schema.apiCreditLedger).values({ userId, amountMicros: pack.creditMicros, kind: "purchase", stripeSessionId: session.id }).onConflictDoNothing({ target: schema.apiCreditLedger.stripeSessionId });
  return true;
}

function formatUsd(micros: number) { return `$${(micros / 1_000_000).toFixed(2)} USD`; }

export const billingEnabled = () => Boolean(config().BILLING_ENABLED && config().STRIPE_SECRET_KEY && config().STRIPE_WEBHOOK_SECRET);
export function stripeClient() {
  if (!config().STRIPE_SECRET_KEY) throw new AppError(503, "billing_unavailable", "Les abonnements payants ne sont pas encore ouverts. Votre espace reste accessible.");
  return new Stripe(config().STRIPE_SECRET_KEY!, { timeout: 15_000, maxNetworkRetries: 1 });
}
export async function subscriptionFor(userId: string) {
  const [row] = await db().select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  return row ?? null;
}
export async function paidOffer(userId: string) {
  const subscription = await subscriptionFor(userId);
  if (!subscription || !["active", "trialing"].includes(subscription.status)) throw new AppError(402, "subscription_required", "Choisissez un abonnement actif dans votre espace Abonnement.");
  return offerFor(subscription.plan);
}
export async function assertPlanUsage(userId: string, kind: "text" | "voice" | "connection") {
  if (!billingEnabled()) return;
  const plan = await paidOffer(userId);
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  if (kind === "voice") {
    const [r] = await db().select({ total: sql<string>`coalesce(sum(${schema.usageRecords.quantity}),0)` }).from(schema.usageRecords).where(and(eq(schema.usageRecords.userId, userId), eq(schema.usageRecords.kind, "voice"), gte(schema.usageRecords.createdAt, start)));
    if (plan.voiceMinutes === 0 || Number(r.total) >= plan.voiceMinutes * 60) throw new AppError(429, "voice_limit", "Votre limite mensuelle de voix est atteinte, ou votre offre ne comprend pas la voix.");
  } else if (kind === "text") {
    const [r] = await db().select({ total: sql<string>`count(*)` }).from(schema.turns).where(and(eq(schema.turns.userId, userId), eq(schema.turns.role, "user"), eq(schema.turns.channel, "chat"), gte(schema.turns.createdAt, start)));
    if (Number(r.total) >= plan.requests) throw new AppError(429, "request_limit", "Votre limite mensuelle de demandes est atteinte.");
  } else {
    const [r] = await db().select({ total: sql<string>`count(*)` }).from(schema.connections).where(and(eq(schema.connections.userId, userId), sql`${schema.connections.provider} <> 'demo'`, sql`${schema.connections.status} <> 'revoked'`));
    if (Number(r.total) >= plan.accounts) throw new AppError(429, "connection_limit", "Le nombre de comptes connectés de votre offre est atteint.");
  }
}

/** Re-read the current subscription at Stripe, so delayed events cannot restore an old status. */
export async function refreshSubscription(subscriptionId: string, client?: Stripe) {
  const stripe = client ?? stripeClient();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const [owner] = await db().select().from(schema.subscriptions).where(eq(schema.subscriptions.stripeSubscriptionId, sub.id));
  const userId = owner?.userId ?? sub.metadata.waverti_user_id;
  if (!userId) return;
  const candidate = sub.metadata.waverti_plan;
  if (!OFFERS.some((p) => p.id === candidate)) throw new Error("Offre Stripe inconnue");
  const [existingUser] = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId));
  if (!existingUser) return;
  const current = await subscriptionFor(userId);
  if (current?.stripeSubscriptionId && current.stripeSubscriptionId !== sub.id) {
    const previous = await stripe.subscriptions.retrieve(current.stripeSubscriptionId);
    if (previous.created >= sub.created) return;
  }
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  await db().insert(schema.subscriptions).values({ userId, requestedPlan: candidate, plan: candidate, status: sub.status, stripeCustomerId: customer, stripeSubscriptionId: sub.id, cancelAtPeriodEnd: sub.cancel_at_period_end }).onConflictDoUpdate({ target: schema.subscriptions.userId, set: { plan: candidate, status: sub.status, stripeCustomerId: customer, stripeSubscriptionId: sub.id, cancelAtPeriodEnd: sub.cancel_at_period_end, updatedAt: new Date() } });
}

export async function checkoutFor(user: { userId: string; email: string }, planId: PlanId, requestId: string, client?: Stripe) {
  if (!billingEnabled()) throw new AppError(503, "billing_unavailable", "Les abonnements payants ne sont pas encore ouverts. Aucun paiement n’a été demandé.");
  return db().transaction(async (tx) => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('waverti_checkout'), hashtext(${user.userId}))`);
  const [row] = await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.userId));
  if (row && ["active", "trialing", "past_due", "unpaid"].includes(row.status)) throw new AppError(409, "subscription_exists", "Gérez votre abonnement existant depuis le portail de facturation.");
  const stripe = client ?? stripeClient();
  const customer = row?.stripeCustomerId ?? (await stripe.customers.create({ email: user.email, metadata: { waverti_user_id: user.userId } }, { idempotencyKey: `waverti-customer:${user.userId}` })).id;
  await tx.insert(schema.subscriptions).values({ userId: user.userId, requestedPlan: planId, stripeCustomerId: customer }).onConflictDoUpdate({ target: schema.subscriptions.userId, set: { requestedPlan: planId, stripeCustomerId: customer, updatedAt: new Date() } });
  const existingSubscriptions = await stripe.subscriptions.list({ customer, status: "all", limit: 100 });
  if (existingSubscriptions.data.some((s) => s.metadata.waverti_user_id === user.userId && ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(s.status))) throw new AppError(409, "subscription_exists", "Un abonnement ou un paiement est déjà en cours. Consultez votre facturation avant de recommencer.");
  const pending = await stripe.checkout.sessions.list({ customer, status: "open", limit: 100 });
  for (const previous of pending.data.filter((s) => s.metadata?.waverti_user_id === user.userId && s.mode === "subscription")) {
    if (previous.metadata?.waverti_plan === planId && previous.url) return { url: previous.url };
    await stripe.checkout.sessions.expire(previous.id);
  }
  const plan = offerFor(planId);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription", locale: "fr", client_reference_id: user.userId,
    customer,
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: plan.euros * 100, recurring: { interval: "month" }, product_data: { name: `Waverti ${plan.name}` } } }],
    subscription_data: { metadata: { waverti_user_id: user.userId, waverti_plan: planId } },
    metadata: { waverti_user_id: user.userId, waverti_plan: planId },
    success_url: `${config().APP_BASE_URL}/abonnement?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config().APP_BASE_URL}/abonnement?annule=1`,
  }, { idempotencyKey: `waverti-checkout:${user.userId}:${planId}:${requestId}` });
  return { url: session.url };
  });
}
