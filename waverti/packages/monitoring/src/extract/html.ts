// Dépendances compatibles navigateur : ce module est aussi exécuté par l'application desktop.
import { sha256 as sha256Bytes } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as cheerio from "cheerio/slim";
import type { Availability, ExtractionFieldEvidence, ExtractionStatus, PageObservation } from "@waverti/types";
import { detectCurrency, findTravelPriceCandidates, parsePrice } from "./price";
import { collapseWhitespace, normalizeForMatch } from "./text";
import { extractStructure, jsonLdItems, jsonLdRegularPrice, strikethroughPrice } from "./structure";

const OUT_OF_STOCK = [
  "rupture de stock",
  "en rupture",
  "epuise",
  "indisponible",
  "plus disponible",
  "victime de son succes",
  "temporairement indisponible",
  "out of stock",
  "sold out",
  "currently unavailable",
  "non disponible",
  "agotado",
  "ausverkauft",
  "nicht verfügbar",
  "nicht verfugbar",
  "non disponibile",
];
const IN_STOCK = ["en stock", "disponible immediatement", "ajouter au panier", "add to cart", "in stock", "expedie sous", "livraison gratuite des demain", "disponible", "disponibile", "verfügbar", "verfugbar", "auf lager", "available"];
const PREORDER = ["precommande", "pre-commande", "pre-order", "preorder", "precommander", "preorden", "vorbestellung"];

const SCHEMA_AVAILABILITY: Record<string, Availability> = {
  instock: "in_stock",
  onlineonly: "in_stock",
  limitedavailability: "in_stock",
  instoreonly: "in_stock",
  outofstock: "out_of_stock",
  soldout: "out_of_stock",
  discontinued: "out_of_stock",
  backorder: "out_of_stock",
  preorder: "preorder",
  presale: "preorder",
};

function mapAvailability(raw: unknown): Availability | null {
  if (typeof raw !== "string") return null;
  const key = raw.split("/").pop()!.toLowerCase().replace(/[^a-z]/g, "");
  return SCHEMA_AVAILABILITY[key] ?? null;
}

function isAmazonProduct(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return /(?:^|\.)amazon\.(?:fr|com|ca|de|it|es|nl|co\.uk|com\.be|com\.au|co\.jp)$/i.test(hostname) &&
      /\/(?:dp|gp\/product|gp\/aw\/d)\/[a-z0-9]{10}(?:\/|$)/i.test(pathname);
  } catch {
    return false;
  }
}

function amazonPriceCandidates($: cheerio.CheerioAPI) {
  const mainPrice = "#corePrice_feature_div .a-price, #corePriceDisplay_desktop_feature_div .a-price, #corePriceDisplay_mobile_feature_div .a-price";
  return $(mainPrice).toArray().flatMap((element) => {
    const box = $(element);
    if (!box.is(".priceToPay, .apex-pricetopay-value") || box.closest(".a-text-price, [data-a-strike='true'], [hidden], .aok-hidden").length) return [];
    const whole = box.find(".a-price-whole").first().text().replace(/[.,\s]/g, "");
    const fraction = box.find(".a-price-fraction").first().text().trim();
    const splitPrice = /^\d+$/.test(whole) && (!fraction || /^\d{2}$/.test(fraction))
      ? `${whole}${fraction ? `.${fraction}` : ""}${box.find(".a-price-symbol").first().text()}` : "";
    const raw = box.find(".a-offscreen").first().text().trim() || splitPrice;
    const currency = detectCurrency(raw);
    const value = parsePrice(raw);
    return currency && value !== null && value > 0 ? [{ value, currency, source: "selector" as const }] : [];
  });
}

function amazonStockCandidates($: cheerio.CheerioAPI): Availability[] {
  return $("#availability, #outOfStock").toArray().flatMap((element) => {
    const block = $(element);
    if (block.closest("[hidden], .aok-hidden").length) return [];
    const text = normalizeForMatch(block.text()).slice(0, 500);
    if (PREORDER.some((word) => text.includes(word))) return ["preorder"];
    if (OUT_OF_STOCK.some((word) => text.includes(word)) || /\b(?:pas en stock|not in stock|unavailable)\b/.test(text)) return ["out_of_stock"];
    return /\b(?:en stock|in stock|auf lager)\b/.test(text) ? ["in_stock"] : [];
  });
}

function sha256(s: string) {
  return bytesToHex(sha256Bytes(utf8ToBytes(s)));
}

interface StructuredOffer {
  price: number | null;
  currency: string | null;
  availability: Availability | null;
  source: "jsonld";
}

