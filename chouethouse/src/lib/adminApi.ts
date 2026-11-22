import "server-only";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "./auth";

export async function guard() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return null;
}

export function revalidateSite(paths: string[] = []) {
  for (const p of ["/", "/ateliers-enfants", "/evenements", "/blog", "/sitemap.xml", ...paths]) {
    try {
      revalidatePath(p);
    } catch {}
  }
  try {
    revalidatePath("/blog/[slug]", "page");
  } catch {}
}
