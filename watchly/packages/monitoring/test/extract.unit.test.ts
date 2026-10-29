import { describe, expect, it } from "vitest";
import type { PageObservation } from "@watchly/types";
import { extractPage, looksJsRendered } from "../src/extract/html";
import { findPricesInText, parsePrice } from "../src/extract/price";
import { evaluatePage } from "../src/compare/evaluate";
import { changeRatio } from "../src/compare/similarity";
import { computeNextRun, retryDelayMinutes, stableJitterSeconds } from "../src/schedule/next-run";

const page = (body: string, head = "") => `<!doctype html><html><head><title>Produit test</title>${head}</head><body>${body}</body></html>`;
const extract = (html: string, cssSelector?: string) =>
  extractPage({ html, url: "https://shop.example.com/p", finalUrl: "https://shop.example.com/p", httpStatus: 200, method: "http", cssSelector, fetchedAt: new Date("2026-11-01T00:00:00Z") });

describe("parsePrice", () => {
  it.each([
    ["1 299,99 €", 1299.99],
    ["1 299,99 €", 1299.99],
    ["1.299,99", 1299.99],
    ["1,299.99", 1299.99],
    ["749,00", 749],
    ["749.5", 749.5],
    ["EUR 12.50", 12.5],
    ["1299,-", 1299],
    ["1.299", 1299],
    ["12", 12],
    [849.99, 849.99],
    ["gratuit", null],
    ["", null],
  ])("%s -> %s", (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it("finds euro prices in free text", () => {
    expect(findPricesInText("Avant 999 € — maintenant 1 049,90 € TTC").map((p) => p.value)).toEqual([999, 1049.9]);
  });
});

describe("extractPage", () => {
  it("reads price and availability from JSON-LD (including @graph and AggregateOffer)", () => {
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage" },
        { "@type": "Product", name: "PC", offers: { "@type": "AggregateOffer", lowPrice: "789.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" } },
      ],
    };
    const obs = extract(page(`<p>Autre prix 12 €</p>`, `<script type="application/ld+json">${JSON.stringify(ld)}</script>`));
    expect(obs).toMatchObject({ price: 789, currency: "EUR", priceSource: "jsonld", availability: "in_stock", availabilitySource: "jsonld" });
  });

  it("reads microdata, then meta tags", () => {
    const md = extract(page(`<div itemscope itemtype="https://schema.org/Product"><span itemprop="price" content="45.90">45,90 €</span><meta itemprop="priceCurrency" content="EUR"><link itemprop="availability" href="https://schema.org/OutOfStock"></div>`));
    expect(md).toMatchObject({ price: 45.9, priceSource: "microdata", availability: "out_of_stock" });
    const meta = extract(page("<p>x</p>", `<meta property="product:price:amount" content="19,99"><meta property="product:price:currency" content="EUR">`));
    expect(meta).toMatchObject({ price: 19.99, priceSource: "meta" });
  });

  it("falls back to French text for price and stock", () => {
    const obs = extract(page(`<h1>Console</h1><p class="prix">499,99 €</p><p>Victime de son succès — rupture de stock</p>`));
    expect(obs).toMatchObject({ price: 499.99, priceSource: "text", availability: "out_of_stock", availabilitySource: "text" });
  });

  it("restricts extraction to a CSS selector and reports when it is missing", () => {
    const html = page(`<div class="related">29 €</div><div id="main-price">1 099,00 €</div>`);
    expect(extract(html, "#main-price")).toMatchObject({ price: 1099, priceSource: "selector", selectorFound: true });
    expect(extract(html, "#absent").selectorFound).toBe(false);
    expect(extract(html, "<<invalid").selectorFound).toBe(false);
  });

  it("ignores scripts and styles in the compared text", () => {
    const a = extract(page(`<p>Bonjour</p><script>var t=${Date.now()}</script><style>.x{}</style>`));
    const b = extract(page(`<p>Bonjour</p><script>var t=1</script>`));
    expect(a.textHash).toBe(b.textHash);
    expect(a.excerpt).toBe("Bonjour");
  });

  it("detects probable JavaScript-rendered pages", () => {
    const html = page(`<div id="root"></div><noscript>You need to enable JavaScript</noscript>`);
    expect(looksJsRendered(html, extract(html))).toBe(true);
  });
});

function obs(over: Partial<PageObservation>): PageObservation {
  return { ...extract(page("<p>Texte de base de la page produit avec plusieurs mots.</p>")), ...over };
}

