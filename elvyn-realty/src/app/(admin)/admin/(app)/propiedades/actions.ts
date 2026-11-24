"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { getDb, schema } from "@/lib/db";
import { getFacets } from "@/lib/catalog/service";
import { invalidateManual, MANUAL_PREFIX, slugify } from "@/lib/catalog/manual";
import { log } from "@/lib/log";

export type FormState = { error?: string; ok?: boolean } | null;

const num = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(/[^\d.]/g, ""))), z.number().nonnegative().nullable());
const int = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().nonnegative().max(500).nullable());

const listingInput = z.object({
  id: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(5, "El título es obligatorio (mínimo 5 caracteres).").max(200),
  operation: z.enum(["sale", "rent"]),
  categoryId: z.coerce.number().int().optional(),
  province: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2, "La ciudad es obligatoria.").max(80),
  sector: z.string().trim().max(120).optional(),
  price: num,
  currency: z.enum(["USD", "DOP"]),
  bedrooms: int,
  bathrooms: num,
  parking: int,
  area: num,
  landArea: num,
  condition: z.enum(["", "ready", "construction"]).optional(),
  furnished: z.enum(["", "yes", "no"]).optional(),
  description: z.string().trim().max(10000).optional(),
  amenities: z.string().trim().max(3000).optional(),
  videoUrl: z.union([z.literal(""), z.string().trim().url("Enlace de video no válido.").max(500)]).optional(),
  published: z.string().optional(),
  featured: z.string().optional(),
});

function refresh() {
  invalidateManual();
  revalidatePath("/", "layout");
}

export async function saveListing(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const p = listingInput.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Revisa los campos." };
  const v = p.data;
  let category: { id: number; name: string; nameEn: string | null } | undefined;
  if (v.categoryId) {
    const facets = await getFacets().catch(() => null);
    category = facets?.categories.find((c) => c.id === v.categoryId);
  }
  const values = {
    title: v.title,
    operation: v.operation,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    categoryNameEn: category?.nameEn ?? null,
    province: v.province || "María Trinidad Sánchez",
    city: v.city,
    sector: v.sector || null,
    price: v.price,
    currency: v.currency,
    bedrooms: v.bedrooms,
    bathrooms: v.bathrooms,
    parking: v.parking,
    area: v.area,
    landArea: v.landArea,
    condition: v.condition || null,
    furnished: v.furnished === "yes" ? true : v.furnished === "no" ? false : null,
    description: v.description ?? "",
    amenities: (v.amenities ?? "").split(/[\n,]/).map((a) => a.trim()).filter(Boolean).slice(0, 60),
    videoUrl: v.videoUrl || null,
    published: v.published === "on",
    featured: v.featured === "on",
    updatedAt: new Date(),
  };
  const db = await getDb();
  let id = v.id;
  if (id) {
    const res = await db.update(schema.manualListings).set(values).where(eq(schema.manualListings.id, id)).returning({ id: schema.manualListings.id });
    if (!res.length) return { error: "Propiedad no encontrada." };
  } else {
    const [row] = await db.insert(schema.manualListings).values(values).returning({ id: schema.manualListings.id });
    id = row.id;
    // Stable public address, fixed at creation.
    await db.update(schema.manualListings).set({ slug: `${MANUAL_PREFIX}${id}-${slugify(v.title) || "propiedad"}` }).where(eq(schema.manualListings.id, id));
    log.info("crm.manual_listing_created", { id });
  }
  refresh();
  if (!v.id) redirect(`/admin/propiedades/${id}?creada=1`);
  return { ok: true };
}

export async function deleteListing(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id)) return;
  await (await getDb()).delete(schema.manualListings).where(eq(schema.manualListings.id, id));
  log.info("crm.manual_listing_deleted", { id });
  refresh();
  redirect("/admin/propiedades");
}

export async function deleteImage(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("imageId"));
  const listingId = Number(fd.get("listingId"));
  await (await getDb()).delete(schema.manualListingImages).where(and(eq(schema.manualListingImages.id, id), eq(schema.manualListingImages.listingId, listingId)));
  refresh();
  revalidatePath(`/admin/propiedades/${listingId}`);
}

/** Makes a photo the cover (first position). */
export async function makeCover(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("imageId"));
  const listingId = Number(fd.get("listingId"));
  const db = await getDb();
  const [{ min }] = await db
    .select({ min: sql<number>`coalesce(min(${schema.manualListingImages.position}),0)` })
    .from(schema.manualListingImages)
    .where(eq(schema.manualListingImages.listingId, listingId));
  await db.update(schema.manualListingImages).set({ position: Number(min) - 1 }).where(and(eq(schema.manualListingImages.id, id), eq(schema.manualListingImages.listingId, listingId)));
  refresh();
  revalidatePath(`/admin/propiedades/${listingId}`);
}
