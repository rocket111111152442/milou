import { NextResponse, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { env } from "@/config/env";
import { getAdmin } from "@/lib/auth/server";
import { getDb, schema } from "@/lib/db";
import { invalidateManual } from "@/lib/catalog/manual";
import { sameOrigin } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_PHOTOS = 40;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Upload one photo (raw body, already resized in the browser). CRM users only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req.headers, env.siteUrl)) return NextResponse.json({ error: "origin" }, { status: 403 });
  if (!(await getAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_listing" }, { status: 400 });
  if (!TYPES.has(mime)) return NextResponse.json({ error: "invalid_type" }, { status: 415 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length || buf.length > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const db = await getDb();
  const [listing] = await db.select({ id: schema.manualListings.id }).from(schema.manualListings).where(eq(schema.manualListings.id, id));
  if (!listing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [{ n, max }] = await db
    .select({ n: sql<number>`count(*)`, max: sql<number>`coalesce(max(${schema.manualListingImages.position}),0)` })
    .from(schema.manualListingImages)
    .where(eq(schema.manualListingImages.listingId, id));
  if (Number(n) >= MAX_PHOTOS) return NextResponse.json({ error: "too_many" }, { status: 409 });
  const [img] = await db
    .insert(schema.manualListingImages)
    .values({ listingId: id, position: Number(max) + 1, mime, dataB64: buf.toString("base64") })
    .returning({ id: schema.manualListingImages.id });
  invalidateManual();
  return NextResponse.json({ id: img.id });
}
