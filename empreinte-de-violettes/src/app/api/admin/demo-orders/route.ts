import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getDoc, list, newId, put, remove } from "@/lib/db";
import { addDays, parisNow } from "@/lib/delivery";
import { accessToken } from "@/lib/orders";
import type { Order, OrderStatus } from "@/lib/types";

const FIRST = ["Camille", "Léa", "Julien", "Manon", "Hugo", "Chloé", "Lucas", "Inès", "Thomas", "Sarah", "Nicolas", "Emma", "Antoine", "Lina", "Pauline", "Mathis"];
const LAST = ["Martin", "Bernard", "Durand", "Petit", "Moreau", "Laurent", "Garcia", "Roux", "Fournier", "Girard", "Bonnet", "Mercier"];
const STREETS = ["chemin de la Coudoulière", "avenue de la Mer", "rue de la République", "boulevard des Plages", "corniche du Cros", "chemin des Playes", "rue Lieutenant Lagaye", "avenue du Brusc"];
const MSG = ["Joyeux anniversaire ma chérie !", "Merci pour tout ✦", "Bienvenue au monde petit trésor", "Avec toutes nos pensées", "Je t'aime", "Bonne fête maman", ""];

/** Génère / supprime des commandes de démonstration (préfixe DEMO-) pour présenter l'administration. */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const [products, delivery] = await Promise.all([list("products"), getDoc("delivery")]);
  const pool = products.filter((p) => p.active);
  const today = parisNow().date;
  const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  let n = 0;
  for (let i = 0; i < 34; i++) {
    const offset = Math.floor(Math.random() * 38) - 30; // de J-30 à J+7
    const created = addDays(today, Math.min(0, offset) - (offset > 0 ? Math.floor(Math.random() * 3) : 0));
    const date = offset > 0 ? addDays(today, offset) : addDays(created, Math.floor(Math.random() * 2));
    const mode = rnd(["delivery", "delivery", "delivery", "pickup", "drive"] as const);
    const zone = rnd(delivery.zones.filter((z) => z.active));
    const items = Array.from({ length: 1 + (Math.random() < 0.25 ? 1 : 0) }, () => {
      const p = rnd(pool);
      const v = p.variants.length ? rnd(p.variants) : null;
      const unit = v?.price ?? p.price;
      const q = Math.random() < 0.85 ? 1 : 2;
      return { productId: p.id, slug: p.slug, name: p.name, variantId: v?.id, variantName: v?.name, unitPrice: unit, quantity: q, image: p.images[0], addons: [], lineTotal: unit * q };
    });
    const subtotal = items.reduce((s, x) => s + x.lineTotal, 0);
    const fee = mode === "delivery" ? (zone.freeFrom != null && subtotal >= zone.freeFrom ? 0 : zone.fee) : 0;
    const past = date < today;
    const status: OrderStatus = past ? (Math.random() < 0.06 ? "cancelled" : mode === "delivery" ? "delivered" : "picked_up") : date === today ? rnd(["preparing", "ready", "paid"] as OrderStatus[]) : "paid";
    const first = rnd(FIRST);
    const last = rnd(LAST);
    const slot = rnd(delivery.slots);
    const at = `${created}T${String(8 + Math.floor(Math.random() * 11)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00.000Z`;
    const order: Order = {
      id: newId("ord"),
      number: `DEMO-${created.slice(2).replace(/-/g, "")}-${String(i).padStart(2, "0")}`,
      accessToken: accessToken(),
      createdAt: at,
      updatedAt: at,
      status,
      paymentStatus: "demo",
      paymentMethod: "demo",
      customer: { firstName: first, lastName: last, email: `${first}.${last}@exemple.fr`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), phone: `06 ${String(Math.floor(Math.random() * 1e8)).padStart(8, "0").replace(/(\d{2})(?=\d)/g, "$1 ")}` },
      mode,
      recipient:
        mode === "delivery"
          ? { name: `${rnd(FIRST)} ${rnd(LAST)}`, phone: "06 00 00 00 00", address: `${1 + Math.floor(Math.random() * 120)} ${rnd(STREETS)}`, postcode: zone.postcodes[0], city: zone.cities[0] }
          : undefined,
      zoneId: mode === "delivery" ? zone.id : undefined,
      zoneName: mode === "delivery" ? zone.name : undefined,
      date,
      slotId: slot.id,
      slotLabel: slot.label,
      items,
      cardMessage: rnd(MSG) || undefined,
      subtotal,
      deliveryFee: fee,
      discount: 0,
      total: subtotal + fee,
      history: [{ at, status: "paid", label: "Commande de démonstration" }],
      stockApplied: true,
    };
    await put("orders", order);
    n++;
  }
  return NextResponse.json({ ok: true, created: n });
}

export async function DELETE() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const orders = await list("orders");
  const demo = orders.filter((o) => o.number.startsWith("DEMO-"));
  for (const o of demo) await remove("orders", o.id);
  return NextResponse.json({ ok: true, removed: demo.length });
}
