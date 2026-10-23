import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { get, put } from "@/lib/db";
import { confirmOrder, getStripe, setOrderStatus, siteUrl } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Stripe non configuré" }, { status: 400 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, req.headers.get("stripe-signature") || "", secret);
  } catch (e) {
    console.error("[webhook] signature invalide", e);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }
  const base = siteUrl(req.url);
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object as Stripe.Checkout.Session;
      const orderId = s.metadata?.orderId;
      if (orderId && s.payment_status === "paid") {
        await confirmOrder(orderId, {
          paymentStatus: "paid",
          paymentIntentId: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id,
          base,
        });
      }
      break;
    }
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      const orderId = s.metadata?.orderId;
      const order = orderId ? await get("orders", orderId) : null;
      if (order && order.status === "pending_payment") {
        await setOrderStatus(order.id, "cancelled", { notify: false, base, note: "Paiement abandonné (session expirée)" });
      }
      break;
    }
    case "charge.refunded": {
      const c = event.data.object as Stripe.Charge;
      const orderId = c.metadata?.orderId;
      const order = orderId ? await get("orders", orderId) : null;
      if (order && order.status !== "refunded" && c.refunded) {
        order.paymentStatus = "refunded";
        await put("orders", order);
        await setOrderStatus(order.id, "refunded", { notify: true, base, note: "Remboursement Stripe" });
      }
      break;
    }
  }
  return NextResponse.json({ received: true });
}