describe("evaluatePage", () => {
  it("alerts once when the price crosses below the threshold (no repeated alerts)", () => {
    const cond = { type: "price_below" as const, threshold: 800, currency: "EUR" as const };
    const r1 = evaluatePage(cond, obs({ price: 899 }), obs({ price: 879 }), "PC");
    expect(r1).toMatchObject({ triggered: false, outcome: "changed" });
    const r2 = evaluatePage(cond, obs({ price: 879 }), obs({ price: 789 }), "PC");
    expect(r2.triggered).toBe(true);
    expect(r2.alert?.title).toContain("800");
    const r3 = evaluatePage(cond, obs({ price: 789 }), obs({ price: 779 }), "PC");
    expect(r3.triggered).toBe(false);
    const r4 = evaluatePage(cond, null, obs({ price: 700 }), "PC");
    expect(r4.triggered).toBe(true);
  });

  it("reports an error instead of guessing when no price is found", () => {
    const r = evaluatePage({ type: "price_below", threshold: 10, currency: "EUR" }, null, obs({ price: null }), "X");
    expect(r).toMatchObject({ outcome: "error", errorCode: "price_not_found", triggered: false });
  });

  it("applies the minimum percentage for price drops", () => {
    const cond = { type: "price_drop" as const, minPercent: 10 };
    expect(evaluatePage(cond, obs({ price: 100 }), obs({ price: 95 }), "X").triggered).toBe(false);
    expect(evaluatePage(cond, obs({ price: 100 }), obs({ price: 89 }), "X").triggered).toBe(true);
    expect(evaluatePage(cond, obs({ price: 100 }), obs({ price: 120 }), "X").triggered).toBe(false);
  });

  it("alerts on the transition out of stock -> in stock only", () => {
    const cond = { type: "back_in_stock" as const };
    expect(evaluatePage(cond, obs({ availability: "out_of_stock" }), obs({ availability: "in_stock" }), "X").triggered).toBe(true);
    expect(evaluatePage(cond, obs({ availability: "in_stock" }), obs({ availability: "in_stock" }), "X").triggered).toBe(false);
    expect(evaluatePage(cond, null, obs({ availability: "in_stock" }), "X").triggered).toBe(false);
    expect(evaluatePage(cond, null, obs({ availability: "unknown" }), "X").errorCode).toBe("availability_unknown");
  });

  it("ignores insignificant page changes but reports significant ones with a summary", () => {
    const long = "Bienvenue sur notre page. " + Array.from({ length: 120 }, (_, i) => `Paragraphe numéro ${i} avec du contenu stable.`).join(" ");
    const prev = obs({ excerpt: long, textHash: "a".repeat(64) });
    const tiny = obs({ excerpt: long.replace("numéro 5 ", "numéro 5bis "), textHash: "b".repeat(64) });
    expect(evaluatePage({ type: "page_changed", sensitivity: "significant" }, prev, tiny, "X").triggered).toBe(false);
    expect(evaluatePage({ type: "page_changed", sensitivity: "any" }, prev, tiny, "X").triggered).toBe(true);
    const big = obs({ excerpt: long + " Nouvelle annonce importante : ouverture des inscriptions le 3 mars. ".repeat(10), textHash: "c".repeat(64) });
    const r = evaluatePage({ type: "page_changed", sensitivity: "significant" }, prev, big, "X");
    expect(r.triggered).toBe(true);
    expect(r.changeSummary?.added).toBeDefined();
  });

  it("detects text appearing and disappearing (accent and case insensitive)", () => {
    const cond = { type: "text_appears" as const, text: "Inscriptions ouvertes" };
    expect(evaluatePage(cond, obs({ excerpt: "Bientôt" }), obs({ excerpt: "Les INSCRIPTIONS OUVERTES dès maintenant" }), "X").triggered).toBe(true);
    expect(evaluatePage(cond, obs({ excerpt: "inscriptions ouvertes" }), obs({ excerpt: "inscriptions ouvertes" }), "X").triggered).toBe(false);
    const gone = { type: "text_disappears" as const, text: "Épuisé" };
    expect(evaluatePage(gone, obs({ excerpt: "Produit épuisé" }), obs({ excerpt: "Produit disponible" }), "X").triggered).toBe(true);
  });

  it("flags HTTP errors", () => {
    expect(evaluatePage({ type: "page_changed", sensitivity: "any" }, null, obs({ httpStatus: 404 }), "X")).toMatchObject({ outcome: "error", errorCode: "http_404" });
  });
});

describe("similarity", () => {
  it("returns 0 for identical texts and ignores volatile tokens", () => {
    expect(changeRatio("Mis à jour à 10:42 il y a 3 min", "Mis à jour à 11:05 il y a 9 min")).toBe(0);
    expect(changeRatio("un deux trois quatre", "cinq six sept huit")).toBe(1);
  });
});

describe("scheduling", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  it("computes the next run without catching up missed slots in bursts", () => {
    const next = computeNextRun({ from: new Date("2026-11-01T11:00:00Z"), intervalMinutes: 120, now });
    expect(next.toISOString()).toBe("2026-11-01T13:00:00.000Z");
    const late = computeNextRun({ from: new Date("2026-10-30T00:00:00Z"), intervalMinutes: 360, now });
    expect(late.getTime()).toBeGreaterThan(now.getTime());
    expect(late.getTime() - now.getTime()).toBeLessThanOrEqual(360 * 60_000);
  });

  it("produces stable jitter per task and bounded retry delays", () => {
    expect(stableJitterSeconds("task-a", 600)).toBe(stableJitterSeconds("task-a", 600));
    expect(stableJitterSeconds("task-a", 600)).toBeLessThan(600);
    expect(retryDelayMinutes(1, 720)).toBe(15);
    expect(retryDelayMinutes(10, 120)).toBe(120);
  });
});
