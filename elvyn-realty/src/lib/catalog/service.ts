import "server-only";
import { env, catalogMode } from "@/config/env";
import { aeGet, AlterEstateNotFound } from "@/lib/alterestate/client";
import { aeListingDetail, aeListPage, type AeListingDetail } from "@/lib/alterestate/schemas";
import { log } from "@/lib/log";
import { TtlCache } from "./cache";
import { facetsOf, searchLocal } from "./local-search";
import { normalizeDetail, normalizeSummary } from "./normalize";
import type { Facets, ListingDetail, ListingSummary, SearchFilters, SearchResult } from "./types";
import { loadDemoDetails } from "./demo";
import { isManualSlug, manualDetail, manualSummaries } from "./manual";

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

function reportSkipped(where: string, data: { skipped: number; firstIssue: string | null }) {
  if (data.skipped) log.warn("alterestate.items_skipped", { where, skipped: data.skipped, issue: data.firstIssue?.slice(0, 200) });
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
    reportSkipped("inventory", data);
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

/* Shared snapshot in the database: a cold instance reads it instead of walking every AlterEstate page. */
async function readSnapshot(): Promise<{ value: ListingSummary[]; age: number } | null> {
  if (!env.database.url) return null;
  try {
    const { getDb, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await (await getDb()).select().from(schema.catalogSnapshots).where(eq(schema.catalogSnapshots.key, "inventory"));
    if (!row || !Array.isArray(row.data)) return null;
    return { value: row.data as ListingSummary[], age: Date.now() - new Date(row.storedAt).getTime() };
  } catch (err) {
    log.warn("catalog.snapshot_read_failed", { kind: (err as Error).name });
    return null;
  }
}

async function writeSnapshot(value: ListingSummary[]) {
  if (!env.database.url) return;
  try {
    const { getDb, schema } = await import("@/lib/db");
    const storedAt = new Date();
    await (await getDb())
      .insert(schema.catalogSnapshots)
      .values({ key: "inventory", data: value, storedAt })
      .onConflictDoUpdate({ target: schema.catalogSnapshots.key, set: { data: value, storedAt } });
  } catch (err) {
    log.warn("catalog.snapshot_write_failed", { kind: (err as Error).name });
  }
}

let servedFromSnapshotFallback = false;
async function loadInventory(): Promise<ListingSummary[]> {
  servedFromSnapshotFallback = false;
  const snap = await readSnapshot();
  if (snap && snap.age < ttl()) return snap.value;
  try {
    const value = await liveInventory();
    await writeSnapshot(value);
    return value;
  } catch (err) {
    // AlterEstate slow or down: the last complete inventory (within the stale window) is better than nothing.
    if (snap && snap.age < ttl() + maxStale()) {
      servedFromSnapshotFallback = true;
      lastError = (err as Error).message;
      log.warn("catalog.inventory_from_snapshot", { ageMin: Math.round(snap.age / 60000), reason: lastError });
      return snap.value;
    }
    throw err;
  }
}

/** AlterEstate (or demo) inventory only. */
async function sourceInventory(): Promise<ListingSummary[]> {
  if (catalogMode() === "demo") {
    return (await loadDemoDetails()).map((d) => d as ListingSummary);
  }
  try {
    const { value, stale } = await cache.get("inventory", loadInventory, ttl(), maxStale());
    if (servedFromSnapshotFallback) {
      // Retry AlterEstate on the next request instead of trusting the fallback for a full TTL.
      cache.delete("inventory");
      return value;
    }
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

/** Full inventory shown on the site: listings added in the CRM first, then AlterEstate. */
export async function getInventory(): Promise<ListingSummary[]> {
  const [manual, source] = await Promise.all([manualSummaries(), sourceInventory()]);
  return manual.length ? [...manual, ...source] : source;
}

/**
 * Catalogue search runs on the reconciled inventory (same data as the assistant, includes the
 * listings added in the CRM, and no extra AlterEstate call per filter combination).
 */
export async function searchListings(f: SearchFilters): Promise<SearchResult> {
  return searchLocal(await getInventory(), f);
}

/** Returns null when the listing does not exist or is no longer published. */
export async function getListing(slug: string): Promise<ListingDetail | null> {
  if (!SLUG_RE.test(slug)) return null;
  if (isManualSlug(slug)) {
    try {
      return await manualDetail(slug);
    } catch (err) {
      log.error("catalog.manual_detail_failed", { kind: (err as Error).name });
      throw new CatalogUnavailable();
    }
  }
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
