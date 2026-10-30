import { and, desc, eq, inArray, planAddons, plans, profiles, subscriptions, type Database } from "@waverti/database";
import { BillingError } from "./checkout";
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
  const [plan] = await db.select().from(plans).where(eq(plans.id, newPlanId)).limit(1);
  if (!plan?.stripePriceId) throw new BillingError("price_missing", "Cette formule n'est pas disponible au paiement.");
  const [current] = await db.select().from(plans).where(eq(plans.id, sub.planId)).limit(1);

  const remote = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const planItem = remote.items.data.find((i) => i.price.id === current?.stripePriceId) ?? remote.items.data[0];
  if (!planItem) throw new Error("Abonnement Stripe sans élément");
  const items: Array<{ id?: string; price?: string; quantity?: number; deleted?: boolean }> = [{ id: planItem.id, price: plan.stripePriceId }];
  // Quitter Business supprime les sites supplémentaires (qui n'ont plus de sens hors Business).
  if (newPlanId !== "business") {
    const [addon] = await db.select().from(planAddons).where(eq(planAddons.id, "business_extra_site")).limit(1);
    for (const i of remote.items.data) {
      if (addon?.stripePriceId && i.price.id === addon.stripePriceId) items.push({ id: i.id, deleted: true });
    }
  }
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items,
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
    metadata: { waverti_user_id: userId, plan_id: newPlanId },
  });
}

/** Ajuste le nombre de sites professionnels supplémentaires (option Business, proratisée). */
export async function setExtraSites(db: Database, stripe: StripeClient, userId: string, quantity: number): Promise<void> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) throw new BillingError("invalid_change", "Quantité invalide (0 à 20).");
  const sub = await getLiveSubscription(db, userId);
  if (!sub || sub.planId !== "business") throw new BillingError("invalid_change", "Option réservée à la formule Business.");
  if (sub.status === "trialing" && quantity > 0) {
    throw new BillingError("invalid_change", "Les sites supplémentaires sont disponibles après la période d'essai.");
  }
  const [addon] = await db.select().from(planAddons).where(eq(planAddons.id, "business_extra_site")).limit(1);
  if (!addon?.stripePriceId) throw new BillingError("price_missing", "Option indisponible au paiement.");
  const remote = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const item = remote.items.data.find((i) => i.price.id === addon.stripePriceId);
  if (item && quantity === 0) {
    await stripe.subscriptionItems.del(item.id, { proration_behavior: "create_prorations" });
  } else if (item) {
    await stripe.subscriptionItems.update(item.id, { quantity, proration_behavior: "create_prorations" });
  } else if (quantity > 0) {
    await stripe.subscriptionItems.create({
      subscription: sub.stripeSubscriptionId,
      price: addon.stripePriceId,
      quantity,
      proration_behavior: "create_prorations",
    });
  }
}

/** Portail Stripe : factures et moyen de paiement (les numéros de carte ne transitent jamais par Waverti). */
export async function createPortalSession(db: Database, stripe: StripeClient, userId: string, returnUrl: string): Promise<string> {
  const [p] = await db.select({ customer: profiles.stripeCustomerId }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!p?.customer) throw new BillingError("no_subscription", "Aucun historique de facturation.");
  const session = await stripe.billingPortal.sessions.create({ customer: p.customer, return_url: returnUrl, locale: "fr" });
  return session.url;
}
