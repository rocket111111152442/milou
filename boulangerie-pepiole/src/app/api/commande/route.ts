import { NextResponse } from "next/server";
import { Resend } from "resend";
import { orderSchema, type OrderResponse } from "@/lib/order";
import { PRODUCTS_BY_ID, formatPrice } from "@/lib/catalog";
import { formatDateLong, formatTime, isValidSlot, leadMinutesFor, parisNow } from "@/lib/hours";
import { getShop } from "@/lib/shops";
import { orderEmailTo, ordersEnabled } from "@/lib/order-config";

export const runtime = "nodejs";

// Limitation simple par IP (mémoire de l'instance, au mieux)
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 8;
}

function fail(error: string, status = 400) {
  return NextResponse.json<OrderResponse>({ ok: false, error }, { status });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return fail("Trop de tentatives, réessayez dans quelques minutes.", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Requête invalide.");
  }

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Commande invalide.");
  const order = parsed.data;

  // Les prix sont recalculés côté serveur, jamais repris du navigateur.
  const lines = [];
  for (const item of order.items) {
    const product = PRODUCTS_BY_ID.get(item.id);
    if (!product || product.available === false) return fail("Un produit de votre panier n'est plus disponible.");
    lines.push({ product, qty: item.qty, total: product.price * item.qty });
  }
  const total = lines.reduce((s, l) => s + l.total, 0);
  const lead = leadMinutesFor(lines.map((l) => l.product.leadHours ?? 0));
  const shop = getShop(order.pickup.shop);

  if (!isValidSlot(shop, order.pickup.date, order.pickup.time, lead)) {
    return fail("Ce créneau de retrait n'est plus disponible. Merci d'en choisir un autre.");
  }

  const now = parisNow();
  const orderNumber = `PP-${now.date.slice(2).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const pickupLabel = `${formatDateLong(order.pickup.date)} à ${formatTime(order.pickup.time)}`;
  const shopLabel = `${shop.name} – ${shop.address.street}, ${shop.address.postalCode} ${shop.address.city}`;
  const c = order.customer;

  const payload = {
    orderNumber,
    createdAt: new Date().toISOString(),
    pickup: { ...order.pickup, label: pickupLabel, shopName: shop.name, shopAddress: shopLabel },
    customer: c,
    items: lines.map((l) => ({
      id: l.product.id,
      name: l.product.name,
      unit: l.product.unit ?? null,
      qty: l.qty,
      unitPrice: l.product.price / 100,
      total: l.total / 100,
    })),
    total: total / 100,
    payment: "En boutique, au retrait",
  };

  if (!ordersEnabled(shop.id)) {
    return NextResponse.json<OrderResponse>({ ok: true, orderNumber, total, demo: true });
  }

  const errors: string[] = [];

  if (process.env.ORDER_WEBHOOK_URL) {
    try {
      const res = await fetch(process.env.ORDER_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) errors.push(`webhook ${res.status}`);
    } catch (e) {
      errors.push(`webhook ${(e as Error).message}`);
    }
  }

  const emailTo = orderEmailTo(shop.id);
  if (process.env.RESEND_API_KEY && emailTo) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.ORDER_EMAIL_FROM || "Le Pétrin de Pépiole <onboarding@resend.dev>";
    const rows = lines
      .map(
        (l) =>
          `<tr><td style="padding:6px 0">${l.qty} × ${escapeHtml(l.product.name)}${l.product.unit ? ` <span style="color:#8a7a68">(${escapeHtml(l.product.unit)})</span>` : ""}</td><td style="padding:6px 0;text-align:right">${formatPrice(l.total)}</td></tr>`,
      )
      .join("");
    const table = `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows}<tr><td style="padding-top:12px;border-top:1px solid #e6d9c4"><strong>Total</strong></td><td style="padding-top:12px;border-top:1px solid #e6d9c4;text-align:right"><strong>${formatPrice(total)}</strong></td></tr></table>`;
    const wrap = (inner: string) =>
      `<div style="font-family:Georgia,serif;background:#f6efe2;padding:24px"><div style="max-width:560px;margin:auto;background:#fffaf2;border-radius:16px;padding:28px;color:#3b2416">${inner}</div></div>`;

    const shopHtml = wrap(`
      <h1 style="margin:0 0 4px;font-size:22px">Nouvelle commande ${orderNumber}</h1>
      <p style="margin:0 0 4px;color:#8a7a68">Boutique : <strong style="color:#3b2416">${escapeHtml(shop.name)} (${escapeHtml(shop.short)})</strong></p>
      <p style="margin:0 0 20px;color:#8a7a68">Retrait : <strong style="color:#b5652b">${escapeHtml(pickupLabel)}</strong></p>
      <p style="margin:0 0 16px">${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)} · <a href="tel:${escapeHtml(c.phone.replace(/\s/g, ""))}">${escapeHtml(c.phone)}</a>${c.email ? ` · ${escapeHtml(c.email)}` : ""}</p>
      ${table}
      ${c.note ? `<p style="margin-top:20px;padding:12px;background:#f6efe2;border-radius:8px"><em>Note :</em> ${escapeHtml(c.note)}</p>` : ""}
      <p style="margin-top:20px;color:#8a7a68;font-size:13px">Paiement en boutique au retrait.</p>`);

    try {
      const { error } = await resend.emails.send({
        from,
        to: emailTo.split(",").map((s) => s.trim()),
        replyTo: c.email || undefined,
        subject: `🥖 Commande ${orderNumber} — ${shop.short} — retrait ${pickupLabel}`,
        html: shopHtml,
      });
      if (error) errors.push(`email boutique ${error.message}`);
    } catch (e) {
      errors.push(`email boutique ${(e as Error).message}`);
    }

    if (c.email) {
      const clientHtml = wrap(`
        <h1 style="margin:0 0 8px;font-size:22px">Merci ${escapeHtml(c.firstName)} !</h1>
        <p style="margin:0 0 20px">Votre commande <strong>${orderNumber}</strong> est bien transmise à la boutique. Elle vous attendra le <strong style="color:#b5652b">${escapeHtml(pickupLabel)}</strong>, chez <strong>${escapeHtml(shopLabel)}</strong>.</p>
        ${table}
        <p style="margin-top:20px">Règlement en boutique au moment du retrait.<br/>${escapeHtml(shop.name)} · ${escapeHtml(shop.phone.display)}</p>`);
      try {
        await resend.emails.send({
          from,
          to: c.email,
          subject: `Votre commande ${orderNumber} — ${shop.name}`,
          html: clientHtml,
        });
      } catch {
        // La confirmation client est un bonus : on n'échoue pas la commande pour elle.
      }
    }
  }

  // Si aucun canal n'a fonctionné, la boutique n'a rien reçu : on le dit au client.
  const channels = Number(Boolean(process.env.ORDER_WEBHOOK_URL)) + Number(Boolean(process.env.RESEND_API_KEY && emailTo));
  if (errors.length >= channels) {
    console.error("[commande] échec de transmission", orderNumber, errors);
    return fail(`La commande n'a pas pu être transmise. Appelez-nous au ${shop.phone.display}.`, 502);
  }
  if (errors.length) console.warn("[commande] transmission partielle", orderNumber, errors);

  return NextResponse.json<OrderResponse>({ ok: true, orderNumber, total, demo: false });
}
