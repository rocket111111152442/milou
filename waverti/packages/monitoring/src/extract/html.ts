// Dépendances compatibles navigateur : ce module est aussi exécuté par l'application desktop.
import { sha256 as sha256Bytes } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as cheerio from "cheerio/slim";
import type { Availability, PageObservation } from "@waverti/types";
import { detectCurrency, findPricesInText, parsePrice } from "./price";
import { collapseWhitespace, normalizeForMatch } from "./text";

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
];
const IN_STOCK = ["en stock", "disponible immediatement", "ajouter au panier", "add to cart", "in stock", "expedie sous", "livraison gratuite des demain"];
const PREORDER = ["precommande", "pre-commande", "pre-order", "preorder", "precommander"];

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

function sha256(s: string) {
  return bytesToHex(sha256Bytes(utf8ToBytes(s)));
}

interface StructuredOffer {
  price: number | null;
  currency: string | null;
  availability: Availability | null;
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
    if (best?.price !== null && best?.price !== undefined) return;
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
        };
        if (offer.price !== null || offer.availability) {
          best = best ? { ...best, ...Object.fromEntries(Object.entries(offer).filter(([, v]) => v !== null)) } : offer;
          if (offer.price !== null) return;
        }
      }
    }
  });
  return best;
}

export interface ExtractInput {
  html: string;
  url: string;
  finalUrl: string;
  httpStatus: number;
  cssSelector?: string | null;
  method: "http" | "browser";
  fetchedAt?: Date;
}

/** Transforme une page HTML en observation structurée (prix, disponibilité, texte normalisé). */
export function extractPage(input: ExtractInput): PageObservation {
  const $ = cheerio.load(input.html.length > 3_000_000 ? input.html.slice(0, 3_000_000) : input.html);
  const title = collapseWhitespace($("title").first().text() || $('meta[property="og:title"]').attr("content") || "").slice(0, 300) || null;

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
  const ld = extractJsonLdOffer($);
  const mdPriceEl = $('[itemprop="price"]').first();
  const mdPriceRaw = mdPriceEl.attr("content") ?? mdPriceEl.text();
  const mdCurrency = $('[itemprop="priceCurrency"]').first().attr("content");
  const mdAvailEl = $('[itemprop="availability"]').first();
  const mdAvail = mdAvailEl.attr("href") ?? mdAvailEl.attr("content") ?? "";
  const metaPrice = $('meta[property="product:price:amount"], meta[property="og:price:amount"]').first().attr("content");
  const metaCurrency = $('meta[property="product:price:currency"], meta[property="og:price:currency"]').first().attr("content");
  const metaAvail = $('meta[property="product:availability"], meta[property="og:availability"]').first().attr("content");

  // Texte visible (scripts, styles et métadonnées retirés)
  $("script, style, noscript, svg, iframe, template, head, link, meta").remove();
  const body = $("body");
  const fullText = collapseWhitespace(body.length ? body.text() : $.root().text());
  const scopedText = scope ? collapseWhitespace(scope.text()) : fullText;
  const normalized = scopedText.slice(0, 200_000);

  // Prix et disponibilité
  let price: number | null = null;
  let currency: string | null = null;
  let priceSource: PageObservation["priceSource"] = null;
  let availability: Availability = "unknown";
  let availabilitySource: PageObservation["availabilitySource"] = "none";

  if (scope) {
    const p = findPricesInText(scopedText, 1)[0] ?? null;
    const direct = p ? p.value : parsePrice(scopedText);
    if (direct !== null && /\d/.test(scopedText)) {
      price = direct;
      currency = detectCurrency(scopedText) ?? "EUR";
      priceSource = "selector";
    }
  }
  if (price === null && ld?.price !== null && ld?.price !== undefined) {
    price = ld.price;
    currency = ld.currency ?? "EUR";
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
      currency = (mdCurrency ?? "EUR").toUpperCase();
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
      currency = (metaCurrency ?? "EUR").toUpperCase();
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
  if (price === null) {
    const found = findPricesInText(scopedText, 1)[0];
    if (found) {
      price = found.value;
      currency = found.currency;
      priceSource = "text";
    }
  }
  if (availability === "unknown") {
    const norm = normalizeForMatch(scopedText).slice(0, 50_000);
    if (PREORDER.some((k) => norm.includes(k))) availability = "preorder";
    else if (OUT_OF_STOCK.some((k) => norm.includes(k))) availability = "out_of_stock";
    else if (IN_STOCK.some((k) => norm.includes(k))) availability = "in_stock";
    if (availability !== "unknown") availabilitySource = "text";
  }

  return {
    kind: "page",
    url: input.url,
    finalUrl: input.finalUrl,
    httpStatus: input.httpStatus,
    title,
    price,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : price !== null ? "EUR" : null,
    priceSource,
    availability,
    availabilitySource,
    textHash: sha256(normalized),
    textLength: normalized.length,
    excerpt: normalized.slice(0, 4000),
    selectorFound,
    method: input.method,
    fetchedAt: (input.fetchedAt ?? new Date()).toISOString(),
  };
}

/** Heuristique : la page est-elle probablement générée en JavaScript (contenu quasi vide) ? */
export function looksJsRendered(html: string, obs: PageObservation): boolean {
  if (obs.textLength > 600) return false;
  return /<div[^>]+id=["'](root|app|__next|__nuxt)["']/i.test(html) || /<noscript>[^<]*(javascript|JavaScript)/.test(html);
}
