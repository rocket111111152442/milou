/** Reproducible local benchmark for extraction confidence and alert safety. */
import { writeFileSync } from "node:fs";
import { extractPage } from "../src/extract/html";
import { evaluatePage } from "../src/compare/evaluate";
import type { PageObservation } from "@waverti/types";

const url = "https://fixtures.invalid/product";
const at = new Date("2026-11-01T12:00:00Z");
const page = (body: string, head = "") => extractPage({ html: `<!doctype html><html><head><title>Fixture</title>${head}</head><body>${body}</body></html>`, url, finalUrl: url, httpStatus: 200, method: "http", fetchedAt: at });
const fixtures: Array<{ name: string; observation: PageObservation; expected: string }> = [
  { name: "eur-jsonld", observation: page("<h1>Produit</h1>", `<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":49.9,"priceCurrency":"EUR"}}</script>`), expected: "verified" },
  { name: "jsonld-no-currency", observation: page("Produit", `<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":49.9}}</script>`), expected: "uncertain" },
  { name: "usd-text", observation: page("$49.90"), expected: "verified" },
  { name: "gbp-text", observation: page("49,90 £"), expected: "verified" },
  { name: "missing-price", observation: page("<h1>Produit</h1><p>Contactez-nous</p>"), expected: "unavailable" },
  { name: "contradictory-jsonld", observation: page("Produit", `<script type="application/ld+json">{"@graph":[{"@type":"Offer","price":49.9,"priceCurrency":"EUR"},{"@type":"Offer","price":59.9,"priceCurrency":"EUR"}]}</script>`), expected: "contradictory" },
  { name: "multilingual-stock", observation: page("Auf Lager"), expected: "unavailable" },
  { name: "promotion", observation: page("<p class=price>79,90 €</p><del>99,90 €</del>"), expected: "verified" },
];

const confidenceCounts = Object.fromEntries(["verified", "uncertain", "unavailable", "contradictory"].map((s) => [s, 0]));
const mismatches: string[] = [];
for (const f of fixtures) {
  const status = f.observation.fieldEvidence?.price?.status ?? "legacy";
  if (status in confidenceCounts) confidenceCounts[status]!++;
  if (status !== f.expected) mismatches.push(`${f.name}: expected ${f.expected}, got ${status}`);
}

const uncertain = { ...page("49,90"), price: 49.9, currency: "EUR", priceSource: "text" as const };
const reliable = page("39,90 €");
const structureA = page("<main><p>Texte stable</p></main>");
const structureB = { ...page("<div class=wrapper><main><p>Texte stable</p></main></div>"), contentHash: structureA.contentHash, textHash: "b".repeat(64) };
const alertCases = [
  { name: "uncertain-price-drop", before: uncertain, after: reliable, condition: { type: "price_drop" as const, minPercent: 10 }, expectedAfter: true, legacy: { ...uncertain, fieldEvidence: undefined } },
  { name: "structure-only-change", before: structureA, after: structureB, condition: { type: "page_changed" as const, sensitivity: "significant" as const }, expectedAfter: false, legacy: { ...structureA, contentHash: undefined } },
];
const alertResults = alertCases.map((c) => ({ name: c.name, beforeTriggered: evaluatePage(c.condition, c.legacy, c.legacy, "fixture").triggered, afterTriggered: evaluatePage(c.condition, c.before, c.after, "fixture").triggered, expectedAfter: c.expectedAfter }));
const report = { generatedAt: new Date().toISOString(), node: process.version, fixtureCount: fixtures.length, confidenceCounts, confidenceMismatches: mismatches, alertResults, notes: "All fixtures are local HTML strings. The legacy column removes lot-2 evidence fields to replay the old decision inputs; it is not a claim that every historical page behaved identically. No third-party collection, HTTP, browser, database or monetary cost is measured." };
writeFileSync("docs/RELIABILITY-BENCHMARK.json", JSON.stringify(report, null, 2) + "\n");
console.info(JSON.stringify(report, null, 2));
