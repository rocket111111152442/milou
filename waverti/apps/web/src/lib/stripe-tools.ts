import { billingMode } from "@waverti/config/env";

/**
 * Outils de recette Stripe (terminer un essai, déclencher un renouvellement) : uniquement hors Production, avec une
 * clé de TEST et si WAVERTI_BILLING_TEST_TOOLS=1 (variable posée sur Preview seulement).
 */
export function testBillingToolsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV !== "production" && billingMode(env) === "test" && env.WAVERTI_BILLING_TEST_TOOLS === "1";
}
