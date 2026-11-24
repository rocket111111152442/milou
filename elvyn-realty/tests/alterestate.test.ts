import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AlterEstate live mode against a mocked HTTP server (no real call, no real token).
 * Shapes follow https://dev.alterestate.com/properties/list and /properties/retrieve.
 */
const TOKEN = "test-public-token";
const item = (i: number, extra: Record<string, unknown> = {}) => ({ cid: i, uid: `U${i}`, slug: `prop-${i}`, name: `Prop ${i}`, category: { id: 12, name: "Terrenos", name_en: "Land" }, listing_type: [{ id: 1, listing: "Venta" }], sale_price: 1000 * i, currency_sale: "USD", city: "Cabrera", featured_image: `https://assets.alterestate.com/fit-in/350x250/static/properties/X/${i}.jpg`, timestamp: `2026-11-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`, ...extra });
const page = (results: unknown[], next: string | null, count: number) => ({ count, next, previous: null, results });
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

let fetchMock: ReturnType<typeof vi.fn>;
async function load() {
  vi.resetModules();
  process.env.ALTERESTATE_PUBLIC_TOKEN = TOKEN;
  process.env.CATALOG_CACHE_SECONDS = "0"; // every call refreshes
  process.env.CATALOG_MAX_STALE_SECONDS = "3600";
  return import("@/lib/catalog/service");
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  process.env.ALTERESTATE_PUBLIC_TOKEN = "";
  delete process.env.CATALOG_CACHE_SECONDS;
});

describe("AlterEstate live integration (mocked API)", () => {
  it("sends aetoken, maps filters to documented parameters and de-duplicates", async () => {
    const svc = await load();
    fetchMock.mockResolvedValueOnce(json(page([item(1), item(1), item(2)], null, 2)));
    const { parseFilters } = await import("@/lib/catalog/filters");
    const r = await svc.searchListings(parseFilters({ operacion: "venta", tipo: "12", ciudad: "Cabrera", precio_max: "90000", moneda: "USD", habitaciones: "2", orden: "precio_asc", pagina: "2" }));
    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://secure.alterestate.com/api/v1/properties/filter/");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ page: "2", page_size: "24", listing_type: "1", category: "12", city_name: "Cabrera", currency: "USD", value_max: "90000", rooms_min: "2", sort: "us_saleprice" });
    expect(init.headers.aetoken).toBe(TOKEN);
    expect(r.results.map((x) => x.uid)).toEqual(["U1", "U2"]);
    expect(r.count).toBe(2);
  });

  it("retries on 429 honouring Retry-After", async () => {
    const svc = await load();
    fetchMock.mockResolvedValueOnce(json({ detail: "slow down" }, 429, { "retry-after": "0" })).mockResolvedValueOnce(json(page([item(3)], null, 1)));
    const { DEFAULT_FILTERS } = await import("@/lib/catalog/filters");
    const r = await svc.searchListings({ ...DEFAULT_FILTERS, q: "x" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.results[0].uid).toBe("U3");
  });

  it("walks all pages for the full inventory and drops withdrawn listings only after a complete fetch", async () => {
    const svc = await load();
    fetchMock
      .mockResolvedValueOnce(json(page(Array.from({ length: 30 }, (_, i) => item(i + 1)), "next", 31)))
      .mockResolvedValueOnce(json(page([item(31)], null, 31)));
    expect((await svc.getInventory()).length).toBe(31);
    // Next sync: page 1 ok, page 2 fails → the previous complete inventory is kept (stale), nothing dropped
    fetchMock.mockResolvedValueOnce(json(page(Array.from({ length: 30 }, (_, i) => item(i + 1)), "next", 31))).mockResolvedValue(json({}, 500));
    expect((await svc.getInventory()).length).toBe(31);
    // Complete sync where listing 31 was withdrawn → it disappears
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(json(page(Array.from({ length: 30 }, (_, i) => item(i + 1)), null, 30)));
    const inv = await svc.getInventory();
    expect(inv.length).toBe(30);
    expect(inv.find((l) => l.uid === "U31")).toBeUndefined();
  });

  it("returns null for a listing that no longer exists (404 empty body)", async () => {
    const svc = await load();
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    expect(await svc.getListing("prop-99")).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe("https://secure.alterestate.com/api/v1/properties/view/prop-99/");
  });

  it("rejects malformed slugs without calling the API", async () => {
    const svc = await load();
    expect(await svc.getListing("../../admin")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the catalogue as unavailable on invalid token or outage (no fake data)", async () => {
    const svc = await load();
    fetchMock.mockResolvedValue(json({ data: "None", error: "Not found.", status: "404" }, 404));
    await expect(svc.getInventory()).rejects.toBeInstanceOf(svc.CatalogUnavailable);
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError("network"));
    const { DEFAULT_FILTERS } = await import("@/lib/catalog/filters");
    await expect(svc.searchListings({ ...DEFAULT_FILTERS, q: "nuevo" })).rejects.toBeInstanceOf(svc.CatalogUnavailable);
  });
});
