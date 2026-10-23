import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { setOrderStatus, siteUrl } from "@/lib/orders";

const schema = z.object({
  status: z.enum(["pending_payment", "paid", "preparing", "ready", "out_for_delivery", "delivered", "picked_up", "cancelled", "refunded"]),
  notify: z.boolean().default(true),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  const order = await setOrderStatus(id, parsed.data.status, { notify: parsed.data.notify, base: siteUrl(req.url) });
  return order ? NextResponse.json({ order }) : NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
}
