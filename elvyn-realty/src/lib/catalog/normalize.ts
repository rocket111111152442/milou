import type { AeListingBase, AeListingDetail } from "@/lib/alterestate/schemas";
import { sanitizeRichText, toPlainText, safeExternalUrl } from "@/lib/sanitize";
import type { AgentContact, ListingDetail, ListingSummary, Money, Operation, ProjectUnit } from "./types";

function money(amount: number | null | undefined, currency: string | null | undefined): Money | null {
  if (amount === null || amount === undefined || !(amount > 0)) return null;
  return { amount, currency: (currency || "USD").toUpperCase() };
}
function area(value: number | null | undefined, unit: string | null | undefined) {
  if (value === null || value === undefined || !(value > 0)) return null;
  return { value, unit: unit === "Mt2" || !unit ? "m²" : unit };
}
const posInt = (n: number | null | undefined) => (n === null || n === undefined || n <= 0 ? null : n);
const clean = (s: string | null | undefined) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t || null;
};

/**
 * Titles typed in capitals in AlterEstate are shown in sentence case (presentation only;
 * words, names and numbers are unchanged). Mixed-case titles are kept as typed.
 */
export function displayTitle(t: string): string {
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "");
  if (letters.length < 6 || upper.length / letters.length < 0.7) return t;
  const lower = t.toLocaleLowerCase("es");
  return lower.replace(/(^|[.!?|:]\s+|^[^A-Za-zÀ-ÿ]*)([a-zà-ÿ])/g, (_m, pre: string, c: string) => pre + c.toLocaleUpperCase("es"));
}

function operations(raw: AeListingBase): Operation[] {
  const ops = new Set<Operation>();
  if (raw.forSale) ops.add("sale");
  if (raw.forRent) ops.add("rent");
  if (raw.forRental) ops.add("rental");
  for (const lt of raw.listing_type ?? []) {
    if (lt.id === 1) ops.add("sale");
    if (lt.id === 2 || lt.id === 4) ops.add("rent");
    if (lt.id === 3) ops.add("rental");
  }
  // Developments (is_project_v2) come without listing_type: their units are sold.
  if (ops.size === 0 && raw.is_project_v2) ops.add("sale");
  if (ops.size === 0 && raw.sale_price) ops.add("sale");
  if (ops.size === 0 && raw.rent_price) ops.add("rent");
  return [...ops];
}

export function agencyOwned(agents: AeListingBase["agents"], companyId: number): boolean | null {
  if (!agents || agents.length === 0) return null;
  return agents.some((a) => a.company === companyId);
}

export function normalizeSummary(raw: AeListingBase, companyId: number): ListingSummary {
  const pv = raw.project_values ?? null;
  return {
    uid: raw.uid,
    ref: raw.cid ? String(raw.cid) : null,
    slug: raw.slug,
    title: displayTitle(clean(raw.name) ?? raw.slug),
    shortDescription: clean(raw.short_description),
    category: raw.category ? { id: raw.category.id, name: raw.category.name, nameEn: raw.category.name_en ?? null } : null,
    operations: operations(raw),
    isProject: Boolean(raw.is_project_v2),
    condition: { code: raw.condition ?? null, label: clean(raw.condition_read) },
    price: {
      sale: money(raw.sale_price, raw.currency_sale),
      rent: money(raw.rent_price, raw.currency_rent),
      rental: money(raw.rental_price, raw.currency_rental),
      projectFrom: money(pv?.min_sale, pv?.currency_min_sale ?? raw.currency_sale),
      projectTo: money(pv?.max_sale, pv?.currency_max_sale ?? raw.currency_sale),
    },
    usd: { sale: raw.us_saleprice ?? null, rent: raw.us_rentprice ?? null, rental: raw.us_rentalprice ?? null },
    location: { province: clean(raw.province), city: clean(raw.city), sector: clean(raw.sector) },
    bedrooms: posInt(raw.room),
    bathrooms: posInt(raw.bathroom),
    halfBathrooms: posInt(raw.half_bathrooms),
    parking: posInt(raw.parkinglot),
    area: area(raw.property_area, raw.property_area_measurer),
    landArea: area(raw.terrain_area, raw.terrain_area_measurer),
    image: raw.featured_image || null,
    exclusive: raw.exclusive ?? null,
    featured: raw.featured ?? null,
    furnished: raw.furnished ?? null,
    createdAt: raw.timestamp ?? null,
    agencyOwned: agencyOwned(raw.agents, companyId),
  };
}

