import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { list, newId, put } from "@/lib/db";
import { slugify } from "@/lib/format";
import { adminSchemas, firstError, type AdminCollection } from "@/lib/validation";
import type { CollectionMap } from "@/lib/types";

export const dynamic = "force-dynamic";

const PREFIX: Record<AdminCollection, string> = {
  products: "prd",
  categories: "cat",
  occasions: "occ",
  addons: "add",
  promos: "promo",
  reviews: "rev",
  faqs: "faq",
  gallery: "gal",
  messages: "msg",
  subscribers: "sub",
};

function isAdminCollection(c: string): c is AdminCollection {
  return c in adminSchemas;
}

export async function GET(_: Request, { params }: { params: Promise<{ col: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { col } = await params;
  if (!isAdminCollection(col) && col !== "orders") return NextResponse.json({ error: "Collection inconnue" }, { status: 404 });
  return NextResponse.json({ items: await list(col as AdminCollection) });
}

export async function POST(req: Request, { params }: { params: Promise<{ col: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { col } = await params;
  if (!isAdminCollection(col)) return NextResponse.json({ error: "Collection inconnue" }, { status: 404 });
  const parsed = adminSchemas[col].safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const data = parsed.data as Record<string, unknown>;
  const now = new Date().toISOString();
  const item: Record<string, unknown> = { ...data, id: newId(PREFIX[col]) };
  if ("slug" in adminSchemas[col].shape) {
    const existing = (await list(col)) as { slug?: string }[];
    let slug = slugify((data.slug as string) || (data.name as string) || "element");
    if (existing.some((e) => e.slug === slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    item.slug = slug;
  }
  if (col === "products") Object.assign(item, { createdAt: now, updatedAt: now });
  if (col === "messages" && !item.createdAt) item.createdAt = now;
  await put(col, item as unknown as CollectionMap[typeof col]);
  revalidatePath("/", "layout");
  return NextResponse.json({ item });
}
