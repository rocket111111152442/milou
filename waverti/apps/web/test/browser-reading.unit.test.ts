import { describe, expect, it } from "vitest";
import { readBrowserReading } from "../src/app/app/surveillances/nouvelle/browser-reading";

const reading = {
  version: 1,
  url: "https://www.amazon.fr/dp/B0D9HXTGVS",
  price: 1881,
  currency: "EUR",
  availability: "in_stock",
  observedAt: "2026-11-03T20:56:00.000Z",
};
const now = Date.parse("2026-11-03T20:57:00.000Z");
const hash = (data: unknown) => "#waverti-releve=" + encodeURIComponent(JSON.stringify(data));

describe("browser reading", () => {
  it("accepts a recent reading with the canonical product URL", () => {
    expect(readBrowserReading(hash(reading), now)).toEqual(reading);
  });

  it.each([
    { ...reading, url: reading.url + "?tag=tracking" },
    { ...reading, url: "https://www.amazon.fr.evil.test/dp/B0D9HXTGVS" },
    { ...reading, observedAt: "2026-11-03T18:00:00.000Z" },
    { ...reading, currency: null },
    { ...reading, cookie: "unexpected" },
    { ...reading, price: null, currency: null, availability: "unknown" },
  ])("rejects invalid readings", (data) => {
    expect(readBrowserReading(hash(data), now)).toBe("invalid");
  });

  it("leaves unrelated fragments alone", () => {
    expect(readBrowserReading("#other-section", now)).toBeNull();
  });

  it("accepts a generic link without an offer and preserves its query and fragment", () => {
    const link = { ...reading, version: 2, url: "https://example.com/article?variant=2#details", price: null, currency: null, availability: "unknown" };
    expect(readBrowserReading(hash(link), now)).toEqual(link);
  });

  it("accepts a reading in its original currency", () => {
    const offer = { ...reading, version: 2, url: "https://example.com/product", currency: "USD" };
    expect(readBrowserReading(hash(offer), now)).toEqual(offer);
  });

  it("keeps a recurring import bound to the exact HTTPS product variant", () => {
    const recurring = { ...reading, version: 2, url: "https://example.com/product?variant=2", recurring: true };
    expect(readBrowserReading(hash(recurring), now)).toEqual(recurring);
    expect(readBrowserReading(hash({ ...recurring, url: recurring.url + "#other-variant" }), now)).toBe("invalid");
    expect(readBrowserReading(hash({ ...recurring, url: recurring.url.replace("https:", "http:") }), now)).toBe("invalid");
  });

  it.each(["javascript:alert(1)", "file:///some/file", "https://user:pass@example.com", "https:example.com"])("rejects an unsafe link: %s", (url) => {
    expect(readBrowserReading(hash({ ...reading, version: 2, url }), now)).toBe("invalid");
  });
});
