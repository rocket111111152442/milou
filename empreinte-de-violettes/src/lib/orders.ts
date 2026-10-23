import "server-only";
import Stripe from "stripe";
import { get, getDoc, list, put } from "./db";
import { orderConfirmationEmail, orderNotificationEmail, sendEmail, statusEmail } from "./email";
import { ORDER_STATUS } from "./format";
import type { Order, OrderStatus } from "./types";

let stripe: Stripe | null | undefined;
export function getStripe() {
  if (stripe !== undefined) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  stripe = key ? new Stripe(key) : null;
  return stripe;
}

export function siteUrl(reqUrl?: string) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (reqUrl) return new URL(reqUrl).origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function orderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map((b) => (b % 36).toString(36))
    .join("")
    .toUpperCase();
  return `EV-${ymd}-${rand}`;
}

export function accessToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const trackUrl = (base: string, o: Order) => `${base}/suivi?n=${encodeURIComponent(o.number)}&t=${o.accessToken}`;

/** Applique le stock et le compteur promo une seule fois. */
async function applyStockAndPromo(order: Order) {
  if (order.stockApplied) return;
  for (const item of order.items) {
    if (!item.productId) continue;
    const p = await get("products", item.productId);
    if (p && p.stock != null) {
      p.stock = Math.max(0, p.stock - item.quantity);
      p.updatedAt = new Date().toISOString();
      await put("products", p);
    }
  }
  if (order.promoCode) {
    const promos = await list("promos");
    const promo = promos.find((p) => p.code === order.promoCode);
    if (promo) await put("promos", { ...promo, uses: promo.uses + 1 });
  }
  order.stockApplied = true;
}

/** Finalise une commande payée (idempotent) : statut, stock, e-mails. */
export async function confirmOrder(orderId: string, opts: { paymentStatus: Order["paymentStatus"]; paymentIntentId?: string; base: string }) {
  const order = await get("orders", orderId);
  if (!order) return null;
  if (order.status !== "pending_payment") return order;
  const now = new Date().toISOString();
  order.status = "paid";
  order.paymentStatus = opts.paymentStatus;
  if (opts.paymentIntentId) order.stripePaymentIntentId = opts.paymentIntentId;
  order.updatedAt = now;
  order.history.push({
    at: now,
    status: "paid",
    label: opts.paymentStatus === "paid" ? "Paiement reçu (Stripe)" : opts.paymentStatus === "in_store" ? "Commande confirmée — règlement au retrait" : "Commande confirmée (mode démo)",
  });
  await applyStockAndPromo(order);
  await put("orders", order);

  const settings = await getDoc("settings");
  const conf = orderConfirmationEmail(order, settings, trackUrl(opts.base, order));
  const notif = orderNotificationEmail(order, settings, `${opts.base}/admin/commandes/${order.id}`);
  await Promise.all([
    sendEmail({ to: order.customer.email, subject: conf.subject, html: conf.html, replyTo: settings.email }),
    sendEmail({ to: settings.notifyEmail, subject: notif.subject, html: notif.html, replyTo: order.customer.email }),
  ]);
  return order;
}

export async function setOrderStatus(orderId: string, status: OrderStatus, opts: { notify: boolean; base: string; note?: string }) {
  const order = await get("orders", orderId);
  if (!order) return null;
  const now = new Date().toISOString();
  if (status === "paid" && order.status === "pending_payment") {
    return confirmOrder(orderId, { paymentStatus: order.paymentMethod === "in_store" ? "in_store" : "paid", base: opts.base });
  }
  order.status = status;
  order.updatedAt = now;
  order.history.push({ at: now, status, label: opts.note || ORDER_STATUS[status]?.label || status });
  await put("orders", order);
  if (opts.notify && ["ready", "out_for_delivery", "delivered", "cancelled", "refunded"].includes(status)) {
    const settings = await getDoc("settings");
    const mail = statusEmail(order, settings, trackUrl(opts.base, order));
    await sendEmail({ to: order.customer.email, subject: mail.subject, html: mail.html, replyTo: settings.email });
  }
  return order;
}

export async function refundOrder(orderId: string, base: string) {
  const order = await get("orders", orderId);
  if (!order) throw new Error("Commande introuvable");
  const s = getStripe();
  if (order.paymentMethod === "stripe") {
    if (!s) throw new Error("Stripe n'est pas configuré.");
    if (!order.stripePaymentIntentId) throw new Error("Aucun paiement Stripe associé à cette commande.");
    await s.refunds.create({ payment_intent: order.stripePaymentIntentId });
  }
  order.paymentStatus = "refunded";
  await put("orders", order);
  return setOrderStatus(orderId, "refunded", { notify: true, base, note: "Remboursement effectué" });
}
