import { NextResponse } from "next/server";
import { z } from "zod";
import { list, newId, put } from "@/lib/db";

export async function POST(req: Request) {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  const subs = await list("subscribers");
  if (!subs.some((s) => s.email === parsed.data.email)) {
    await put("subscribers", { id: newId("sub"), email: parsed.data.email, createdAt: new Date().toISOString() });
  }
  return NextResponse.json({ ok: true });
}
