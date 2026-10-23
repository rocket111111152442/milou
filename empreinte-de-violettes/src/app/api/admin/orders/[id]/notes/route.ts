import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { get, put } from "@/lib/db";

const schema = z.object({
  adminNotes: z.string().max(4000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slotId: z.string().max(80).optional(),
  slotLabel: z.string().max(120).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  const order = await get("orders", id);
  if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  const now = new Date().toISOString();
  const d = parsed.data;
  if (d.date && (d.date !== order.date || d.slotId !== order.slotId)) {
    order.history.push({ at: now, status: "note", label: `Créneau modifié : ${d.date} · ${d.slotLabel || d.slotId}` });
    order.date = d.date;
    if (d.slotId) order.slotId = d.slotId;
    if (d.slotLabel) order.slotLabel = d.slotLabel;
  }
  if (d.adminNotes !== undefined) order.adminNotes = d.adminNotes;
  order.updatedAt = now;
  await put("orders", order);
  return NextResponse.json({ order });
}
