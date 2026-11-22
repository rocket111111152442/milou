import { NextResponse } from "next/server";
import { guard, revalidateSite } from "@/lib/adminApi";
import { deleteActivity, getActivities, saveActivity } from "@/lib/store";
import { slugify, uid } from "@/lib/format";
import type { Activity } from "@/lib/types";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json(await getActivities({ includeDrafts: true }));
}

export async function PUT(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const a = (await req.json()) as Activity;
  if (!a.title?.trim()) return NextResponse.json({ error: "Titre obligatoire" }, { status: 400 });
  const item: Activity = {
    ...a,
    id: a.id || uid("a-"),
    slug: a.slug?.trim() ? slugify(a.slug) : slugify(a.title),
    price: Number(a.price) || 0,
    sessions: (a.sessions ?? [])
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^\d{2}:\d{2}$/.test(s.start))
      .map((s) => ({ ...s, id: s.id || uid("s-"), end: s.end || s.start, spots: s.spots === null || s.spots === undefined || (s.spots as unknown) === "" ? null : Number(s.spots) })),
  };
  const saved = await saveActivity(item);
  revalidateSite();
  return NextResponse.json(saved);
}

export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
  await deleteActivity(id);
  revalidateSite();
  return NextResponse.json({ ok: true });
}
