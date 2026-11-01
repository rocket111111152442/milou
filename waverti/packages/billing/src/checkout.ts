import { createHash } from "node:crypto";
import {
  and,
  desc,
  eq,
  isNotNull,
  ne,
  or,
  plans,
  profiles,
  subscriptions,
  trialUsage,
  type Database,
  type Transaction,
} from "@waverti/database";
import { normalizeEmailForAbuse, pepperedHash } from "@waverti/auth";
import { isPaidPlanId, TRIAL_HOURS, type PaidPlanId } from "./catalog";
import { isLiveStatus } from "./entitlements";
import { resolvePlanPriceId } from "./prices";
import type { Stripe, StripeClient } from "./stripe";

export class BillingError extends Error {
  constructor(
    public readonly code:
      | "not_configured"
      | "invalid_plan"
      | "price_missing"
      | "already_subscribed"
      | "no_subscription"
      | "invalid_change"
      | "suspended",
    message: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export interface TrialEligibility {
  eligible: boolean;
  reason: "eligible" | "already_used" | "previous_subscription";
}

/** Un seul essai par personne : compte, e-mail normalisé (haché) ou abonnement antérieur. */
export async function checkTrialEligibility(db: Database, userId: string, email: string, pepper?: string): Promise<TrialEligibility> {
  const emailHash = pepperedHash(normalizeEmailForAbuse(email), pepper);
  const [used] = await db
    .select({ id: trialUsage.id })
    .from(trialUsage)
    .where(and(or(eq(trialUsage.userId, userId), eq(trialUsage.emailHash, emailHash)), ne(trialUsage.status, "blocked_duplicate")))
    .limit(1);
  if (used) return { eligible: false, reason: "already_used" };
  const [prev] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), isNotNull(subscriptions.trialStart)))
    .limit(1);
  if (prev) return { eligible: false, reason: "previous_subscription" };
  return { eligible: true, reason: "eligible" };
}

export interface CheckoutPreview {
  planId: PaidPlanId;
  planName: string;
  priceCents: number;
  trial: boolean;
  trialHours: number;
  /** Date/heure du premier prélèvement (fin d'essai), ou maintenant si pas d'essai. */
  firstChargeAt: Date;
}

export async function previewCheckout(
  db: Database,
  user: { id: string; email: string },
  planId: string,
  now: Date = new Date(),
  pepper?: string,
): Promise<CheckoutPreview> {
  if (!isPaidPlanId(planId)) throw new BillingError("invalid_plan", "Formule inconnue");
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!plan) throw new BillingError("invalid_plan", "Formule inconnue");
  const elig = await checkTrialEligibility(db, user.id, user.email, pepper);
  const trial = elig.eligible && plan.trialHours > 0;
  const hours = trial ? plan.trialHours : 0;
  return {
    planId,
    planName: plan.name,
    priceCents: plan.priceCents,
    trial,
    trialHours: hours,
    firstChargeAt: new Date(now.getTime() + hours * 3_600_000),
  };
}

export interface CreateCheckoutResult {
  url: string;
  sessionId: string;
  customerId: string;
  trialEnd: Date | null;
}

/**
 * Crée une session Stripe Checkout (abonnement). Essai de 72 h si éligible : la carte est
 * obligatoire (payment_method_collection=always) et l'abonnement est annulé si aucun moyen
 * de paiement n'est disponible à la fin de l'essai.
 */
