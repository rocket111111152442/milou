import { NextResponse } from "next/server";
import { list } from "@/lib/db";

export async function POST(req: Request) {
  const { number, email } = (await req.json().catch(() => ({}))) as { number?: string; email?: string };
  if (!number || !email) return NextResponse.json({ ok: false, message: "Numéro de commande et e-mail requis." }, { status: 400 });
  const orders = await list("orders");
  const o = orders.find((x) => x.number.toUpperCase() === number.trim().toUpperCase() && x.customer.email.toLowerCase() === email.trim().toLowerCase());
  if (!o) return NextResponse.json({ ok: false, message: "Aucune commande ne correspond à ces informations." });
  return NextResponse.json({ ok: true, url: `/suivi?n=${encodeURIComponent(o.number)}&t=${o.accessToken}` });
}
