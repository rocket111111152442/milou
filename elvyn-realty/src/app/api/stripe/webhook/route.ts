import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { env } from "@/config/env";
import { getStripe } from "@/lib/payments/stripe";
import { addPurchasedCredit } from "@/lib/ai/credits";
import { log } from "@/lib/log";

export const runtime = "nodejs";

/**
 * Stripe webhook (checkout.session.completed / async_payment_succeeded).
 * Tokens are added only for a verified, paid session, once per session id.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe || !env.stripe.webhookSecret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.stripe.webhookSecret);
  } catch {
    log.warn("stripe.invalid_signature", {});
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.metadata?.purpose === "ai_credits" && s.payment_status === "paid" && s.amount_total) {
      const added = await addPurchasedCredit(s.id, s.amount_total / 100, s.currency ?? env.stripe.currency);
      log.info("stripe.credit_added", { session: s.id.slice(-8), duplicate: !added });
    }
  }
  return NextResponse.json({ received: true });
}
