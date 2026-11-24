import "server-only";
import Stripe from "stripe";
import { env } from "@/config/env";

let client: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (!env.stripe.secretKey) return null;
  client ??= new Stripe(env.stripe.secretKey, { maxNetworkRetries: 2, timeout: 20_000 });
  return client;
}
export const paymentsConfigured = () => Boolean(env.stripe.secretKey && env.stripe.webhookSecret);

export function validTopUpAmount(amount: unknown): number | null {
  const n = Number(amount);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < env.stripe.minAmount || n > env.stripe.maxAmount) return null;
  return n;
}
