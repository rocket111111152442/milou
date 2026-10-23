import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { exportAll, importAll } from "@/lib/db";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const data = await exportAll();
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="empreinte-de-violettes-sauvegarde-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object" || !payload.data) return NextResponse.json({ error: "Fichier de sauvegarde invalide" }, { status: 400 });
  await importAll(payload);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
