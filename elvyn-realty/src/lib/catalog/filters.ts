import type { SearchFilters, SortKey } from "./types";

/**
 * Catalogue URL parameters (Spanish, readable, shareable):
 *   operacion=venta|alquiler  tipo=<categoryId>(,..)  ciudad=<name>  q=<text>
 *   moneda=USD|DOP  precio_min  precio_max  habitaciones  banos  parqueos
 *   estado=listo|construccion  orden=recientes|precio_asc|precio_desc|habitaciones  pagina
 * Legacy AlterEstate parameters (listing_type, category, currency, page) are accepted too,
 * so links shared from the old site keep working.
 */
export type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const all = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
function posNum(v: string | undefined, max = 1e12): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= max ? n : null;
}
function smallInt(v: string | undefined): number | null {
  const n = posNum(v, 50);
  return n === null ? null : Math.floor(n);
}
const SORTS: Record<string, SortKey> = { recientes: "recent", precio_asc: "price_asc", precio_desc: "price_desc", habitaciones: "bedrooms_desc" };
const SORT_PARAM: Record<SortKey, string> = { recent: "recientes", price_asc: "precio_asc", price_desc: "precio_desc", bedrooms_desc: "habitaciones" };

export const DEFAULT_FILTERS: SearchFilters = {
  operation: null,
  categories: [],
  city: null,
  q: null,
  currency: "USD",
  priceMin: null,
  priceMax: null,
  bedroomsMin: null,
  bathroomsMin: null,
  parkingMin: null,
  condition: null,
  sort: "recent",
  page: 1,
};

export function parseFilters(params: RawParams, preset: Partial<SearchFilters> = {}): SearchFilters {
  const op = first(params.operacion) ?? (first(params.listing_type) === "1" ? "venta" : first(params.listing_type) === "2" ? "alquiler" : undefined);
  const cats = [...all(params.tipo), ...all(params.category)]
    .flatMap((v) => v.split(","))
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0 && n < 1000);
  const currencyRaw = (first(params.moneda) ?? first(params.currency) ?? "").toUpperCase();
  const city = (first(params.ciudad) ?? "").trim().slice(0, 60);
  const q = (first(params.q) ?? "").trim().slice(0, 80);
  const estado = first(params.estado);
  const page = Math.min(Math.max(Math.floor(Number(first(params.pagina) ?? first(params.page) ?? 1)) || 1, 1), 500);
  let priceMin = posNum(first(params.precio_min));
  let priceMax = posNum(first(params.precio_max));
  if (priceMin && priceMax && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];

  return {
    ...DEFAULT_FILTERS,
    operation: op === "venta" ? "sale" : op === "alquiler" ? "rent" : null,
    categories: [...new Set(cats)].slice(0, 10),
    city: city || null,
    q: q || null,
    currency: currencyRaw === "DOP" ? "DOP" : "USD",
    priceMin,
    priceMax,
    bedroomsMin: smallInt(first(params.habitaciones)),
    bathroomsMin: smallInt(first(params.banos)),
    parkingMin: smallInt(first(params.parqueos)),
    condition: estado === "listo" ? "ready" : estado === "construccion" ? "construction" : null,
    sort: SORTS[first(params.orden) ?? ""] ?? "recent",
    page,
    ...preset,
  };
}

/** Serialises filters to URL params. Keys equal to `omit` (e.g. the page preset) are skipped. */
export function filtersToParams(f: SearchFilters, omit: Partial<Record<keyof SearchFilters, boolean>> = {}): URLSearchParams {
  const p = new URLSearchParams();
  if (f.operation && !omit.operation) p.set("operacion", f.operation === "sale" ? "venta" : "alquiler");
  if (f.categories.length) p.set("tipo", f.categories.join(","));
  if (f.city) p.set("ciudad", f.city);
  if (f.q) p.set("q", f.q);
  if (f.priceMin || f.priceMax) p.set("moneda", f.currency);
  if (f.priceMin) p.set("precio_min", String(f.priceMin));
  if (f.priceMax) p.set("precio_max", String(f.priceMax));
  if (f.bedroomsMin) p.set("habitaciones", String(f.bedroomsMin));
  if (f.bathroomsMin) p.set("banos", String(f.bathroomsMin));
  if (f.parkingMin) p.set("parqueos", String(f.parkingMin));
  if (f.condition) p.set("estado", f.condition === "ready" ? "listo" : "construccion");
  if (f.sort !== "recent") p.set("orden", SORT_PARAM[f.sort]);
  if (f.page > 1) p.set("pagina", String(f.page));
  return p;
}

/** True when the URL carries refinements beyond the page's own preset (used for noindex). */
export function hasRefinements(f: SearchFilters, preset: Partial<SearchFilters> = {}): boolean {
  const p = filtersToParams({ ...f, page: 1 }, { operation: preset.operation !== undefined });
  return [...p.keys()].length > 0;
}

export function cacheKey(f: SearchFilters): string {
  return JSON.stringify({ ...f, categories: [...f.categories].sort() });
}
