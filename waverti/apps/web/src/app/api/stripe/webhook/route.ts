import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@waverti/billing";
import { getDb } from "@/lib/db";
import { getStripe, isBillingConfigured } from "@/lib/stripe";

/** Webhook Stripe : corps brut requis pour la vérification de signature. */
export async function POST(req: Request) {
  if (!isBillingConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const raw = await req.text();
  if (raw.length > 512 * 1024) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const res = await handleStripeWebhook(
    { db: getDb(), stripe: getStripe(), webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!, pepper: process.env.WAVERTI_HASH_PEPPER },
    raw,
    req.headers.get("stripe-signature"),
  );
  return NextResponse.json(res.body, { status: res.status });
}