function unitStatus(s: string | null | undefined): ProjectUnit["status"] {
  const v = (s ?? "").toLowerCase();
  if (v.startsWith("publicad") || v.startsWith("disponible")) return "available";
  if (v.startsWith("reservad")) return "reserved";
  if (v.startsWith("vendid")) return "sold";
  if (v.startsWith("bloquead")) return "unavailable";
  return "unknown";
}

function coordinates(raw: AeListingDetail): { lat: number; lng: number } | null {
  const ll = raw.lat_long;
  if (!ll || typeof ll !== "object") return null;
  const lat = ll.latitude ?? ll.lat ?? null;
  const lng = ll.longitude ?? ll.lng ?? null;
  if (lat === null || lng === null || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

function agentContact(a: NonNullable<AeListingBase["agents"]>[number]): AgentContact | null {
  const name = clean(a.full_name) ?? clean([a.first_name, a.last_name].filter(Boolean).join(" "));
  if (!name) return null;
  return {
    name,
    phone: clean(a.phone),
    email: clean(a.email),
    avatar: a.avatar || null,
    position: clean(a.position),
    companyId: a.company ?? null,
  };
}

export function normalizeDetail(raw: AeListingDetail, companyId: number): ListingDetail {
  const summary = normalizeSummary(raw, companyId);
  const images: string[] = [];
  const seen = new Set<string>();
  const key = (u: string) => u.replace(/^https:\/\/[^/]+\/(fit-in\/[^/]+\/)?(filters:[^/]+\/)*/, "");
  for (const u of [raw.featured_image, ...(raw.gallery_image ?? []).map((g) => g.image)]) {
    if (!u) continue;
    const k = key(u);
    if (seen.has(k)) continue;
    seen.add(k);
    images.push(u);
  }
  const hideLocation = raw.hide_location !== false; // hide unless explicitly public
  const relatedSeen = new Set<string>([raw.uid]);
  const related = (raw.related_properties ?? [])
    .filter((r) => (relatedSeen.has(r.uid) ? false : (relatedSeen.add(r.uid), true)))
    .map((r) => normalizeSummary(r, companyId));

  return {
    ...summary,
    image: images[0] ?? summary.image,
    descriptionHtml: sanitizeRichText(raw.description),
    descriptionText: toPlainText(raw.description),
    amenities: [...new Set((raw.amenities ?? []).map((a) => a.trim()).filter(Boolean))],
    images,
    prices: {
      furnishedRent: money(raw.furnished_price, raw.currency_furnished),
      furnishedSale: money(raw.furnished_sale_price, raw.currency_sale_furnished),
      maintenance: money(raw.maintenance_fee, raw.currency_maintenance),
    },
    terraceArea: area(raw.terrace_area, raw.terrace_area_measurer),
    floorLevel: posInt(raw.floor_level),
    totalFloors: posInt(raw.total_floors),
    yearBuilt: clean(raw.year_construction),
    deliveryDate: clean(raw.delivery_date),
    hideLocation,
    coordinates: hideLocation ? null : coordinates(raw),
    videoUrl: safeExternalUrl(raw.youtubeiframe),
    virtualTourUrl: safeExternalUrl(raw.virtual_tour),
    agents: (raw.agents ?? []).map(agentContact).filter((a): a is AgentContact => a !== null),
    units: (raw.variations ?? []).map((v) => ({
      ref: v.cid ? String(v.cid) : null,
      model: clean(v.project_model),
      price: money(v.sale_price, v.currency_sale),
      area: area(v.property_area, v.property_area_measurer),
      bedrooms: posInt(v.room),
      bathrooms: posInt(v.bathroom),
      floor: v.floor_level ?? null,
      status: unitStatus(v.status),
    })),
    related,
  };
}
