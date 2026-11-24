import { describe, expect, it } from "vitest";
import { parseFilters, filtersToParams, hasRefinements, DEFAULT_FILTERS } from "@/lib/catalog/filters";
import { searchLocal, facetsOf, impliedUsdDopRate, usdPrice } from "@/lib/catalog/local-search";
import { displayTitle, normalizeDetail } from "@/lib/catalog/normalize";
import { aeListingDetail } from "@/lib/alterestate/schemas";
import { loadDemoDetails } from "@/lib/catalog/demo";
import { priceLabel } from "@/lib/catalog/format";
import { aeImageUrl } from "@/lib/catalog/images";
import { catalogUrl } from "@/components/site/catalog/url";

describe("URL filters", () => {
  it("round-trips readable parameters", () => {
    const f = parseFilters({ operacion: "venta", tipo: "12,13", ciudad: "Cabrera", precio_max: "200000", moneda: "USD", habitaciones: "2", orden: "precio_asc", pagina: "3" });
    expect(f).toMatchObject({ operation: "sale", categories: [12, 13], city: "Cabrera", priceMax: 200000, bedroomsMin: 2, sort: "price_asc", page: 3 });
    const p = filtersToParams(f);
    expect(Object.fromEntries(p)).toMatchObject({ operacion: "venta", tipo: "12,13", ciudad: "Cabrera", precio_max: "200000", habitaciones: "2", orden: "precio_asc", pagina: "3" });
  });
  it("accepts legacy AlterEstate parameters", () => {
    const f = parseFilters({ country: "149", currency: "DOP", listing_type: "2", page: "1", category: "1" });
    expect(f).toMatchObject({ operation: "rent", categories: [1], currency: "DOP", page: 1 });
    expect(catalogUrl("es", f)).toBe("/alquiler?tipo=1");
    expect(catalogUrl("en", { ...f, operation: "sale" })).toBe("/en/for-sale?tipo=1");
  });
  it("rejects garbage and swaps inverted price ranges", () => {
    const f = parseFilters({ precio_min: "500000", precio_max: "100000", habitaciones: "abc", pagina: "-4", tipo: "x,99999" });
    expect(f.priceMin).toBe(100000);
    expect(f.priceMax).toBe(500000);
    expect(f.bedroomsMin).toBeNull();
    expect(f.page).toBe(1);
    expect(f.categories).toEqual([]);
  });
  it("marks refined searches as non-indexable but not the preset pages", () => {
    expect(hasRefinements(parseFilters({}, { operation: "sale" }), { operation: "sale" })).toBe(false);
    expect(hasRefinements(parseFilters({ ciudad: "Nagua" }, { operation: "sale" }), { operation: "sale" })).toBe(true);
  });
});

describe("demo catalogue + local search", async () => {
  const items = await loadDemoDetails();
  it("loads the real snapshot", () => {
    expect(items.length).toBeGreaterThan(150);
    expect(items.every((l) => l.slug && l.uid)).toBe(true);
  });
  it("filters by operation, type, city and paginates", () => {
    const r = searchLocal(items, { ...DEFAULT_FILTERS, operation: "sale", city: "Cabrera", categories: [12] });
    expect(r.count).toBeGreaterThan(0);
    expect(r.results.every((l) => l.location.city === "Cabrera" && l.category?.id === 12 && l.operations.includes("sale"))).toBe(true);
    expect(r.results.length).toBeLessThanOrEqual(24);
    const p2 = searchLocal(items, { ...DEFAULT_FILTERS, page: 2 });
    expect(p2.page).toBe(2);
    expect(new Set([...searchLocal(items, DEFAULT_FILTERS).results, ...p2.results].map((l) => l.uid)).size).toBe(48);
  });
  it("applies USD budgets using USD-normalised prices, and sorts", () => {
    const r = searchLocal(items, { ...DEFAULT_FILTERS, operation: "sale", priceMax: 100000, currency: "USD", sort: "price_desc" }, 500);
    const rate = impliedUsdDopRate(items);
    const prices = r.results.map((l) => usdPrice(l, "sale", rate) ?? Infinity);
    expect(r.results.some((l) => l.price.sale?.currency === "DOP")).toBe(true); // DOP listings compared via USD equivalent
    expect(prices.every((p) => p <= 100000)).toBe(true);
    expect([...prices].sort((a, b) => b - a)).toEqual(prices);
  });
  it("derives the DOP rate from AlterEstate's own normalised prices", () => {
    const rate = impliedUsdDopRate(items);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(40);
    expect(rate!).toBeLessThan(90);
  });
  it("returns an empty result set without error", () => {
    const r = searchLocal(items, { ...DEFAULT_FILTERS, city: "Ciudad inexistente" });
    expect(r).toMatchObject({ count: 0, results: [], totalPages: 1 });
  });
  it("builds facets from real data", () => {
    const f = facetsOf(items);
    expect(f.cities[0].name).toBe("Cabrera");
    expect(f.categories.find((c) => c.id === 12)?.name).toBe("Terrenos");
  });
});

