/**
 * Extraction de secours quand le JSON-LD est absent ou incomplet : microdonnées (itemprop), balises meta
 * (Open Graph / product:*), puis, en dernier recours, un prix visible UNIQUE et non barré.
 * Chaque valeur garde sa source ; le texte visible est la moins fiable et ne sert que s'il est sans ambiguïté.
 */
import type * as cheerio from "cheerio/slim";
import { normalizeCurrency, parseDecimalToCents } from "./money";

export interface FallbackData {
  name: string | null;
  brand: string | null;
  mpn: string | null;
  sku: string | null;
  gtins: string[];
  priceCents: number | null;
  priceUnreadable: boolean;
  currency: string | null;
  availability: string | null;
  condition: string | null;
  source: { price: "microdata" | "meta" | "html_text" | null; name: "microdata" | "meta" | "html_text" | null };
  warnings: string[];
}

const clean = (s: string | undefined | null) => (s ? s.replace(/\s+/g, " ").trim() || null : null);
const lastSegment = (s: string | null) => (s ? s.replace(/^.*[/#]/, "") : null);

function propValue($: cheerio.CheerioAPI, el: ReturnType<cheerio.CheerioAPI>): string | null {
  const content = el.attr("content");
  if (content !== undefined) return clean(content);
  const href = el.attr("href") ?? el.attr("src");
  if (href !== undefined && el.is("link")) return clean(href);
  return clean(el.text());
}

function metaContent($: cheerio.CheerioAPI, keys: string[]): string | null {
  for (const k of keys) {
    const v = $(`meta[property="${k}"], meta[name="${k}"]`).first().attr("content");
    if (clean(v)) return clean(v);
  }
  return null;
}

/** Prix visibles : uniquement avec une devise explicite à côté, jamais dans un élément barré ou « ancien prix ». */
const PRICE_TEXT = /(\d{1,3}(?:[   .]\d{3})*(?:,\d{1,2})|\d+(?:,\d{1,2})?|\d+\.\d{2})\s?(€|EUR)|(€|EUR)\s?(\d{1,3}(?:[   ,]\d{3})*(?:\.\d{1,2})|\d+(?:[.,]\d{1,2})?)/g;
const MAX_PRICE_BOXES = 200;
const PRICE_BOX = /(^|[\s_-])(price|prix|amount|tarif)([\s_-]|$)/i;
const NOT_CURRENT = /(old|was|before|strike|ancien|barre|original|regular|msrp|list-?price|unit|per-|par-)/i;

export function extractFallback($: cheerio.CheerioAPI): FallbackData {
  const warnings: string[] = [];
  const out: FallbackData = { name: null, brand: null, mpn: null, sku: null, gtins: [], priceCents: null, priceUnreadable: false, currency: null, availability: null, condition: null, source: { price: null, name: null }, warnings };

  // 1. Microdonnées
  const scope = $('[itemtype*="schema.org/Product" i]').first();
  if (scope.length) {
    const prop = (name: string) => {
      const el = scope.find(`[itemprop="${name}"]`).first();
      return el.length ? propValue($, el) : null;
    };
    out.name = prop("name");
    out.brand = (() => {
      const b = scope.find('[itemprop="brand"]').first();
      if (!b.length) return null;
      const inner = b.find('[itemprop="name"]').first();
      return inner.length ? propValue($, inner) : propValue($, b);
    })();
    out.mpn = prop("mpn");
    out.sku = prop("sku");
    for (const k of ["gtin", "gtin8", "gtin12", "gtin13", "gtin14"]) {
      const v = prop(k);
      if (v) out.gtins.push(v);
    }
    const offer = scope.find('[itemprop="offers"]').first();
    const inOffer = (name: string) => {
      const el = (offer.length ? offer : scope).find(`[itemprop="${name}"]`).first();
      return el.length ? propValue($, el) : null;
    };
    const rawPrice = inOffer("price");
    if (rawPrice) {
      const cents = parseDecimalToCents(rawPrice);
      out.priceCents = cents !== null && cents > 0 ? cents : null;
      out.priceUnreadable = out.priceCents === null;
      out.currency = normalizeCurrency(inOffer("priceCurrency"));
      out.source.price = "microdata";
    }
    out.availability = lastSegment(inOffer("availability"));
    out.condition = lastSegment(inOffer("itemCondition"));
    if (out.name) out.source.name = "microdata";
  }

  // 2. Balises meta
  if (out.priceCents === null && !out.priceUnreadable) {
    const rawPrice = metaContent($, ["product:price:amount", "og:price:amount", "twitter:data1"]);
    const cur = metaContent($, ["product:price:currency", "og:price:currency"]);
    if (rawPrice && cur) {
      const cents = parseDecimalToCents(rawPrice);
      out.priceCents = cents !== null && cents > 0 ? cents : null;
      out.priceUnreadable = out.priceCents === null;
      out.currency = normalizeCurrency(cur);
      out.source.price = "meta";
    }
  }
  if (!out.availability) out.availability = metaContent($, ["product:availability", "og:availability"])?.replace(/\s+/g, "") ?? null;
  if (!out.condition) out.condition = metaContent($, ["product:condition", "og:condition"]);
  if (!out.brand) out.brand = metaContent($, ["product:brand"]);
  if (!out.name) {
    const n = metaContent($, ["og:title"]);
    if (n) {
      out.name = n;
      out.source.name = "meta";
    }
  }

  // 3. Texte visible : dernier recours, seulement sans ambiguïté
  if (out.priceCents === null && !out.priceUnreadable) {
    const found = new Map<string, { cents: number; currency: string }>();
    let inspected = 0;
    $("[class], [id]").each((_, el) => {
      if (inspected > MAX_PRICE_BOXES) return false; // page hostile (milliers d'éléments « price ») : on s'arrête
      const node = $(el);
      const attrs = `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`;
      if (!PRICE_BOX.test(attrs) || NOT_CURRENT.test(attrs)) return;
      inspected++;
      // Ignore tout ce qui est dans un élément barré ou marqué « ancien prix ».
      if (node.closest("del, s, strike, [class*='old'], [class*='was'], [class*='strike'], [class*='ancien'], [class*='barre'], [class*='unit']").length) return;
      // Seulement les éléments les plus internes (évite de compter un conteneur et son enfant).
      if (node.find("[class], [id]").filter((_, c) => PRICE_BOX.test(`${$(c).attr("class") ?? ""} ${$(c).attr("id") ?? ""}`)).length) return;
      const text = node.text().replace(/\s+/g, " ");
      for (const m of text.matchAll(PRICE_TEXT)) {
        const num = m[1] ?? m[4];
        const cents = parseDecimalToCents(num);
        if (cents && cents > 0) found.set(`${cents}|EUR`, { cents, currency: "EUR" });
      }
    });
    if (inspected > MAX_PRICE_BOXES) {
      out.priceUnreadable = true;
      warnings.push("visible_price_ambiguous");
    } else if (found.size === 1) {
      const v = [...found.values()][0]!;
      out.priceCents = v.cents;
      out.currency = v.currency;
      out.source.price = "html_text";
      warnings.push("price_from_visible_text");
    } else if (found.size > 1) {
      out.priceUnreadable = true;
      warnings.push("visible_price_ambiguous");
    }
  }
  if (!out.name) {
    const h1 = $("h1");
    if (h1.length === 1 && clean(h1.text())) {
      out.name = clean(h1.text());
      out.source.name = "html_text";
    }
  }
  return out;
}
