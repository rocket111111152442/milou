import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { resetToDemo } from "@/lib/db";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== "REINITIALISER") return NextResponse.json({ error: "Confirmation requise" }, { status: 400 });
  await resetToDemo();
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
