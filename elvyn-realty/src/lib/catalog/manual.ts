import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { team } from "@/config/site";
import { log } from "@/lib/log";
import type { ListingDetail, ListingSummary, Money } from "./types";

/** Listings entered by hand in the CRM. Slugs start with "ea-" so they never collide with AlterEstate. */
export const MANUAL_PREFIX = "ea-";
export const isManualSlug = (slug: string) => slug.startsWith(MANUAL_PREFIX);

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

type Row = typeof import("@/lib/db/schema").manualListings.$inferSelect;

export const imageUrl = (id: number) => `/api/listing-images/${id}`;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toSummary(r: Row, imageIds: number[]): ListingSummary {
  const money: Money | null = r.price && r.price > 0 ? { amount: r.price, currency: r.currency } : null;
  const usd = money && money.currency === "USD" ? money.amount : null;
  const sale = r.operation === "sale";
  return {
    uid: `manual-${r.id}`,
    ref: `EA${r.id}`,
    slug: r.slug ?? `${MANUAL_PREFIX}${r.id}`,
    title: r.title,
    shortDescription: r.description ? r.description.replace(/\s+/g, " ").slice(0, 220) : null,
    category: r.categoryName ? { id: r.categoryId ?? null, name: r.categoryName, nameEn: r.categoryNameEn ?? null } : null,
    operations: [sale ? "sale" : "rent"],
    isProject: false,
    condition:
      r.condition === "construction"
        ? { code: 5, label: "En construcción" }
        : r.condition === "ready"
          ? { code: 9, label: "Listo" }
          : { code: null, label: null },
    price: { sale: sale ? money : null, rent: sale ? null : money, rental: null, projectFrom: null, projectTo: null },
    usd: { sale: sale ? usd : null, rent: sale ? null : usd, rental: null },
    location: { province: r.province ?? null, city: r.city ?? null, sector: r.sector ?? null },
    bedrooms: r.bedrooms ?? null,
    bathrooms: r.bathrooms ?? null,
    halfBathrooms: null,
    parking: r.parking ?? null,
    area: r.area ? { value: r.area, unit: "m²" } : null,
    landArea: r.landArea ? { value: r.landArea, unit: "m²" } : null,
    image: imageIds[0] ? imageUrl(imageIds[0]) : null,
    exclusive: null,
    featured: r.featured,
    furnished: r.furnished ?? null,
    createdAt: new Date(r.createdAt).toISOString(),
    agencyOwned: true,
  };
}

export function toDetail(r: Row, imageIds: number[]): ListingDetail {
  const paragraphs = r.description
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const agent = team[0];
  return {
    ...toSummary(r, imageIds),
    descriptionHtml: paragraphs,
    descriptionText: r.description,
    amenities: r.amenities ?? [],
    images: imageIds.map(imageUrl),
    prices: { furnishedRent: null, furnishedSale: null, maintenance: null },
    terraceArea: null,
    floorLevel: null,
    totalFloors: null,
    yearBuilt: null,
    deliveryDate: null,
    hideLocation: false,
    coordinates: null,
    videoUrl: r.videoUrl ?? null,
    virtualTourUrl: null,
    agents: agent ? [{ name: agent.name, phone: agent.phone ?? null, email: agent.email ?? null, avatar: null, position: null, companyId: null }] : [],
    units: [],
    related: [],
  };
}

async function imagesFor(ids: number[]): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  if (!ids.length) return out;
  const { getDb, schema } = await import("@/lib/db");
  const rows = await (await getDb())
    .select({ id: schema.manualListingImages.id, listingId: schema.manualListingImages.listingId })
    .from(schema.manualListingImages)
    .where(inArray(schema.manualListingImages.listingId, ids))
    .orderBy(asc(schema.manualListingImages.position), asc(schema.manualListingImages.id));
  for (const r of rows) out.set(r.listingId, [...(out.get(r.listingId) ?? []), r.id]);
  return out;
}

let cached: { at: number; value: ListingSummary[] } | null = null;
const TTL = 60_000;

/** Published manual listings (cached 60 s per server instance; the CRM clears it on save). */
export async function manualSummaries(): Promise<ListingSummary[]> {
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  try {
    const { getDb, schema } = await import("@/lib/db");
    const rows = await (await getDb()).select().from(schema.manualListings).where(eq(schema.manualListings.published, true));
    const imgs = await imagesFor(rows.map((r) => r.id));
    const value = rows.map((r) => toSummary(r, imgs.get(r.id) ?? []));
    cached = { at: Date.now(), value };
    return value;
  } catch (err) {
    log.warn("catalog.manual_failed", { kind: (err as Error).name });
    return cached?.value ?? [];
  }
}

export async function manualDetail(slug: string): Promise<ListingDetail | null> {
  const { getDb, schema } = await import("@/lib/db");
  const [r] = await (await getDb()).select().from(schema.manualListings).where(eq(schema.manualListings.slug, slug));
  if (!r || !r.published) return null;
  const imgs = await imagesFor([r.id]);
  return toDetail(r, imgs.get(r.id) ?? []);
}

export function invalidateManual() {
  cached = null;
}