describe("normalisation", () => {
  const minimal = aeListingDetail.parse({ uid: "AAA", slug: "test-1", name: null });
  it("handles a listing with almost no data", () => {
    const d = normalizeDetail(minimal, 2040);
    expect(d).toMatchObject({ title: "test-1", images: [], amenities: [], units: [], coordinates: null, hideLocation: true, agencyOwned: null });
    expect(priceLabel(d, "es")).toBeNull();
  });
  it("keeps prices in their own currency and periodicity", () => {
    const d = normalizeDetail(aeListingDetail.parse({ uid: "B", slug: "b", rent_price: 45000, currency_rent: "DOP", listing_type: [{ id: 2, listing: "Alquiler" }] }), 2040);
    expect(priceLabel(d, "es")).toEqual({ main: "RD$45,000", prefix: null, suffix: "/mes" });
    expect(d.operations).toEqual(["rent"]);
  });
  it("treats developments without listing_type as sales with 'from' price", () => {
    const d = normalizeDetail(aeListingDetail.parse({ uid: "C", slug: "c", is_project_v2: true, listing_type: [], project_values: { min_sale: 65000, currency_min_sale: "USD" }, variations: [{ status: "Publicada", sale_price: 65000, currency_sale: "USD" }, { status: "Vendida" }] }), 2040);
    expect(d.operations).toEqual(["sale"]);
    expect(priceLabel(d, "en")).toEqual({ main: "US$65,000", prefix: "From", suffix: null });
    expect(d.units.map((u) => u.status)).toEqual(["available", "sold"]);
  });
  it("never exposes coordinates when the location is hidden", () => {
    const d = normalizeDetail(aeListingDetail.parse({ uid: "D", slug: "d", hide_location: true, lat_long: { latitude: 19.6, longitude: -69.9 } }), 2040);
    expect(d.coordinates).toBeNull();
    const e = normalizeDetail(aeListingDetail.parse({ uid: "E", slug: "e", hide_location: false, lat_long: { latitude: 19.6, longitude: -69.9 } }), 2040);
    expect(e.coordinates).toEqual({ lat: 19.6, lng: -69.9 });
  });
  it("sanitises description HTML and video URLs", () => {
    const d = normalizeDetail(aeListingDetail.parse({ uid: "F", slug: "f", description: '<p onclick="x()">Hola<script>alert(1)</script></p><iframe src="https://evil"></iframe>', youtubeiframe: '<iframe src="https://www.youtube.com/embed/abc123"></iframe>' }), 2040);
    expect(d.descriptionHtml).toBe("<p>Hola</p>");
    expect(d.videoUrl).toBe("https://www.youtube.com/embed/abc123");
  });
  it("flags shared listings only when agent data says so", () => {
    expect(normalizeDetail(aeListingDetail.parse({ uid: "G", slug: "g", agents: [{ company: 999, full_name: "X" }] }), 2040).agencyOwned).toBe(false);
    expect(normalizeDetail(aeListingDetail.parse({ uid: "H", slug: "h", agents: [{ company: 2040, full_name: "Y" }] }), 2040).agencyOwned).toBe(true);
  });
  it("shows all-caps titles in sentence case without changing words", () => {
    expect(displayTitle("LOTE DE REVENTA EN COCO BAY")).toBe("Lote de reventa en coco bay");
    expect(displayTitle("Villa en Cabrera")).toBe("Villa en Cabrera");
  });
  it("rebuilds AlterEstate CDN image sizes", () => {
    expect(aeImageUrl("https://d2p0bx8wfdkjkb.cloudfront.net/static/properties/X/photo.jpeg", 800)).toBe("https://assets.alterestate.com/fit-in/800x600/filters:quality(72)/filters:format(webp)/static/properties/X/photo.jpeg");
  });
});
