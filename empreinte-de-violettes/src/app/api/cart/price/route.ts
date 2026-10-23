import { NextResponse } from "next/server";
import { z } from "zod";
import { priceCart } from "@/lib/pricing";
import { cartLineSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  lines: z.array(cartLineSchema).max(50),
  mode: z.enum(["delivery", "pickup", "drive"]).default("pickup"),
  postcode: z.string().max(5).optional(),
  city: z.string().max(120).optional(),
  promoCode: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  const { lines, ...opts } = parsed.data;
  const p = await priceCart(lines, { ...opts, postcode: opts.postcode && /^\d{5}$/.test(opts.postcode) ? opts.postcode : undefined });
  return NextResponse.json({
    subtotal: p.subtotal,
    deliveryFee: p.deliveryFee,
    discount: p.discount,
    total: p.total,
    zone: p.zone ? { name: p.zone.name, freeFrom: p.zone.freeFrom, minOrder: p.zone.minOrder } : null,
    promo: p.promo ? { code: p.promo.code, type: p.promo.type, description: p.promo.description } : null,
    errors: p.errors,
    warnings: p.warnings,
    items: p.items.map((i) => ({ name: i.name, unitPrice: i.unitPrice, quantity: i.quantity, lineTotal: i.lineTotal })),
  });
}
