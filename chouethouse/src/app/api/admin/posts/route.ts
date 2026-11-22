import { NextResponse } from "next/server";
import { guard, revalidateSite } from "@/lib/adminApi";
import { deletePost, getPosts, savePost } from "@/lib/store";
import { slugify, uid } from "@/lib/format";
import type { Post } from "@/lib/types";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json(await getPosts({ includeDrafts: true }));
}

export async function PUT(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const p = (await req.json()) as Post;
  if (!p.title?.trim()) return NextResponse.json({ error: "Titre obligatoire" }, { status: 400 });
  const item: Post = {
    ...p,
    id: p.id || uid("p-"),
    slug: p.slug?.trim() ? slugify(p.slug) : slugify(p.title),
    tags: (p.tags ?? []).map((t) => t.trim()).filter(Boolean),
    date: p.date || new Date().toISOString().slice(0, 10),
    cover: p.cover || "/images/table-brunch.webp",
  };
  const saved = await savePost(item);
  revalidateSite([`/blog/${saved.slug}`]);
  return NextResponse.json(saved);
}

export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
  await deletePost(id);
  revalidateSite();
  return NextResponse.json({ ok: true });
}
