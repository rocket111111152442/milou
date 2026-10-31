import "server-only";
import { BillingError, createStripeClient, isLocalStripeMock, withMockCatalogPrices, type StripeClient } from "@waverti/billing";
import { billingMode, type BillingMode } from "@waverti/config/env";

export function currentBillingMode(): BillingMode {
  return billingMode(process.env);
}

/**
 * Paiement utilisable : clé de test (ou live explicitement autorisée), secret de webhook et poivre présents.
 * Une clé live non autorisée rend le paiement indisponible (au lieu d'erreurs 500 à chaque appel).
 */
export function isBillingConfigured(): boolean {
  const mode = currentBillingMode();
  return (mode === "test" || mode === "live") && Boolean(process.env.STRIPE_WEBHOOK_SECRET && process.env.WAVERTI_HASH_PEPPER);
}

let client: StripeClient | null = null;
export function getStripe(): StripeClient {
  if (!isBillingConfigured()) throw new BillingError("not_configured", "Le paiement n'est pas configuré sur cet environnement.");
  if (!client) {
    const apiBase = process.env.STRIPE_API_BASE;
    const c = createStripeClient(process.env.STRIPE_SECRET_KEY!, apiBase);
    // Tests locaux contre stripe-mock uniquement (hôte local) : prix du catalogue simulés.
    client = isLocalStripeMock(apiBase) ? withMockCatalogPrices(c) : c;
  }
  return client;
}
