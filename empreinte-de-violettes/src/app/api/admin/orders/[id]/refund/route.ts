import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { refundOrder, siteUrl } from "@/lib/orders";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    const order = await refundOrder(id, siteUrl(req.url));
    return NextResponse.json({ order });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Échec du remboursement" }, { status: 400 });
  }
}
