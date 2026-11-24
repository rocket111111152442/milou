import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getAdmin } from "@/lib/auth/server";

export const runtime = "nodejs";

/** Photos of listings added in the CRM. Public when the listing is published; CRM users see all. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse(null, { status: 404 });
  const [row] = await (await getDb())
    .select({ mime: schema.manualListingImages.mime, data: schema.manualListingImages.dataB64, published: schema.manualListings.published })
    .from(schema.manualListingImages)
    .innerJoin(schema.manualListings, eq(schema.manualListings.id, schema.manualListingImages.listingId))
    .where(eq(schema.manualListingImages.id, id));
  if (!row) return new NextResponse(null, { status: 404 });
  if (!row.published && !(await getAdmin())) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(row.data, "base64")), {
    headers: {
      "Content-Type": row.mime,
      // A photo id never changes content (a new upload gets a new id).
      "Cache-Control": row.published ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
