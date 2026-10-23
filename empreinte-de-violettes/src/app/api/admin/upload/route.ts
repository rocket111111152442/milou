import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/admin-guard";
import { storageInfo } from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif" };

/**
 * Téléversement d'image (déjà compressée côté navigateur) :
 * Vercel Blob si BLOB_READ_WRITE_TOKEN, sinon dossier public/uploads (serveur classique),
 * sinon renvoi d'une data-URL stockée avec le contenu.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Format non pris en charge (JPG, PNG, WebP, AVIF)" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Image trop lourde (8 Mo max)" }, { status: 400 });
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`empreinte/${name}`, file, { access: "public", contentType: file.type });
    return NextResponse.json({ url: blob.url });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (!process.env.VERCEL && storageInfo().kind === "file") {
    const dir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), buf);
    return NextResponse.json({ url: `/uploads/${name}` });
  }
  if (buf.length > 900 * 1024) return NextResponse.json({ error: "Sans Vercel Blob, l'image doit peser moins de 900 Ko." }, { status: 400 });
  return NextResponse.json({ url: `data:${file.type};base64,${buf.toString("base64")}` });
}
