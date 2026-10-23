import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { get, list, put, remove } from "@/lib/db";
import { slugify } from "@/lib/format";
import { adminSchemas, firstError, type AdminCollection } from "@/lib/validation";
import type { CollectionMap } from "@/lib/types";

export const dynamic = "force-dynamic";

const isCol = (c: string): c is AdminCollection => c in adminSchemas;

type Ctx = { params: Promise<{ col: string; id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { col, id } = await params;
  if (!isCol(col) && col !== "orders") return NextResponse.json({ error: "Collection inconnue" }, { status: 404 });
  const item = await get(col as AdminCollection, id);
  return item ? NextResponse.json({ item }) : NextResponse.json({ error: "Introuvable" }, { status: 404 });
}

export async function PUT(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { col, id } = await params;
  if (!isCol(col)) return NextResponse.json({ error: "Collection inconnue" }, { status: 404 });
  const current = await get(col, id);
  if (!current) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const parsed = adminSchemas[col].safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const data = parsed.data as Record<string, unknown>;
  const item: Record<string, unknown> = { ...current, ...data, id };
  if ("slug" in adminSchemas[col].shape) {
    const wanted = slugify((data.slug as string) || (data.name as string) || (current as { slug?: string }).slug || id);
    const clash = ((await list(col)) as { id: string; slug?: string }[]).some((e) => e.slug === wanted && e.id !== id);
    item.slug = clash ? `${wanted}-${Math.random().toString(36).slice(2, 6)}` : wanted;
  }
  if (col === "products") item.updatedAt = new Date().toISOString();
  await put(col, item as unknown as CollectionMap[typeof col]);
  revalidatePath("/", "layout");
  return NextResponse.json({ item });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { col, id } = await params;
  if (!isCol(col) && col !== "orders") return NextResponse.json({ error: "Collection inconnue" }, { status: 404 });
  await remove(col as AdminCollection, id);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
