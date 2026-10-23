import "server-only";
import { getDoc, list } from "./db";
import { deliveryFeeFor, findZone } from "./delivery";
import type { DeliveryZone, FulfillmentMode, OrderItem, PromoCode } from "./types";

export interface CartLineInput {
  productId: string | null;
  variantId?: string;
  quantity: number;
  addonIds?: string[];
  custom?: { stems: { flowerId: string; quantity: number }[]; wrappingId?: string; note?: string };
}

export interface PricedCart {
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  zone: DeliveryZone | null;
  promo: PromoCode | null;
  errors: string[];
  warnings: string[];
}

export async function findPromo(code: string | undefined | null): Promise<{ promo: PromoCode | null; error?: string }> {
  if (!code) return { promo: null };
  const promos = await list("promos");
  const promo = promos.find((p) => p.code.toUpperCase() === code.trim().toUpperCase());
  if (!promo || !promo.active) return { promo: null, error: "Ce code n'est pas valide." };
  const today = new Date().toISOString().slice(0, 10);
  if (promo.startsAt && today < promo.startsAt.slice(0, 10)) return { promo: null, error: "Ce code n'est pas encore actif." };
  if (promo.endsAt && today > promo.endsAt.slice(0, 10)) return { promo: null, error: "Ce code a expiré." };
  if (promo.maxUses != null && promo.uses >= promo.maxUses) return { promo: null, error: "Ce code a atteint sa limite d'utilisation." };
  return { promo };
}

export async function priceCart(
  lines: CartLineInput[],
  opts: { mode: FulfillmentMode; postcode?: string; city?: string; promoCode?: string | null },
): Promise<PricedCart> {
  const [products, addons, atelier, delivery] = await Promise.all([list("products"), list("addons"), getDoc("atelier"), getDoc("delivery")]);
  const errors: string[] = [];
  const warnings: string[] = [];
  const items: OrderItem[] = [];

  for (const line of lines.slice(0, 50)) {
    const qty = Math.max(1, Math.min(20, Math.floor(line.quantity || 1)));
    const lineAddons = (line.addonIds || [])
      .map((id) => addons.find((a) => a.id === id && a.active))
      .filter(Boolean)
      .map((a) => ({ id: a!.id, name: a!.name, price: a!.price }));
    const addonsTotal = lineAddons.reduce((s, a) => s + a.price, 0);

    if (line.productId) {
      const p = products.find((x) => x.id === line.productId);
      if (!p || !p.active) {
        errors.push("Un article de votre panier n'est plus disponible.");
        continue;
      }
      if (p.stock != null && p.stock < qty) {
        errors.push(p.stock <= 0 ? `« ${p.name} » est épuisé.` : `Il ne reste que ${p.stock} « ${p.name} ».`);
        continue;
      }
      if (opts.mode === "delivery" && p.pickupOnly) errors.push(`« ${p.name} » est uniquement disponible en retrait.`);
      if (opts.mode !== "delivery" && p.deliveryOnly) warnings.push(`« ${p.name} » est habituellement livré : nous vous contacterons pour l'organisation.`);
      let unit = p.price;
      let variantName: string | undefined;
      if (p.variants.length) {
        const v = p.variants.find((x) => x.id === line.variantId) || p.variants[0];
        unit = v.price;
        variantName = v.name;
      }
      unit += addonsTotal;
      items.push({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        variantId: line.variantId,
        variantName,
        unitPrice: unit,
        quantity: qty,
        image: p.images[0],
        addons: lineAddons,
        lineTotal: unit * qty,
      });
    } else if (line.custom) {
      if (!atelier.enabled) {
        errors.push("L'atelier de composition est momentanément fermé.");
        continue;
      }
      const stems = line.custom.stems
        .map((s) => {
          const f = atelier.flowers.find((x) => x.id === s.flowerId && x.active);
          return f ? { flowerId: f.id, name: f.name, quantity: Math.max(0, Math.floor(s.quantity)), unitPrice: f.price } : null;
        })
        .filter((s): s is NonNullable<typeof s> => !!s && s.quantity > 0);
      const count = stems.reduce((n, s) => n + s.quantity, 0);
      if (count < atelier.minStems || count > atelier.maxStems) {
        errors.push(`Une création de l'atelier doit compter entre ${atelier.minStems} et ${atelier.maxStems} tiges.`);
        continue;
      }
      const wrap = atelier.wrappings.find((w) => w.id === line.custom!.wrappingId) || atelier.wrappings[0];
      const unit = atelier.basePrice + stems.reduce((s, x) => s + x.unitPrice * x.quantity, 0) + (wrap?.price || 0) + addonsTotal;
      items.push({
        productId: null,
        name: "Création de l'atelier",
        variantName: `${count} tiges · ${wrap?.name || ""}`,
        unitPrice: unit,
        quantity: qty,
        addons: lineAddons,
        custom: { stems, wrappingId: wrap?.id, wrappingName: wrap?.name, note: line.custom.note?.slice(0, 300) },
        lineTotal: unit * qty,
      });
    }
  }

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  let deliveryFee = 0;
  let zone: DeliveryZone | null = null;
  if (opts.mode === "delivery") {
    if (!opts.postcode) errors.push("Indiquez le code postal de livraison.");
    else {
      zone = findZone(delivery, opts.postcode, opts.city);
      if (!zone) errors.push("Nous ne livrons pas encore cette adresse. Choisissez le retrait en boutique ou contactez-nous.");
      else {
        if (subtotal < zone.minOrder) errors.push(`Minimum de commande pour ${zone.name} : ${(zone.minOrder / 100).toFixed(0)} €.`);
        deliveryFee = deliveryFeeFor(zone, subtotal);
      }
    }
  }

  let discount = 0;
  let promo: PromoCode | null = null;
  if (opts.promoCode) {
    const res = await findPromo(opts.promoCode);
    if (res.error) warnings.push(res.error);
    else if (res.promo) {
      if (subtotal < res.promo.minSubtotal) warnings.push(`Ce code est valable dès ${(res.promo.minSubtotal / 100).toFixed(0)} € d'achat.`);
      else {
        promo = res.promo;
        if (promo.type === "percent") discount = Math.round((subtotal * Math.min(100, promo.value)) / 100);
        else if (promo.type === "fixed") discount = Math.min(promo.value, subtotal);
        else if (promo.type === "free_delivery") discount = deliveryFee;
      }
    }
  }
  if (!items.length && !errors.length) errors.push("Votre panier est vide.");
  const total = Math.max(0, subtotal + deliveryFee - discount);
  return { items, subtotal, deliveryFee, discount, total, zone, promo, errors, warnings };
}
