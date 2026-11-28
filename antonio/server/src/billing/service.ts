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

const SUBSCRIPTION_PROMO_CODE = "paffpaffouiouipaff";
/** 100 % de réduction sur l'abonnement, pour toute sa durée. */
const SUBSCRIPTION_PROMO_COUPON_ID = "waverti-free-forever-100";

const isForeverFree = (coupon: Stripe.Coupon | null | undefined) =>
  Boolean(coupon && !coupon.deleted && coupon.percent_off === 100 && coupon.duration === "forever");

/**
 * Garantit que le code « paffpaffouiouipaff » rend l'abonnement 100 % gratuit pour toujours
 * dans le compte/mode Stripe utilisé. Un ancien code (ex. premier mois offert) portant le même
 * texte est désactivé puis remplacé ; les abonnements déjà souscrits gardent leur réduction d'origine.
 */
export async function ensureSubscriptionPromoCode(stripe: Stripe) {
  // Keep minimal Stripe test doubles usable; the real SDK always exposes these resources.
  if (!stripe.promotionCodes || !stripe.coupons) return;
  const matches = await stripe.promotionCodes.list({ code: SUBSCRIPTION_PROMO_CODE, active: true, limit: 100 });
  for (const existing of matches.data.filter((item) => item.code.toLowerCase() === SUBSCRIPTION_PROMO_CODE)) {
    const couponRef = existing.promotion.type === "coupon" ? existing.promotion.coupon : null;
    const coupon = typeof couponRef === "string" ? await stripe.coupons.retrieve(couponRef) : couponRef;
    if (isForeverFree(coupon)) return;
    await stripe.promotionCodes.update(existing.id, { active: false });
  }

  let coupon: Stripe.Coupon;
  try {
    coupon = await stripe.coupons.retrieve(SUBSCRIPTION_PROMO_COUPON_ID);
  } catch (error) {
    const stripeError = error as { code?: string; statusCode?: number };
    if (stripeError.code !== "resource_missing" && stripeError.statusCode !== 404) throw error;
    coupon = await stripe.coupons.create({
      id: SUBSCRIPTION_PROMO_COUPON_ID,
      name: "Waverti — offert",
      percent_off: 100,
      duration: "forever",
      metadata: { waverti_promo_code: SUBSCRIPTION_PROMO_CODE },
    }, { idempotencyKey: "waverti:coupon:free-forever-100" });
  }
  if (!isForeverFree(coupon)) {
    throw new AppError(503, "promo_coupon_conflict", "La réduction configurée pour le code n’est pas valide.");
  }
  await stripe.promotionCodes.create({
    code: SUBSCRIPTION_PROMO_CODE,
    promotion: { type: "coupon", coupon: coupon.id },
    metadata: { waverti_promo: "free-forever" },
  }, { idempotencyKey: "waverti:promotion-code:free-forever-100" });
}

export async function apiCreditBalance(userId: string) {
  const [row] = await db().select({ balance: sql<string>`coalesce(sum(${schema.apiCreditLedger.amountMicros}), 0)` })
    .from(schema.apiCreditLedger).where(eq(schema.apiCreditLedger.userId, userId));
  return Number(row?.balance ?? 0);
}

export async function creditTopupFor(user: { userId: string; email: string }, euros: number, requestId: string, client?: Stripe) {
  if (!billingEnabled()) throw new AppError(503, "billing_unavailable", "Les paiements ne sont pas encore ouverts.");
  const pack = CREDIT_TOPUPS.find((item) => item.euros === euros);
  if (!pack) throw new AppError(400, "invalid_topup", "Choisissez une recharge proposée.");
  const stripe = client ?? stripeClient();
  const subscription = await subscriptionFor(user.userId);
  const customer = subscription?.stripeCustomerId ?? (await stripe.customers.create({ email: user.email, metadata: { waverti_user_id: user.userId } }, { idempotencyKey: `waverti-customer:${user.userId}` })).id;
  await db().insert(schema.subscriptions).values({ userId: user.userId, stripeCustomerId: customer }).onConflictDoUpdate({ target: schema.subscriptions.userId, set: { stripeCustomerId: customer, updatedAt: new Date() } });
  const session = await stripe.checkout.sessions.create({
    mode: "payment", locale: "fr", client_reference_id: user.userId, customer,
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: pack.euros * 100, product_data: { name: `Recharge Waverti ${pack.euros} €`, description: "Recharge ponctuelle Waverti." } } }],
    metadata: { waverti_user_id: user.userId, waverti_topup_euros: String(pack.euros), waverti_credit_micros: String(pack.creditMicros) },
    payment_intent_data: { metadata: { waverti_user_id: user.userId, waverti_topup_euros: String(pack.euros), waverti_credit_micros: String(pack.creditMicros) } },
    success_url: `${config().APP_BASE_URL}/consommation?recharge_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config().APP_BASE_URL}/consommation?recharge_annule=1`,
  }, { idempotencyKey: `waverti-topup:${user.userId}:${requestId}` });
  return { url: session.url };
}

/**
 * Prix mensuel réutilisable pour une offre. Un prix dont le produit a été archivé dans Stripe
 * (ou dont le montant ne correspond plus à l'offre) est remplacé : Stripe refuse sinon de l'utiliser.
 */
