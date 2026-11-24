import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/server";
import { exportContact } from "@/lib/crm/queries";
import { log } from "@/lib/log";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const data = await exportContact(Number(id));
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  log.info("admin.contact_exported", { id: Number(id), by: admin.id });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="prospecto-${id}.json"`, "Cache-Control": "no-store" },
  });
}
