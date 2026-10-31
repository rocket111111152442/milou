import { and, desc, eq, inArray, plans, profiles, subscriptions, type Database } from "@waverti/database";
import { BillingError } from "./checkout";
import { resolvePlanPriceId } from "./prices";
import { isPaidPlanId } from "./catalog";
import type { StripeClient } from "./stripe";

const LIVE = ["trialing", "active", "past_due", "unpaid"] as const;

export async function getLiveSubscription(db: Database, userId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, [...LIVE])))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return sub ?? null;
}

/**
 * Résiliation à la fin de la période. Pendant l'essai, la période se termine à la fin de
 * l'essai : l'abonnement est alors annulé SANS prélèvement.
 * L'état local est mis à jour par le webhook (source de vérité), pas ici.
 */
export async function scheduleCancellation(db: Database, stripe: StripeClient, userId: string): Promise<{ endsAt: Date | null; trial: boolean }> {
  const sub = await getLiveSubscription(db, userId);
  if (!sub) throw new BillingError("no_subscription", "Aucun abonnement actif.");
  await stripe.subscriptions.update(
    sub.stripeSubscriptionId,
    { cancel_at_period_end: true },
    { idempotencyKey: `cancel:${sub.stripeSubscriptionId}:${Math.floor(Date.now() / 60_000)}` },
  );
  return { endsAt: sub.status === "trialing" ? sub.trialEnd : sub.currentPeriodEnd, trial: sub.status === "trialing" };
}

export async function resumeSubscription(db: Database, stripe: StripeClient, userId: string): Promise<void> {
  const sub = await getLiveSubscription(db, userId);
  if (!sub || !sub.cancelAtPeriodEnd) throw new BillingError("no_subscription", "Aucune résiliation à annuler.");
  await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
}

/**
 * Changement de formule (montée ou descente) avec proratisation Stripe
 * (« create_prorations » : la différence est créditée ou facturée sur la prochaine facture).
 * Pendant l'essai, la période d'essai est conservée.
 */
export async function changePlan(db: Database, stripe: StripeClient, userId: string, newPlanId: string): Promise<void> {
  if (!isPaidPlanId(newPlanId)) throw new BillingError("invalid_plan", "Formule inconnue");
  const sub = await getLiveSubscription(db, userId);
  if (!sub) throw new BillingError("no_subscription", "Aucun abonnement actif.");
  if (sub.planId === newPlanId) throw new BillingError("invalid_change", "Vous utilisez déjà cette formule.");
  const newPriceId = await resolvePlanPriceId(db, stripe, newPlanId);
  const [current] = await db.select().from(plans).where(eq(plans.id, sub.planId)).limit(1);

  const remote = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const planItem = remote.items.data.find((i) => i.price.id === current?.stripePriceId) ?? remote.items.data[0];
  if (!planItem) throw new Error("Abonnement Stripe sans élément");
  const items: Array<{ id?: string; price?: string; quantity?: number; deleted?: boolean }> = [{ id: planItem.id, price: newPriceId }];
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items,
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
    metadata: { waverti_user_id: userId, plan_id: newPlanId },
  });
}

/** Portail Stripe : factures et moyen de paiement (les numéros de carte ne transitent jamais par Waverti). */
export async function createPortalSession(db: Database, stripe: StripeClient, userId: string, returnUrl: string): Promise<string> {
  const [p] = await db.select({ customer: profiles.stripeCustomerId }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!p?.customer) throw new BillingError("no_subscription", "Aucun historique de facturation.");
  const session = await stripe.billingPortal.sessions.create({ customer: p.customer, return_url: returnUrl, locale: "fr" });
  return session.url;
}

/**
 * TESTS UNIQUEMENT (clé Stripe de test, hors Production) : fait avancer la facturation de l'abonnement de
 * l'utilisateur sur les vrais serveurs Stripe TEST.
 * - end_trial : termine l'essai maintenant → Stripe émet et tente de payer la première facture.
 * - advance_days : avance l'horloge de test du client (créée à la recette) → renouvellements réels simulés.
 * - failing_card : carte de test acceptée mais refusée à chaque prélèvement (pm_card_chargeCustomerFail).
 * L'appelant DOIT vérifier le mode test et l'environnement ; la clé live est de toute façon refusée par le client.
 */
export async function advanceTestBilling(
  db: Database,
  stripe: StripeClient,
  userId: string,
  action: "end_trial" | "advance_days" | "failing_card",
  days = 31,
): Promise<{ subscriptionId: string; frozenTime?: string }> {
  const sub = await getLiveSubscription(db, userId);
  if (!sub) throw new BillingError("no_subscription", "Aucun abonnement actif.");
  if (action === "end_trial") {
    if (sub.status !== "trialing") throw new BillingError("no_subscription", "Aucun essai en cours.");
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { trial_end: "now", proration_behavior: "none" });
    return { subscriptionId: sub.stripeSubscriptionId };
  }
  const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const customerId = typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id;
  if (action === "failing_card") {
    const pm = await stripe.paymentMethods.attach("pm_card_chargeCustomerFail", { customer: customerId });
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } });
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { default_payment_method: pm.id });
    return { subscriptionId: sub.stripeSubscriptionId };
  }
  const customer = await stripe.customers.retrieve(customerId);
  const clockRef = "deleted" in customer && customer.deleted ? null : customer.test_clock;
  const clockId = typeof clockRef === "string" ? clockRef : (clockRef?.id ?? null);
  if (!clockId) throw new BillingError("no_subscription", "Ce client n'a pas d'horloge de test (compte créé avant l'activation de la recette).");
  const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
  const target = clock.frozen_time + Math.max(1, Math.min(62, days)) * 86_400;
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: target });
  return { subscriptionId: sub.stripeSubscriptionId, frozenTime: new Date(target * 1000).toISOString() };
}