function* walkJsonLd(node: unknown, depth = 0): Generator<Record<string, unknown>> {
  if (depth > 6 || !node) return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walkJsonLd(n, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  yield obj;
  for (const key of ["@graph", "offers", "mainEntity", "itemOffered", "hasVariant"]) {
    if (obj[key]) yield* walkJsonLd(obj[key], depth + 1);
  }
}

function typeIncludes(obj: Record<string, unknown>, t: string): boolean {
  const v = obj["@type"];
  return Array.isArray(v) ? v.some((x) => String(x).toLowerCase() === t) : String(v ?? "").toLowerCase() === t;
}

export function extractJsonLdOffer($: cheerio.CheerioAPI): StructuredOffer | null {
  let best: StructuredOffer | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    if (!raw || raw.length > 500_000) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    for (const obj of walkJsonLd(data)) {
      if (typeIncludes(obj, "offer") || typeIncludes(obj, "aggregateoffer")) {
        const price = parsePrice(obj.price ?? obj.lowPrice ?? (obj.priceSpecification as Record<string, unknown> | undefined)?.price);
        const offer: StructuredOffer = {
          price,
          currency: typeof obj.priceCurrency === "string" ? obj.priceCurrency.toUpperCase() : null,
          availability: mapAvailability(obj.availability),
          source: "jsonld",
        };
        if (offer.price !== null || offer.availability) {
          best = best ?? offer;
        }
      }
    }
  });
  return best;
}

/** Collect every explicit JSON-LD offer so a disagreement is visible instead of silently picking the first block. */
function collectJsonLdOffers($: cheerio.CheerioAPI): StructuredOffer[] {
  const out: StructuredOffer[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    if (!raw || raw.length > 500_000) return;
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return; }
    for (const obj of walkJsonLd(data)) {
      if (!typeIncludes(obj, "offer") && !typeIncludes(obj, "aggregateoffer")) continue;
      const price = parsePrice(obj.price ?? obj.lowPrice ?? (obj.priceSpecification as Record<string, unknown> | undefined)?.price);
      const currency = typeof obj.priceCurrency === "string" && /^[A-Za-z]{3}$/.test(obj.priceCurrency) ? obj.priceCurrency.toUpperCase() : null;
      if (price !== null || obj.availability) out.push({ price, currency, availability: mapAvailability(obj.availability), source: "jsonld" });
      if (out.length >= 12) return;
    }
  });
  return out;
}

const evidence = (status: ExtractionStatus, sources: string[], checkedAt: string, note?: string): ExtractionFieldEvidence => ({ status, sources, checkedAt, ...(note ? { note } : {}) });

