import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getInventory, getListing, searchListings } from "@/lib/catalog/service";
import { invalidateManual } from "@/lib/catalog/manual";
import { DEFAULT_FILTERS } from "@/lib/catalog/filters";

/** Listings added by hand in the CRM appear on the site like AlterEstate ones. */
async function addListing(over: Partial<typeof schema.manualListings.$inferInsert> = {}) {
  const db = await getDb();
  const [r] = await db
    .insert(schema.manualListings)
    .values({ title: "Villa manual con piscina en Cabrera", operation: "sale", city: "Cabrera", sector: "La Catalina", price: 333000, currency: "USD", bedrooms: 3, bathrooms: 2, description: "Primer párrafo <b>con html</b>.\n\nSegundo párrafo.", amenities: ["Piscina", "Vista al mar"], published: true, ...over })
    .returning();
  const slug = `ea-${r.id}-villa-manual`;
  await db.update(schema.manualListings).set({ slug }).where(eq(schema.manualListings.id, r.id));
  invalidateManual();
  return { id: r.id, slug };
}

describe("manual listings", () => {
  it("are merged into the inventory, searchable and have a detail page", async () => {
    const { id, slug } = await addListing();
    const db = await getDb();
    const [img] = await db.insert(schema.manualListingImages).values({ listingId: id, mime: "image/jpeg", dataB64: Buffer.from([0xff, 0xd8, 0xff]).toString("base64") }).returning();
    invalidateManual();

    const inv = await getInventory();
    expect(inv[0].slug).toBe(slug);
    expect(inv[0].ref).toBe(`EA${id}`);
    expect(inv[0].image).toBe(`/api/listing-images/${img.id}`);
    expect(inv.length).toBeGreaterThan(1); // the demo catalogue is still there

    const r = await searchListings({ ...DEFAULT_FILTERS, city: "Cabrera", priceMin: 330000, priceMax: 340000 });
    expect(r.results.map((l) => l.slug)).toContain(slug);

    const d = await getListing(slug);
    expect(d?.title).toBe("Villa manual con piscina en Cabrera");
    expect(d?.descriptionHtml).toBe("<p>Primer párrafo &lt;b&gt;con html&lt;/b&gt;.</p><p>Segundo párrafo.</p>");
    expect(d?.amenities).toEqual(["Piscina", "Vista al mar"]);
    expect(d?.images).toEqual([`/api/listing-images/${img.id}`]);
    expect(d?.agents[0]?.phone).toBe("+18097105384");

    const { GET } = await import("@/app/api/listing-images/[id]/route");
    const res = await GET(new Request("http://localhost/x") as never, { params: Promise.resolve({ id: String(img.id) }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });

  it("drafts are hidden from the site", async () => {
    const { slug } = await addListing({ title: "Borrador oculto", published: false });
    expect((await getInventory()).some((l) => l.slug === slug)).toBe(false);
    expect(await getListing(slug)).toBeNull();
  });

  it("the assistant finds them", async () => {
    const { slug } = await addListing({ title: "Solar manual frente al mar", city: "Río San Juan", price: 45000 });
    const { __test } = await import("@/lib/ai/tools");
    const found = await __test.runSearch(await getInventory(), __test.searchInput.parse({ operation: "sale", property_types: null, location: "Río San Juan", budget_min: null, budget_max: 50000, currency: "USD", bedrooms_min: null, bathrooms_min: null, condition: "any", keywords: null, sort: "recent", limit: 3 }));
    expect(found.map((l) => l.slug)).toContain(slug);
  });
});