export async function createSubscriptionCheckout(
  db: Database,
  stripe: StripeClient,
  input: {
    userId: string;
    email: string;
    planId: string;
    appUrl: string;
    now?: Date;
    pepper?: string;
    /** Recette Stripe TEST uniquement : rattache le NOUVEAU client à une horloge de test (renouvellements simulés). */
    testClock?: boolean;
  },
): Promise<CreateCheckoutResult> {
  const now = input.now ?? new Date();
  if (!isPaidPlanId(input.planId)) throw new BillingError("invalid_plan", "Formule inconnue");
  const [plan] = await db.select().from(plans).where(eq(plans.id, input.planId)).limit(1);
  if (!plan) throw new BillingError("invalid_plan", "Formule inconnue");

  const [profile] = await db
    .select({ stripeCustomerId: profiles.stripeCustomerId, suspendedAt: profiles.suspendedAt })
    .from(profiles)
    .where(eq(profiles.id, input.userId))
    .limit(1);
  if (!profile) throw new BillingError("no_subscription", "Profil introuvable");
  if (profile.suspendedAt) throw new BillingError("suspended", "Compte suspendu");

  const [current] = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, input.userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  if (current && isLiveStatus(current.status)) {
    throw new BillingError("already_subscribed", "Vous avez déjà un abonnement : modifiez-le depuis la page Abonnement.");
  }

  // Prix contrôlé chez Stripe (clé de recherche, EUR, mensuel, montant) avant toute création de client ou de paiement.
  const priceId = await resolvePlanPriceId(db, stripe, input.planId);

  let customerId = profile.stripeCustomerId;
  if (!customerId) {
    let testClock: string | undefined;
    if (input.testClock) {
      const clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(now.getTime() / 1000), name: `waverti-recette-${input.userId.slice(0, 8)}` });
      testClock = clock.id;
    }
    const customer = await stripe.customers.create(
      { email: input.email, metadata: { waverti_user_id: input.userId }, preferred_locales: ["fr"], ...(testClock ? { test_clock: testClock } : {}) },
      { idempotencyKey: `customer:${input.userId}${testClock ? ":clock" : ""}` },
    );
    customerId = customer.id;
    await db.update(profiles).set({ stripeCustomerId: customerId }).where(eq(profiles.id, input.userId));
  }

  // Abonnement déjà créé chez Stripe mais pas encore enregistré ici (confirmation en cours) : pas de second abonnement.
  try {
    const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
    if (existing.data.some((s) => ["trialing", "active", "past_due", "unpaid"].includes(s.status))) {
      throw new BillingError("already_subscribed", "Un abonnement est déjà en cours de confirmation : patientez quelques secondes et rechargez la page Abonnement.");
    }
  } catch (err) {
    if (err instanceof BillingError) throw err;
    // Contrôle complémentaire au mieux : une erreur réseau ne doit pas bloquer, l'état applicatif a déjà été vérifié.
  }

  const elig = await checkTrialEligibility(db, input.userId, input.email, input.pepper);
  const trial = elig.eligible && plan.trialHours > 0 && plan.trialHours === TRIAL_HOURS;
  const trialEndSec = trial ? Math.floor(now.getTime() / 1000) + TRIAL_HOURS * 3600 : null;

  const minuteBucket = Math.floor(now.getTime() / 60_000);
  const params: Stripe.Checkout.SessionCreateParams =
    {
      mode: "subscription",
      customer: customerId,
      client_reference_id: input.userId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always",
      locale: "fr",
      allow_promotion_codes: false,
      metadata: { waverti_user_id: input.userId, plan_id: plan.id },
      subscription_data: {
        metadata: { waverti_user_id: input.userId, plan_id: plan.id },
        // Essai exprimé en jours (3 jours = 72 h) : il démarre à la validation du paiement et Stripe l'affiche
        // correctement (une date de fin figée à la création de la session était arrondie à « 2 jours »).
        ...(trialEndSec
          ? {
              trial_period_days: TRIAL_HOURS / 24,
              trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } },
            }
          : {}),
      },
      // Prix facturés en euros TTC uniquement : pas de conversion automatique de devise (avec frais) par Stripe.
      adaptive_pricing: { enabled: false },
      custom_text: {
        submit: {
          message: trialEndSec
            ? `Essai gratuit de 3 jours (72 heures) à partir de maintenant : aucun prélèvement pendant l'essai. Premier prélèvement de ${formatEuros(plan.priceCents)} TTC à la fin de l'essai (vers le ${new Date(trialEndSec * 1000).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long" })}), sauf résiliation avant.`
            : "Abonnement mensuel sans engagement, résiliable à tout moment depuis votre espace Waverti.",
        },
      },
      success_url: `${input.appUrl}/app/abonnement?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.appUrl}/app/abonnement?checkout=canceled`,
    };
  // Idempotence : un double clic dans la même minute ne crée qu'une session ; la clé inclut une empreinte des
  // paramètres (sinon Stripe refuse une même clé réutilisée avec des paramètres différents).
  const paramsHash = createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0, 16);
  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: `checkout:${input.userId}:${plan.id}:${trial ? "trial" : "paid"}:${minuteBucket}:${paramsHash}`,
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
  return { url: session.url, sessionId: session.id, customerId, trialEnd: trialEndSec ? new Date(trialEndSec * 1000) : null };
}

function formatEuros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

/** Identifiants de prix Stripe -> formule (les quatre formules uniquement). */
export async function loadPriceMap(db: Database | Transaction): Promise<{ plans: Map<string, string> }> {
  const p = await db.select({ id: plans.id, price: plans.stripePriceId }).from(plans);
  return { plans: new Map(p.filter((r) => r.price && isPaidPlanId(r.id)).map((r) => [r.price!, r.id])) };
}
