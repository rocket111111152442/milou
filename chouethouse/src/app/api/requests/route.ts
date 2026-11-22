import { NextResponse } from "next/server";
import { addRequest } from "@/lib/store";
import { uid } from "@/lib/format";
import type { RequestType } from "@/lib/types";

const TYPES: RequestType[] = ["reservation-table", "atelier", "anniversaire", "contact"];

export async function POST(req: Request) {
  let body: { type?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const type = body.type as RequestType;
  const data = body.data ?? {};
  if (!TYPES.includes(type)) return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  // honeypot
  if (typeof data.website === "string" && data.website.trim()) return NextResponse.json({ ok: true });

  const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = clean(data.name, 120);
  const email = clean(data.email, 160);
  const phone = clean(data.phone, 40);
  const message = clean(data.message, 3000);
  if (!name) return NextResponse.json({ error: "Merci d'indiquer votre nom" }, { status: 400 });
  if (!email && !phone) return NextResponse.json({ error: "Merci d'indiquer un e-mail ou un téléphone" }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "E-mail invalide" }, { status: 400 });

  const details: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (["name", "email", "phone", "message", "website"].includes(k)) continue;
    const val = clean(v);
    if (val) details[k.slice(0, 40)] = val;
    if (Object.keys(details).length > 15) break;
  }

  try {
    await addRequest({ id: uid("r-"), type, createdAt: new Date().toISOString(), name, email, phone, message, details, status: "nouveau" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Enregistrement impossible pour le moment" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
