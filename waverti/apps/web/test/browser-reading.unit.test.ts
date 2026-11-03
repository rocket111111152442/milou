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
});
