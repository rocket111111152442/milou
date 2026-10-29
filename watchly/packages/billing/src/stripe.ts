import Stripe from "stripe";
import { assertStripeTestMode } from "@watchly/config/env";
import type { SubscriptionStatus } from "@watchly/database/schema";

export type StripeClient = Stripe;
export type { Stripe };

/**
 * Client Stripe côté serveur uniquement.
 * - Refuse les clés live tant que le lancement commercial n'est pas validé (cf. assertStripeTestMode).
 * - STRIPE_API_BASE permet de cibler stripe-mock pour les tests de contrat.
 */
export function createStripeClient(secretKey: string, apiBase?: string): Stripe {
  assertStripeTestMode(secretKey);
  const opts: Stripe.StripeConfig = { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "Watchly" } };
  if (apiBase) {
    const u = new URL(apiBase);
    opts.host = u.hostname;
    opts.port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
    opts.protocol = u.protocol.replace(":", "") as "http" | "https";
  }
  return new Stripe(secretKey, opts);
}

export function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

/** Statut Stripe -> statut stocké (les statuts inconnus sont traités comme inactifs). */
export function normalizeStatus(s: string): SubscriptionStatus {
  const known = ["trialing", "active", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused"];
  return (known.includes(s) ? s : "incomplete") as SubscriptionStatus;
}

export const toDate = (sec: number | null | undefined): Date | null => (sec ? new Date(sec * 1000) : null);
