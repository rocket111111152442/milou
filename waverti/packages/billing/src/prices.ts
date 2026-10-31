/**
 * Prix Stripe des quatre formules, trouvés par leur clé de recherche (lookup_key) — jamais inventés.
 * Avant tout paiement, le prix est contrôlé : actif, en EUR, mensuel, montant identique au catalogue.
 * Un prix non conforme bloque le paiement (aucun prélèvement d'un montant inattendu).
 */
import { eq, plans, type Database } from "@waverti/database";
import { BillingError } from "./checkout";
import { PAID_PLAN_IDS, PLAN_CATALOG, RETIRED_STRIPE_LOOKUP_KEYS, type PaidPlanId } from "./catalog";
import type { Stripe, StripeClient } from "./stripe";

export interface PlanPriceCheck {
  planId: PaidPlanId;
  lookupKey: string;
  expectedCents: number;
  priceId: string | null;
  ok: boolean;
  issues: string[];
}

export function checkPrice(planId: PaidPlanId, price: Stripe.Price | undefined): PlanPriceCheck {
  const def = PLAN_CATALOG[planId];
  const base = { planId, lookupKey: def.stripeLookupKey, expectedCents: def.priceCents, priceId: price?.id ?? null };
  if (!price) return { ...base, ok: false, issues: ["aucun prix actif avec cette clé de recherche"] };
  const issues: string[] = [];
  if (!price.active) issues.push("prix archivé");
  if (price.currency !== "eur") issues.push(`devise ${price.currency.toUpperCase()} au lieu de EUR`);
  if (price.type !== "recurring" || price.recurring?.interval !== "month" || price.recurring?.interval_count !== 1) {
    issues.push("facturation non mensuelle");
  }
  if (price.recurring?.usage_type && price.recurring.usage_type !== "licensed") issues.push("facturation à l'usage");
  if (price.unit_amount !== def.priceCents) issues.push(`montant ${price.unit_amount ?? "?"} au lieu de ${def.priceCents} centimes`);
  if (price.tax_behavior === "exclusive") issues.push("prix hors taxes (les prix affichés sont TTC)");
  return { ...base, ok: issues.length === 0, issues };
}

/** Lecture seule : contrôle des quatre prix et repérage de l'ancienne option encore active. */
export async function verifyPlanPrices(stripe: StripeClient): Promise<{ plans: PlanPriceCheck[]; retiredActive: string[] }> {
  const keys = [...PAID_PLAN_IDS.map((id) => PLAN_CATALOG[id].stripeLookupKey), ...RETIRED_STRIPE_LOOKUP_KEYS];
  const list = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 20 });
  const byKey = new Map(list.data.filter((p) => p.lookup_key).map((p) => [p.lookup_key!, p]));
  return {
    plans: PAID_PLAN_IDS.map((id) => checkPrice(id, byKey.get(PLAN_CATALOG[id].stripeLookupKey))),
    retiredActive: RETIRED_STRIPE_LOOKUP_KEYS.filter((k) => byKey.has(k)),
  };
}

/**
 * Identifiant du prix à facturer pour une formule. Recherché par clé de recherche chez Stripe et contrôlé
 * à chaque création de paiement ou changement de formule ; mémorisé dans `plans.stripe_price_id` pour que les
 * webhooks reconnaissent la formule.
 */
export async function resolvePlanPriceId(db: Database, stripe: StripeClient, planId: PaidPlanId): Promise<string> {
  const def = PLAN_CATALOG[planId];
  const list = await stripe.prices.list({ lookup_keys: [def.stripeLookupKey], active: true, limit: 1 });
  const check = checkPrice(planId, list.data[0]);
  if (!check.ok || !check.priceId) {
    throw new BillingError("price_missing", `Cette formule n'est pas disponible au paiement (${check.issues.join(", ")}).`);
  }
  await db.update(plans).set({ stripePriceId: check.priceId }).where(eq(plans.id, planId));
  return check.priceId;
}
