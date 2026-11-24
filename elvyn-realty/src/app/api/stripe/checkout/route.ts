import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/config/env";
import { getAdmin } from "@/lib/auth/server";
import { getStripe, validTopUpAmount } from "@/lib/payments/stripe";
import { sameOrigin } from "@/lib/security/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";

/** Creates a Stripe Checkout page for a token top-up (CRM users only). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers, env.siteUrl)) return NextResponse.json({ error: "origin" }, { status: 403 });
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { amount?: unknown };
  const amount = validTopUpAmount(body.amount);
  if (!amount) return NextResponse.json({ error: "invalid_amount", min: env.stripe.minAmount, max: env.stripe.maxAmount }, { status: 400 });
  const base = (req.headers.get("origin") ?? env.siteUrl).replace(/\/$/, "");
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: env.stripe.currency,
            unit_amount: amount * 100,
            product_data: { name: "Recarga de tokens · Asistente IA", description: "Tokens adicionales para el asistente IA del sitio web" },
          },
        },
      ],
      customer_email: admin.email,
      metadata: { purpose: "ai_credits", admin_id: String(admin.id) },
      success_url: `${base}/admin/asistente?pago=ok`,
      cancel_url: `${base}/admin/asistente?pago=cancelado`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    log.error("stripe.checkout_failed", { kind: (err as Error).name });
    return NextResponse.json({ error: "stripe_error" }, { status: 502 });
  }
}
