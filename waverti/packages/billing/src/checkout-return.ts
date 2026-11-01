/**
 * Retour de Stripe Checkout : état à afficher, déterminé CÔTÉ SERVEUR à partir de la session Stripe (relue chez
 * Stripe, rattachée à l'utilisateur connecté) et de l'état applicatif réel. Le paramètre d'URL seul n'accorde ni
 * n'affirme jamais rien : une session inconnue, d'un autre compte ou illisible donne « unverified ».
 */
import { and, eq, subscriptions, trialUsage, type Database } from "@waverti/database";
import type { StripeClient } from "./stripe";

export type CheckoutReturnState =
  /** Rien de vérifiable (pas de session, session d'un autre compte, session illisible). */
  | { kind: "unverified" }
  /** Paiement non terminé chez Stripe. */
  | { kind: "incomplete" }
  /** Session terminée côté Stripe, droits pas encore enregistrés : confirmation en cours. */
  | { kind: "confirming" }
  /** Abonnement enregistré (essai ou actif). */
  | { kind: "confirmed"; status: string }
  /** Essai refusé (déjà utilisé) puis annulé ; `noCharge` = absence de prélèvement confirmée par les factures. */
  | { kind: "trial_refused"; noCharge: boolean }
  /** Abonnement terminé / annulé pour une autre raison. */
  | { kind: "ended" };

const SESSION_ID = /^cs_[A-Za-z0-9_]{8,200}$/;

export async function resolveCheckoutReturn(db: Database, stripe: StripeClient, userId: string, sessionId: string | undefined | null): Promise<CheckoutReturnState> {
  if (!sessionId || !SESSION_ID.test(sessionId)) return { kind: "unverified" };
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return { kind: "unverified" };
  }
  const owner = session.client_reference_id ?? session.metadata?.waverti_user_id ?? null;
  if (session.mode !== "subscription" || owner !== userId) return { kind: "unverified" };
  if (session.status !== "complete") return { kind: "incomplete" };
  const subId = typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);
  if (!subId) return { kind: "confirming" };

  const [blocked] = await db
    .select({ id: trialUsage.id })
    .from(trialUsage)
    .where(and(eq(trialUsage.stripeSubscriptionId, subId), eq(trialUsage.userId, userId), eq(trialUsage.status, "blocked_duplicate")))
    .limit(1);
  if (blocked) {
    let noCharge = false;
    try {
      const inv = await stripe.invoices.list({ subscription: subId, limit: 10 });
      noCharge = inv.data.every((i) => (i.amount_paid ?? 0) === 0);
    } catch {
      noCharge = false;
    }
    return { kind: "trial_refused", noCharge };
  }
  const [sub] = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(and(eq(subscriptions.stripeSubscriptionId, subId), eq(subscriptions.userId, userId)))
    .limit(1);
  if (!sub) return { kind: "confirming" };
  if (sub.status === "canceled") return { kind: "ended" };
  // Un essai n'est « confirmé » que si le contrôle d'essai a été exécuté (ligne trial_usage) : sinon on attend.
  if (sub.status === "trialing") {
    const [t] = await db.select({ id: trialUsage.id }).from(trialUsage).where(eq(trialUsage.stripeSubscriptionId, subId)).limit(1);
    if (!t) return { kind: "confirming" };
  }
  return { kind: "confirmed", status: sub.status };
}