export async function usablePlanPrice(stripe: Stripe, planId: PlanId): Promise<Stripe.Price> {
  const plan = offerFor(planId);
  const lookupKey = `waverti_${planId}_monthly`;
  const found = (await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1, expand: ["data.product"] })).data[0];
  const product = found && typeof found.product === "object" ? found.product : null;
  const productActive = Boolean(product && !("deleted" in product && product.deleted) && (product as Stripe.Product).active);
  if (found && productActive && found.unit_amount === plan.euros * 100) return found;
  return stripe.prices.create({
    currency: "eur",
    unit_amount: plan.euros * 100,
    recurring: { interval: "month" },
    product_data: { name: `Waverti ${plan.name}`, metadata: { waverti_plan: planId } },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    metadata: { waverti_plan: planId },
  }, { idempotencyKey: `waverti-price:${planId}:${plan.euros}:${found?.id ?? "new"}` });
}

export async function upgradeSubscriptionFor(user: { userId: string }, planId: PlanId, requestId: string, client?: Stripe) {
  if (!billingEnabled()) throw new AppError(503, "billing_unavailable", "Les abonnements ne sont pas encore ouverts.");
  const row = await subscriptionFor(user.userId);
  if (!row?.stripeSubscriptionId || !["active", "trialing"].includes(row.status)) {
    throw new AppError(400, "subscription_required", "Activez d’abord un abonnement pour le modifier.");
  }

  const stripe = client ?? stripeClient();
  const current = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
  if (!["active", "trialing"].includes(current.status)) throw new AppError(400, "subscription_not_active", "Cet abonnement ne peut pas être modifié pour le moment.");
  const currentPlan = offerFor(current.metadata.waverti_plan ?? row.plan);
  const nextPlan = offerFor(planId);
  if (nextPlan.euros <= currentPlan.euros) throw new AppError(400, "upgrade_only", "Choisissez une offre supérieure à votre offre actuelle.");
  const item = current.items.data[0];
  if (!item) throw new AppError(400, "subscription_item_missing", "Aucune offre modifiable n’a été trouvée.");

  const price = await usablePlanPrice(stripe, planId);

  let updated: Stripe.Subscription;
  try {
    updated = await stripe.subscriptions.update(current.id, {
      items: [{ id: item.id, price: price.id }],
      metadata: { ...current.metadata, waverti_user_id: user.userId, waverti_plan: planId },
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
      cancel_at_period_end: false,
    }, { idempotencyKey: `waverti-upgrade:${current.id}:${planId}:${requestId}:${price.id}` });
  } catch (error) {
    console.error("[billing] changement d'offre refusé par Stripe :", (error as Error).message);
    throw new AppError(502, "upgrade_failed", "Le changement d’offre n’a pas pu être effectué. Aucun montant n’a été prélevé. Réessayez dans un instant.");
  }
  if (["active", "trialing"].includes(updated.status)) await refreshSubscription(updated.id, stripe);
  return { ok: true, status: updated.status, plan: planId };
}

export async function grantTopupFromSession(session: Stripe.Checkout.Session, userId: string) {
  if (session.mode !== "payment" || session.payment_status !== "paid" || session.client_reference_id !== userId || session.metadata?.waverti_user_id !== userId) return false;
  const pack = CREDIT_TOPUPS.find((item) => item.euros === Number(session.metadata?.waverti_topup_euros));
  if (!pack || Number(session.metadata?.waverti_credit_micros) !== pack.creditMicros || session.amount_total !== pack.euros * 100 || session.currency !== "eur") return false;
  await db().insert(schema.apiCreditLedger).values({ userId, amountMicros: pack.creditMicros, kind: "purchase", stripeSessionId: session.id }).onConflictDoNothing({ target: schema.apiCreditLedger.stripeSessionId });
  return true;
}

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
  await ensureSubscriptionPromoCode(stripe);
  const customer = row?.stripeCustomerId ?? (await stripe.customers.create({ email: user.email, metadata: { waverti_user_id: user.userId } }, { idempotencyKey: `waverti-customer:${user.userId}` })).id;
  await tx.insert(schema.subscriptions).values({ userId: user.userId, requestedPlan: planId, stripeCustomerId: customer }).onConflictDoUpdate({ target: schema.subscriptions.userId, set: { requestedPlan: planId, stripeCustomerId: customer, updatedAt: new Date() } });
  const existingSubscriptions = await stripe.subscriptions.list({ customer, status: "all", limit: 100 });
  if (existingSubscriptions.data.some((s) => s.metadata.waverti_user_id === user.userId && ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(s.status))) throw new AppError(409, "subscription_exists", "Un abonnement ou un paiement est déjà en cours. Consultez votre facturation avant de recommencer.");
  const pending = await stripe.checkout.sessions.list({ customer, status: "open", limit: 100 });
  for (const previous of pending.data.filter((s) => s.metadata?.waverti_user_id === user.userId && s.mode === "subscription")) {
    const hasPromoField = previous.allow_promotion_codes === true;
    const isMinimalTestClient = !stripe.promotionCodes && !stripe.coupons;
    if (previous.metadata?.waverti_plan === planId && previous.url && (hasPromoField || isMinimalTestClient)) return { url: previous.url };
    await stripe.checkout.sessions.expire(previous.id);
  }
  const plan = offerFor(planId);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription", locale: "fr", client_reference_id: user.userId,
    allow_promotion_codes: true,
    // Avec le code 100 % offert, le total est nul : aucune carte n'est alors demandée.
    payment_method_collection: "if_required",
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
