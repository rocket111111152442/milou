import "server-only";
import { env, catalogMode } from "@/config/env";
import { aeGet, AlterEstateNotFound } from "@/lib/alterestate/client";
import { aeListingDetail, aeListPage, type AeListingDetail } from "@/lib/alterestate/schemas";
import { log } from "@/lib/log";
import { TtlCache } from "./cache";
import { cacheKey } from "./filters";
import { facetsOf, searchLocal, PAGE_SIZE } from "./local-search";
import { normalizeDetail, normalizeSummary } from "./normalize";
import type { Facets, ListingDetail, ListingSummary, SearchFilters, SearchResult } from "./types";
import { loadDemoDetails } from "./demo";

export class CatalogUnavailable extends Error {
  constructor() {
    super("catalog_unavailable");
    this.name = "CatalogUnavailable";
  }
}

const cache = new TtlCache(800);
const ttl = () => env.alterestate.cacheSeconds * 1000;
const maxStale = () => env.alterestate.maxStaleSeconds * 1000;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,200}$/i;

export interface CatalogStatus { mode: "live" | "demo"; inventoryCount: number | null; fetchedAt: string | null; stale: boolean; error: string | null }
let lastInventory: { at: string; count: number } | null = null;
let lastError: string | null = null;

/* ---------------------------------------------------------------- live mode */

function liveQuery(f: SearchFilters) {
  const listingType = f.operation === "sale" ? 1 : f.operation === "rent" ? 2 : f.priceMin || f.priceMax ? 1 : null;
  const priceField = listingType === 2 ? "us_rentprice" : "us_saleprice";
  const sort = { recent: "-timestamp", price_asc: priceField, price_desc: `-${priceField}`, bedrooms_desc: "-room" }[f.sort];
  return {
    page: f.page,
    page_size: PAGE_SIZE,
    listing_type: listingType,
    category: f.categories,
    city_name: f.city,
    search: f.q,
    currency: f.priceMin || f.priceMax ? f.currency : null,
    value_min: f.priceMin,
    value_max: f.priceMax,
    rooms_min: f.bedroomsMin,
    bath_min: f.bathroomsMin,
    parking_min: f.parkingMin,
    condition: f.condition === "ready" ? 9 : f.condition === "construction" ? 5 : null,
    sort,
  };
}

async function liveSearch(f: SearchFilters): Promise<SearchResult> {
  const data = aeListPage.parse(await aeGet("/properties/filter/", liveQuery(f)));
  const seen = new Set<string>();
  const results = data.results
    .filter((r) => (seen.has(r.uid) ? false : (seen.add(r.uid), true)))
    .map((r) => normalizeSummary(r, env.alterestate.companyId));
  const count = data.count ?? results.length;
  return { count, page: f.page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)), results };
}

/**
 * Full reconciliation: walks every page of the published inventory. The result replaces the
 * previous inventory only when all pages succeeded (AlterEstate docs: do not drop listings on a
 * partial or failed fetch). Listings that disappear from a complete fetch disappear here too.
 */
async function liveInventory(): Promise<ListingSummary[]> {
  const out: ListingSummary[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 60; page++) {
    const data = aeListPage.parse(await aeGet("/properties/filter/", { page, page_size: 30, sort: "-timestamp" }));
    for (const r of data.results) {
      if (seen.has(r.uid)) continue;
      seen.add(r.uid);
      out.push(normalizeSummary(r, env.alterestate.companyId));
    }
    if (!data.next || data.results.length === 0) break;
  }
  return out;
}

async function liveDetail(slug: string): Promise<ListingDetail | null> {
  try {
    const raw: AeListingDetail = aeListingDetail.parse(await aeGet(`/properties/view/${encodeURIComponent(slug)}/`));
    if (raw.show_on_website === false) return null;
    return normalizeDetail(raw, env.alterestate.companyId);
  } catch (err) {
    if (err instanceof AlterEstateNotFound) return null;
    throw err;
  }
}

/* ------------------------------------------------------------------ public API */

export async function getInventory(): Promise<ListingSummary[]> {
  if (catalogMode() === "demo") {
    return (await loadDemoDetails()).map((d) => d as ListingSummary);
  }
  try {
    const { value, stale } = await cache.get("inventory", liveInventory, ttl(), maxStale());
    if (!stale) {
      lastInventory = { at: new Date().toISOString(), count: value.length };
      lastError = null;
    }
    return value;
  } catch (err) {
    lastError = (err as Error).message;
    log.error("catalog.inventory_failed", { reason: lastError });
    throw new CatalogUnavailable();
  }
}

export async function searchListings(f: SearchFilters): Promise<SearchResult> {
  if (catalogMode() === "demo") return searchLocal(await getInventory(), f);
  try {
    const { value } = await cache.get(`search:${cacheKey(f)}`, () => liveSearch(f), Math.min(ttl(), 300_000), maxStale());
    return value;
  } catch (err) {
    log.error("catalog.search_failed", { reason: (err as Error).message });
    throw new CatalogUnavailable();
  }
}

/** Returns null when the listing does not exist or is no longer published. */
export async function getListing(slug: string): Promise<ListingDetail | null> {
  if (!SLUG_RE.test(slug)) return null;
  if (catalogMode() === "demo") return (await loadDemoDetails()).find((d) => d.slug === slug) ?? null;
  try {
    const { value } = await cache.get(`detail:${slug}`, () => liveDetail(slug), ttl(), maxStale());
    return value;
  } catch (err) {
    log.error("catalog.detail_failed", { reason: (err as Error).message });
    throw new CatalogUnavailable();
  }
}

export async function getFacets(): Promise<Facets> {
  return facetsOf(await getInventory());
}

/**
 * Home selection: listings AlterEstate flags as `featured` when the flag is present,
 * otherwise the most recent ones. Never labelled as "featured" without the flag.
 */
export async function getHighlights(n = 6): Promise<{ items: ListingSummary[]; basis: "featured" | "recent" }> {
  const inv = (await getInventory()).filter((l) => l.image);
  const featured = inv.filter((l) => l.featured === true);
  if (featured.length >= 3) return { items: featured.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, n), basis: "featured" };
  return { items: [...inv].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, n), basis: "recent" };
}

export function catalogStatus(): CatalogStatus {
  const mode = catalogMode();
  if (mode === "demo") return { mode, inventoryCount: null, fetchedAt: null, stale: false, error: null };
  return { mode, inventoryCount: lastInventory?.count ?? null, fetchedAt: lastInventory?.at ?? null, stale: Boolean(lastError && lastInventory), error: lastError };
}

export function __resetCatalogCacheForTests() {
  cache.clear();
}
