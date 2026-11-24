import type { ListingSummary, SearchFilters, SearchResult, Facets } from "./types";

export const PAGE_SIZE = 24;

export const fold = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * DOP per USD as implied by AlterEstate's own normalised prices (sale_price / us_saleprice
 * of DOP listings). Returns null if the inventory has no DOP listing to derive it from.
 */
export function impliedUsdDopRate(items: ListingSummary[]): number | null {
  const ratios = items
    .filter((l) => l.price.sale?.currency === "DOP" && l.usd.sale && l.usd.sale > 0)
    .map((l) => l.price.sale!.amount / l.usd.sale!)
    .filter((r) => r > 1 && r < 1000)
    .sort((a, b) => a - b);
  if (!ratios.length) return null;
  return ratios[Math.floor(ratios.length / 2)];
}

/** USD-normalised price used for filtering/sorting, per operation. */
export function usdPrice(l: ListingSummary, op: "sale" | "rent" | null, rate: number | null): number | null {
  const pick = op === "rent" ? l.price.rent : l.price.sale ?? l.price.projectFrom;
  const usd = op === "rent" ? l.usd.rent : l.usd.sale;
  if (usd && usd > 0) return usd;
  if (!pick) return null;
  if (pick.currency === "USD") return pick.amount;
  if (pick.currency === "DOP" && rate) return pick.amount / rate;
  return null;
}

export function matchesText(l: ListingSummary, text: string): boolean {
  const t = fold(text);
  if (!t) return true;
  if (l.ref && t.replace(/\D/g, "") === l.ref) return true;
  const hay = fold([l.title, l.location.city, l.location.sector, l.location.province, l.uid].join(" "));
  return t.split(/\s+/).every((w) => hay.includes(w));
}

export function filterListings(items: ListingSummary[], f: SearchFilters, rate: number | null): ListingSummary[] {
  const minUsd = f.priceMin ? (f.currency === "DOP" ? (rate ? f.priceMin / rate : null) : f.priceMin) : null;
  const maxUsd = f.priceMax ? (f.currency === "DOP" ? (rate ? f.priceMax / rate : null) : f.priceMax) : null;
  return items.filter((l) => {
    if (f.operation && !l.operations.includes(f.operation)) return false;
    if (f.categories.length && !(l.category?.id && f.categories.includes(l.category.id))) return false;
    if (f.city && fold(l.location.city) !== fold(f.city)) return false;
    if (f.q && !matchesText(l, f.q)) return false;
    if (f.bedroomsMin && (l.bedrooms ?? 0) < f.bedroomsMin) return false;
    if (f.bathroomsMin && (l.bathrooms ?? 0) < f.bathroomsMin) return false;
    if (f.parkingMin && (l.parking ?? 0) < f.parkingMin) return false;
    if (f.condition === "ready" && l.condition.code !== 9) return false;
    if (f.condition === "construction" && l.condition.code !== 5) return false;
    if (minUsd !== null || maxUsd !== null) {
      const p = usdPrice(l, f.operation, rate);
      if (p === null) return false;
      if (minUsd !== null && p < minUsd) return false;
      if (maxUsd !== null && p > maxUsd) return false;
    }
    return true;
  });
}

export function sortListings(items: ListingSummary[], f: SearchFilters, rate: number | null): ListingSummary[] {
  const arr = [...items];
  const price = (l: ListingSummary) => usdPrice(l, f.operation, rate);
  switch (f.sort) {
    case "price_asc":
      return arr.sort((a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity));
    case "price_desc":
      return arr.sort((a, b) => (price(b) ?? -Infinity) - (price(a) ?? -Infinity));
    case "bedrooms_desc":
      return arr.sort((a, b) => (b.bedrooms ?? 0) - (a.bedrooms ?? 0));
    default:
      return arr.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }
}

export function searchLocal(items: ListingSummary[], f: SearchFilters, pageSize = PAGE_SIZE): SearchResult {
  const rate = impliedUsdDopRate(items);
  const filtered = sortListings(filterListings(items, f, rate), f, rate);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(f.page, totalPages);
  return {
    count: filtered.length,
    page,
    pageSize,
    totalPages,
    results: filtered.slice((page - 1) * pageSize, page * pageSize),
  };
}

export function facetsOf(items: ListingSummary[]): Facets {
  const cities = new Map<string, number>();
  const cats = new Map<number, { name: string; nameEn: string | null; count: number }>();
  for (const l of items) {
    if (l.location.city) cities.set(l.location.city, (cities.get(l.location.city) ?? 0) + 1);
    if (l.category?.id && l.category.name) {
      const c = cats.get(l.category.id) ?? { name: l.category.name, nameEn: l.category.nameEn, count: 0 };
      c.count++;
      cats.set(l.category.id, c);
    }
  }
  return {
    cities: [...cities].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    categories: [...cats].map(([id, c]) => ({ id, ...c })).sort((a, b) => b.count - a.count),
    total: items.length,
  };
}
