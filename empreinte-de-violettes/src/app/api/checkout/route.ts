import { NextResponse } from "next/server";
import { getDoc, list, newId, put } from "@/lib/db";
import { isModeEnabled, isSlotAvailable } from "@/lib/delivery";
import { accessToken, confirmOrder, getStripe, orderNumber, siteUrl } from "@/lib/orders";
import { priceCart } from "@/lib/pricing";
import { checkoutSchema, firstError } from "@/lib/validation";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const body = parsed.data;
  const base = siteUrl(req.url);

  const [settings, delivery, orders] = await Promise.all([getDoc("settings"), getDoc("delivery"), list("orders")]);
  if (settings.maintenance.enabled) return NextResponse.json({ error: "La boutique est momentanément fermée." }, { status: 503 });
  if (!isModeEnabled(delivery, body.mode)) return NextResponse.json({ error: "Ce mode de retrait n'est pas disponible." }, { status: 400 });
  if (body.mode === "delivery" && !body.recipient) return NextResponse.json({ error: "Adresse de livraison manquante." }, { status: 400 });

  const priced = await priceCart(body.lines, {
    mode: body.mode,
    postcode: body.recipient?.postcode,
    city: body.recipient?.city,
    promoCode: body.promoCode,
  });
  if (priced.errors.length) return NextResponse.json({ error: priced.errors[0], errors: priced.errors }, { status: 400 });

  const slotCheck = isSlotAvailable(delivery, settings, body.mode, body.date, body.slotId, orders);
  if (!slotCheck.ok) return NextResponse.json({ error: `Créneau indisponible : ${slotCheck.reason}` }, { status: 400 });

  const stripe = getStripe();
  const payInStore = !!body.payInStore && settings.allowPayInStore && body.mode !== "delivery";
  const method: Order["paymentMethod"] = payInStore ? "in_store" : stripe ? "stripe" : "demo";
  const now = new Date().toISOString();
  const order: Order = {
    id: newId("ord"),
    number: orderNumber(),
    accessToken: accessToken(),
    createdAt: now,
    updatedAt: now,
    status: "pending_payment",
    paymentStatus: "unpaid",
    paymentMethod: method,
    customer: body.customer,
    mode: body.mode,
    recipient: body.mode === "delivery" ? body.recipient : undefined,
    zoneId: priced.zone?.id,
    zoneName: priced.zone?.name,
    date: body.date,
    slotId: body.slotId,
    slotLabel: slotCheck.slot?.label || "",
    items: priced.items,
    cardMessage: body.cardMessage,
    cardSignature: body.cardSignature,
    anonymous: body.anonymous,
    subtotal: priced.subtotal,
    deliveryFee: priced.deliveryFee,
    discount: priced.discount,
    promoCode: priced.promo?.code,
    total: priced.total,
    history: [{ at: now, status: "pending_payment", label: "Commande créée" }],
  };
  await put("orders", order);

  const confirmation = `${base}/commande/confirmation?n=${encodeURIComponent(order.number)}&t=${order.accessToken}`;

  if (method !== "stripe") {
    const confirmed = await confirmOrder(order.id, { paymentStatus: method === "in_store" ? "in_store" : "demo", base });
    return NextResponse.json({ url: confirmation, demo: method === "demo", order: confirmed });
  }

  try {
    const lineItems = priced.items.map((i) => ({
      quantity: i.quantity,
      price_data: {
        currency: "eur",
        unit_amount: i.unitPrice,
        product_data: {
          name: i.variantName ? `${i.name} — ${i.variantName}` : i.name,
          ...(i.addons.length ? { description: `+ ${i.addons.map((a) => a.name).join(", ")}` } : {}),
          ...(i.image && /^https:\/\//.test(i.image) ? { images: [i.image + (i.image.includes("unsplash") ? "?w=600&q=70" : "")] } : {}),
        },
      },
    }));
    if (priced.deliveryFee > 0) {
      lineItems.push({
        quantity: 1,
        price_data: { currency: "eur", unit_amount: priced.deliveryFee, product_data: { name: `Livraison — ${priced.zone?.name || ""}` } },
      });
    }
    let discounts: { coupon: string }[] | undefined;
    if (priced.discount > 0) {
      const coupon = await stripe!.coupons.create({
        amount_off: priced.discount,
        currency: "eur",
        duration: "once",
        max_redemptions: 1,
        name: priced.promo?.code || "Remise",
      });
      discounts = [{ coupon: coupon.id }];
    }
    const session = await stripe!.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      line_items: lineItems,
      discounts,
      customer_email: body.customer.email,
      client_reference_id: order.id,
      metadata: { orderId: order.id, orderNumber: order.number },
      payment_intent_data: { metadata: { orderId: order.id, orderNumber: order.number }, description: `Commande ${order.number}` },
      success_url: `${confirmation}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/commande?annule=1`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 45,
    });
    order.stripeSessionId = session.id;
    await put("orders", order);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[checkout] Stripe", e);
    order.status = "cancelled";
    order.history.push({ at: new Date().toISOString(), status: "cancelled", label: "Échec de création du paiement" });
    await put("orders", order);
    return NextResponse.json({ error: "Le paiement n'a pas pu être initialisé. Réessayez dans un instant." }, { status: 502 });
  }
}
