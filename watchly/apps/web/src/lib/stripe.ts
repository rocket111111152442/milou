import "server-only";
import { BillingError, createStripeClient, type StripeClient } from "@watchly/billing";

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.WATCHLY_HASH_PEPPER);
}

let client: StripeClient | null = null;
export function getStripe(): StripeClient {
  if (!isBillingConfigured()) throw new BillingError("not_configured", "Le paiement n'est pas configuré sur cet environnement.");
  client ??= createStripeClient(process.env.STRIPE_SECRET_KEY!, process.env.STRIPE_API_BASE);
  return client;
}
