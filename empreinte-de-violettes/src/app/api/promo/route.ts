import { NextResponse } from "next/server";
import { findPromo } from "@/lib/pricing";

export async function POST(req: Request) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const res = await findPromo(code);
  if (!res.promo) return NextResponse.json({ ok: false, message: res.error || "Code invalide." });
  const p = res.promo;
  return NextResponse.json({ ok: true, promo: { code: p.code, type: p.type, value: p.value, minSubtotal: p.minSubtotal, description: p.description } });
}
