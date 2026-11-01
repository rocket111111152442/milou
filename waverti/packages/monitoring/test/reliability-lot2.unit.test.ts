import { describe, expect, it } from "vitest";
import type { PageObservation } from "@waverti/types";
import { extractPage } from "../src/extract/html";
import { evaluatePage } from "../src/compare/evaluate";
import { evaluateRule, emptyMemory } from "../src/compare/rules";

const url = "https://shop.example.test/product";
const page = (body: string, head = "") => extractPage({ html: `<!doctype html><html><head><title>Produit test</title>${head}</head><body>${body}</body></html>`, url, finalUrl: url, httpStatus: 200, method: "http", fetchedAt: new Date("2026-11-01T12:00:00Z") });

describe("lot 2 — extraction fiable", () => {
  it("does not invent a currency and marks a text-only price uncertain", () => {
    const noCurrency = page('<div itemprop="price" content="49.90">49,90</div>');
    expect(noCurrency.price).toBe(49.9);
    expect(noCurrency.currency).toBeNull();
    expect(noCurrency.fieldEvidence?.price?.status).toBe("uncertain");
    expect(noCurrency.fieldEvidence?.currency?.status).toBe("uncertain");
    expect(evaluatePage({ type: "price_below", threshold: 100, currency: "EUR" }, null, noCurrency, "P").triggered).toBe(false);
    expect(evaluatePage({ type: "price_below", threshold: 100, currency: "EUR" }, null, noCurrency, "P").errorCode).toBeNull();
  });

  it("keeps explicit USD and GBP separate", () => {
    expect(page("$49.90").currency).toBe("USD");
    expect(page("49,90 £").currency).toBe("GBP");
  });

  it("rejects contradictory authoritative JSON-LD offers", () => {
    const head = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": [
      { "@type": "Product", name: "Produit", offers: { "@type": "Offer", price: "49.90", priceCurrency: "EUR" } },
      { "@type": "Offer", price: "59.90", priceCurrency: "EUR" },
    ] })}</script>`;
    const obs = page("<h1>Produit</h1>", head);
    expect(obs.price).toBeNull();
    expect(obs.fieldEvidence?.price?.status).toBe("contradictory");
    expect(obs.priceCandidates?.map((x) => x.value)).toEqual([49.9, 59.9]);
  });

  it("separates current and regular promotion prices", () => {
    const obs = page('<p class="price">79,90 €</p><del>99,90 €</del>');
    expect(obs.price).toBe(79.9);
    expect(obs.regularPrice).toBe(99.9);
    expect(obs.priceKind).toBe("promotion");
  });

  it("does not infer one variant from a ProductGroup with different offers", () => {
    const head = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "ProductGroup", name: "T-shirt", hasVariant: [
      { "@type": "Product", name: "T-shirt S", offers: { "@type": "Offer", price: "19.90", priceCurrency: "EUR" } },
      { "@type": "Product", name: "T-shirt XL", offers: { "@type": "Offer", price: "24.90", priceCurrency: "EUR" } },
    ] })}</script>`;
    const obs = page("<h1>T-shirt</h1>", head);
    expect(obs.fieldEvidence?.price?.status).toBe("contradictory");
    expect(obs.price).toBeNull();
  });

  it("handles multilingual availability and keeps missing data unavailable", () => {
    expect(page("Auf Lager").availability).toBe("in_stock");
    expect(page("Agotado").availability).toBe("out_of_stock");
    const incomplete = page("<h1>Produit</h1><p>Contactez-nous</p>");
    expect(incomplete.fieldEvidence?.price?.status).toBe("unavailable");
    expect(incomplete.fieldEvidence?.availability?.status).toBe("unavailable");
    expect(incomplete.reference).toBeNull();
  });

  it("records reference, date and verification timestamp", () => {
    const obs = page('<meta itemprop="sku" content="SKU-42"><p>Événement le 12 mars 2027</p>');
    expect(obs.reference).toBe("SKU-42");
    expect(obs.date).toBe("2027-03-12");
    expect(obs.fieldEvidence?.reference?.checkedAt).toBe("2026-11-01T12:00:00.000Z");
  });

  it("does not alert on a structural-only change when stable content hashes match", () => {
    const a = page("<main><p>Texte stable de la page.</p></main>");
    const b = { ...page("<div class=\"new-wrapper\"><main><p>Texte stable de la page.</p></main></div>"), contentHash: a.contentHash, textHash: "b".repeat(64) };
    const r = evaluatePage({ type: "page_changed", sensitivity: "significant" }, a, b, "P");
    expect(r.triggered).toBe(false);
  });

  it("never emits a price-drop alert from uncertain values", () => {
    const uncertain = { ...page("49,90"), price: 49.9, currency: "EUR", priceSource: "text" as const, fieldEvidence: { ...page("49,90").fieldEvidence!, price: { ...page("49,90").fieldEvidence!.price, status: "uncertain" as const } } } as PageObservation;
    const reliable = page("39,90 €");
    const r = evaluatePage({ type: "price_drop", minPercent: 10 }, uncertain, reliable, "P");
    expect(r.triggered).toBe(false);
    expect(r.errorCode).toBeNull();
  });

  it("treats an HTTP error as an error, never as out of stock", () => {
    const error = { ...page("<p>Erreur</p>"), httpStatus: 503, availability: "unknown" as const };
    const r = evaluateRule({ rule: { type: "rule", version: 1, category: "product", match: "all", conditions: [{ type: "stock_is", state: "out_of_stock" }], groups: [], exclude: [], options: { cooldownMinutes: 0, confirm: false, notifyRecovery: false } }, prev: null, curr: error, failure: null, memory: emptyMemory(), taskName: "P", now: new Date("2026-11-01T12:00:00Z") });
    expect(r.evaluation.triggered).toBe(false);
    expect(r.evaluation.outcome).toBe("error");
  });
});