function distinctPriceCandidates(candidates: Array<{ value: number; currency: string | null; source: string }>): Array<{ value: number; currency: string | null; source: string }> {
  const seen = new Set<string>();
  return candidates.filter((c) => { const key = `${c.value}|${c.currency ?? ""}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

export interface ExtractInput {
  html: string;
  url: string;
  finalUrl: string;
  httpStatus: number;
  cssSelector?: string | null;
  method: "http" | "browser";
  fetchedAt?: Date;
  /** Temps de réponse mesuré (ms). */
  responseMs?: number;
  /** false : extraction historique seule (tests de compatibilité). */
  enrich?: boolean;
}

/** Transforme une page HTML en observation structurée (prix, disponibilité, texte normalisé). */
export function extractPage(input: ExtractInput): PageObservation {
  const $ = cheerio.load(input.html.length > 3_000_000 ? input.html.slice(0, 3_000_000) : input.html);
  const checkedAt = (input.fetchedAt ?? new Date()).toISOString();
  const titleEl = collapseWhitespace($("title").first().text()).slice(0, 300);
  const ogTitle = collapseWhitespace($('meta[property="og:title"]').attr("content") ?? "").slice(0, 300);
  const title = titleEl || ogTitle || null;
  const amazon = isAmazonProduct(input.finalUrl) || isAmazonProduct(input.url);
  const amazonPrices = amazon ? amazonPriceCandidates($) : [];
  const amazonStock = amazon ? amazonStockCandidates($) : [];

  let selectorFound: boolean | null = null;
  let scope: cheerio.Cheerio<never> | null = null;
  if (input.cssSelector) {
    try {
      const sel = $(input.cssSelector);
      selectorFound = sel.length > 0;
      if (selectorFound) scope = sel.first() as cheerio.Cheerio<never>;
    } catch {
      selectorFound = false;
    }
  }


  // Données structurées lues AVANT de retirer les scripts du document.
  const ld = amazon ? null : extractJsonLdOffer($);
  const ldOffers = amazon ? [] : collectJsonLdOffers($);
  const ldItems = input.enrich === false ? [] : jsonLdItems($, input.finalUrl);
  const ldRegular = input.enrich === false ? null : jsonLdRegularPrice($);
  const mdPriceEl = $('[itemprop="price"]').first();
  const mdPriceRaw = amazon ? undefined : mdPriceEl.attr("content") ?? mdPriceEl.text();
  const mdCurrency = $('[itemprop="priceCurrency"]').first().attr("content");
  const mdAvailEl = $('[itemprop="availability"]').first();
  const mdAvail = amazon ? undefined : mdAvailEl.attr("href") ?? mdAvailEl.attr("content");
  const metaPrice = amazon ? undefined : $('meta[property="product:price:amount"], meta[property="og:price:amount"]').first().attr("content");
  const metaCurrency = $('meta[property="product:price:currency"], meta[property="og:price:currency"]').first().attr("content");
  const metaAvail = amazon ? undefined : $('meta[property="product:availability"], meta[property="og:availability"]').first().attr("content");
  const referenceRaw = $('[itemprop="sku"], [itemprop="mpn"], meta[property="product:retailer_item_id"]').first().attr("content") ?? $('[itemprop="sku"], [itemprop="mpn"]').first().text();

  // Texte visible (scripts, styles et métadonnées retirés)
  $("script, style, noscript, svg, iframe, template, head, link, meta").remove();
  const body = $("body");
  const fullText = collapseWhitespace(body.length ? body.text() : $.root().text());
  const scopedText = scope ? collapseWhitespace(scope.text()) : fullText;
  const normalized = scopedText.slice(0, 200_000);
  const travelPrices = amazon && !scope ? { all: [], primary: null } : findTravelPriceCandidates(scopedText);
  const primaryTextPrice = travelPrices.primary;

  // Prix et disponibilité
  let price: number | null = null;
  let currency: string | null = null;
  let priceSource: PageObservation["priceSource"] = null;
  let availability: Availability = "unknown";
  let availabilitySource: PageObservation["availabilitySource"] = "none";

  if (scope) {
    const p = primaryTextPrice;
    const direct = p ? p.value : amazon ? null : parsePrice(scopedText);
    if (direct !== null && /\d/.test(scopedText)) {
      price = direct;
      currency = detectCurrency(scopedText);
      priceSource = "selector";
    }
  }
  if (price === null && amazonPrices.length) {
    ({ value: price, currency, source: priceSource } = amazonPrices[0]!);
  }
  if (price === null && ld?.price !== null && ld?.price !== undefined) {
    price = ld.price;
    currency = ld.currency;
    priceSource = "jsonld";
  }
  if (ld?.availability) {
    availability = ld.availability;
    availabilitySource = "jsonld";
  }
  if (price === null) {
    const v = parsePrice(mdPriceRaw);
    if (v !== null) {
      price = v;
      currency = mdCurrency && /^[A-Za-z]{3}$/.test(mdCurrency) ? mdCurrency.toUpperCase() : null;
      priceSource = "microdata";
    }
  }
  if (availability === "unknown") {
    const mapped = mapAvailability(mdAvail);
    if (mapped) {
      availability = mapped;
      availabilitySource = "microdata";
    }
  }
  if (price === null) {
    const v = parsePrice(metaPrice);
    if (v !== null) {
      price = v;
      currency = metaCurrency && /^[A-Za-z]{3}$/.test(metaCurrency) ? metaCurrency.toUpperCase() : null;
      priceSource = "meta";
    }
  }
  if (availability === "unknown") {
    const mapped = mapAvailability(metaAvail?.replace(/\s/g, "") ?? "");
    if (mapped) {
      availability = mapped;
      availabilitySource = "microdata";
    }
  }

  const priceCandidates = distinctPriceCandidates([
    ...(amazon && !primaryTextPrice ? amazonPrices : []),
    ...ldOffers.filter((o) => o.price !== null).map((o) => ({ value: o.price!, currency: o.currency, source: "jsonld" })),
    ...(scope && primaryTextPrice ? [{ value: primaryTextPrice.value, currency: detectCurrency(scopedText), source: "selector" }] : []),
    ...(parsePrice(mdPriceRaw) !== null ? [{ value: parsePrice(mdPriceRaw)!, currency: mdCurrency && /^[A-Za-z]{3}$/.test(mdCurrency) ? mdCurrency.toUpperCase() : null, source: "microdata" }] : []),
    ...(parsePrice(metaPrice) !== null ? [{ value: parsePrice(metaPrice)!, currency: metaCurrency && /^[A-Za-z]{3}$/.test(metaCurrency) ? metaCurrency.toUpperCase() : null, source: "meta" }] : []),
    ...travelPrices.all.map((candidate) => ({ value: candidate.value, currency: candidate.currency, source: "text" })),
  ]);
  const textPrice = primaryTextPrice;
  if (price === null && textPrice) {
    price = textPrice.value;
    currency = textPrice.currency;
    priceSource = "text";
  }
  if (amazonStock.length) {
    availability = amazonStock[0]!;
    availabilitySource = "text";
  } else if (!amazon && availability === "unknown") {
    const norm = normalizeForMatch(scopedText).slice(0, 50_000);
    if (PREORDER.some((k) => norm.includes(k))) availability = "preorder";
    else if (OUT_OF_STOCK.some((k) => norm.includes(k))) availability = "out_of_stock";
    else if (IN_STOCK.some((k) => norm.includes(k))) availability = "in_stock";
    if (availability !== "unknown") availabilitySource = "text";
  }
  const authoritativePrices = priceCandidates.filter((c) => c.source !== "text");
  const priceContradictory = authoritativePrices.length > 1;
  const priceStatus: ExtractionStatus = priceContradictory ? "contradictory" : price === null ? "unavailable" : !currency ? "uncertain" : "verified";
  if (priceContradictory) {
    price = null;
    currency = null;
    priceSource = null;
  }
  const availabilityCandidates = [
    ...amazonStock,
    ld?.availability,
    mapAvailability(mdAvail),
    mapAvailability(metaAvail),
  ].filter((v): v is Availability => Boolean(v) && v !== "unknown");
  const availabilityContradictory = new Set(availabilityCandidates).size > 1;
  const availabilityStatus: ExtractionStatus = availabilityContradictory ? "contradictory" : availability === "unknown" ? "unavailable" : "verified";
  if (availabilityContradictory) {
    availability = "unknown";
    availabilitySource = "none";
  }

  // Données enrichies (règles personnalisées). Le texte et l'empreinte historiques ci-dessus sont inchangés.
  let enriched: Partial<PageObservation> = {};
  if (input.enrich !== false) {
    const regular = amazon ? null : !priceContradictory && ldRegular !== null && price !== null && ldRegular > price ? ldRegular : strikethroughPrice($, scope, price);
    const st = extractStructure($, scope, input.finalUrl, ldItems);
    const visibleReference = /\b(?:ref|réf(?:érence)?)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,})/i.exec(normalized)?.[1] ?? null;
    const reference = collapseWhitespace(referenceRaw?.trim() || visibleReference || "").slice(0, 160) || null;
    enriched = {
      contentKind: "html",
      contentHash: st.contentHash,
      regularPrice: regular,
      headings: st.headings,
      links: st.links,
      documents: st.documents,
      items: st.items,
      dates: st.dates,
      tableHashes: st.tableHashes,
      forms: st.forms,
      reference,
      date: st.dates[0] ?? null,
      priceKind: regular !== null && price !== null ? "promotion" : price !== null ? "current" : undefined,
      ...(priceCandidates.length ? { priceCandidates } : {}),
      fieldEvidence: {
        price: evidence(priceStatus, priceCandidates.map((c) => c.source), checkedAt, priceContradictory ? "Plusieurs sources annoncent des prix différents." : undefined),
        currency: evidence(price === null ? "unavailable" : !currency ? "uncertain" : priceStatus === "contradictory" ? "contradictory" : "verified", priceCandidates.map((c) => c.source), checkedAt),
        availability: evidence(availabilityStatus, availabilitySource === "none" ? [] : [availabilitySource], checkedAt),
        title: evidence(title ? "verified" : "unavailable", [titleEl ? "title" : ogTitle ? "og:title" : ""].filter(Boolean), checkedAt),
        reference: evidence(reference ? "verified" : "unavailable", reference ? ["microdata"] : [], checkedAt),
        date: evidence(st.dates.length ? "verified" : "unavailable", st.dates.length ? ["html"] : [], checkedAt),
        text: evidence(normalized ? "verified" : "unavailable", normalized ? ["visible_text"] : [], checkedAt),
      },
      ...(input.responseMs !== undefined ? { responseMs: Math.round(input.responseMs) } : {}),
    };
  }

  return {
    ...enriched,
    kind: "page",
    url: input.url,
    finalUrl: input.finalUrl,
    httpStatus: input.httpStatus,
    title,
    price,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    priceSource,
    availability,
    availabilitySource,
    textHash: sha256(normalized),
    textLength: normalized.length,
    excerpt: normalized.slice(0, 4000),
    selectorFound,
    method: input.method,
    fetchedAt: checkedAt,
  };
}

/** Heuristique : la page est-elle probablement générée en JavaScript (contenu quasi vide) ? */
export function looksJsRendered(html: string, obs: PageObservation): boolean {
  if (obs.textLength > 600) return false;
  return /<div[^>]+id=["'](root|app|__next|__nuxt)["']/i.test(html) || /<noscript>[^<]*(javascript|JavaScript)/.test(html);
}
