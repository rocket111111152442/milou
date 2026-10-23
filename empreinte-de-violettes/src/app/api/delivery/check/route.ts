import { NextResponse } from "next/server";
import { getDoc } from "@/lib/db";
import { findZone } from "@/lib/delivery";

export async function POST(req: Request) {
  const { postcode, city } = (await req.json().catch(() => ({}))) as { postcode?: string; city?: string };
  if (!postcode || !/^\d{5}$/.test(postcode.trim())) return NextResponse.json({ ok: false, message: "Code postal invalide." });
  const delivery = await getDoc("delivery");
  if (!delivery.deliveryEnabled) return NextResponse.json({ ok: false, message: "La livraison est momentanément suspendue. Le retrait en boutique reste possible." });
  const zone = findZone(delivery, postcode.trim(), city);
  if (!zone) return NextResponse.json({ ok: false, message: "Nous ne livrons pas encore ce secteur — appelez-nous, on trouve toujours une solution." });
  return NextResponse.json({ ok: true, zone: { id: zone.id, name: zone.name, fee: zone.fee, minOrder: zone.minOrder, freeFrom: zone.freeFrom, cities: zone.cities } });
}
