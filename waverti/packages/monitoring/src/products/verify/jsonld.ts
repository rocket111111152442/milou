/**
 * Lecture des données structurées Schema.org (JSON-LD) : Product, ProductGroup, Offer, AggregateOffer.
 * Un bloc malformé est ignoré et signalé, jamais « réparé » ; les parcours sont bornés (profondeur, nombre de nœuds).
 */
import type * as cheerio from "cheerio/slim";
import { parseDecimalToCents, normalizeCurrency } from "./money";

const MAX_BLOCKS = 20;
const MAX_BLOCK_CHARS = 500_000;
const MAX_NODES = 5000;
const MAX_DEPTH = 10;

export interface RawShipping {
  /** Pays de destination listés (« FR »). Vide = non précisé. */
  countries: string[];
  /** Frais en centimes si explicitement indiqués (0 = gratuit) ; null = non indiqué. */
  cents: number | null;
  currency: string | null;
}

export interface RawOffer {
  priceCents: number | null;
  /** Prix présent mais illisible ou ambigu (« 1.299 », fourchette…) : conservé pour le signaler. */
  priceUnreadable: boolean;
  currency: string | null;
  availability: string | null;
  condition: string | null;
  url: string | null;
  sku: string | null;
  sellerName: string | null;
  /** AggregateOffer sans offres détaillées et avec une fourchette de prix. */
  priceRange: boolean;
  shipping: RawShipping[];
}

export interface RawProduct {
  kind: "Product" | "ProductGroup";
  name: string | null;
  brand: string | null;
  mpn: string | null;
  model: string | null;
  sku: string | null;
  gtins: string[];
  color: string | null;
  size: string | null;
  url: string | null;
  condition: string | null;
  properties: Array<{ name: string; value: string }>;
  offers: RawOffer[];
  variants: RawProduct[];
}

export interface JsonLdResult {
  products: RawProduct[];
  warnings: string[];
}

const asArray = <T>(v: T | T[] | null | undefined): T[] => (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v]);

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("@value" in o) return str(o["@value"]);
    if ("name" in o) return str(o.name);
  }
  return null;
}

const typeOf = (node: Record<string, unknown>): string[] =>
  asArray(node["@type"] as string | string[]).map((t) => String(t).replace(/^.*[/#:]/, ""));

function lastSegment(v: unknown): string | null {
  const s = str(v);
  return s ? s.replace(/^.*[/#]/, "") : null;
}

function readShipping(raw: unknown): RawShipping[] {
  const out: RawShipping[] = [];
  for (const d of asArray(raw as unknown)) {
    if (!d || typeof d !== "object") continue;
    const o = d as Record<string, unknown>;
    const dest = asArray(o.shippingDestination as unknown)
      .map((x) => (x && typeof x === "object" ? str((x as Record<string, unknown>).addressCountry) : null))
      .filter((x): x is string => Boolean(x))
      .map((c) => c.toUpperCase());
    const rate = o.shippingRate && typeof o.shippingRate === "object" ? (o.shippingRate as Record<string, unknown>) : null;
    const cents = rate && "value" in rate ? parseDecimalToCents(rate.value as unknown) : null;
    out.push({ countries: dest, cents, currency: rate ? normalizeCurrency(rate.currency) : null });
  }
  return out;
}

function priceOf(o: Record<string, unknown>): { cents: number | null; unreadable: boolean } {
  let raw: unknown = o.price;
  if (raw === undefined || raw === null || raw === "") {
    // priceSpecification : on ignore les prix de référence (barrés, conseillés).
    const spec = asArray(o.priceSpecification as unknown).find((s) => {
      if (!s || typeof s !== "object") return false;
      const t = lastSegment((s as Record<string, unknown>).priceType);
      return !t || !/ListPrice|StrikethroughPrice|SRP|MSRP/i.test(t);
    }) as Record<string, unknown> | undefined;
    raw = spec?.price;
  }
  if (raw === undefined || raw === null || raw === "") return { cents: null, unreadable: false };
  const cents = parseDecimalToCents(raw);
  return { cents: cents !== null && cents > 0 ? cents : null, unreadable: cents === null || cents <= 0 };
}

function currencyOf(o: Record<string, unknown>): string | null {
  const direct = normalizeCurrency(o.priceCurrency);
  if (direct) return direct;
  const spec = asArray(o.priceSpecification as unknown).find((s) => s && typeof s === "object") as Record<string, unknown> | undefined;
  return spec ? normalizeCurrency(spec.priceCurrency) : null;
}

function readOffers(raw: unknown, depth = 0): RawOffer[] {
  if (depth > 3) return [];
  const out: RawOffer[] = [];
  for (const item of asArray(raw as unknown)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const types = typeOf(o);
    if (types.includes("AggregateOffer")) {
      const nested = readOffers(o.offers, depth + 1);
      if (nested.length) {
        out.push(...nested);
      } else {
        const low = parseDecimalToCents(o.lowPrice as unknown);
        const high = parseDecimalToCents(o.highPrice as unknown);
        out.push({
          priceCents: low !== null && low === high && low > 0 ? low : null,
          priceUnreadable: low === null || low !== high,
          currency: currencyOf(o),
          availability: lastSegment(o.availability),
          condition: lastSegment(o.itemCondition),
          url: str(o.url),
          sku: str(o.sku),
          sellerName: str(o.seller),
          priceRange: low !== high,
          shipping: readShipping(o.shippingDetails),
        });
      }
      continue;
    }
    const p = priceOf(o);
    out.push({
      priceCents: p.cents,
      priceUnreadable: p.unreadable,
      currency: currencyOf(o),
      availability: lastSegment(o.availability),
      condition: lastSegment(o.itemCondition),
      url: str(o.url),
      sku: str(o.sku),
      sellerName: str(o.seller),
      priceRange: false,
      shipping: readShipping(o.shippingDetails),
    });
  }
  return out;
}

function readProduct(o: Record<string, unknown>, kind: RawProduct["kind"], depth: number): RawProduct {
  const gtins = ["gtin", "gtin8", "gtin12", "gtin13", "gtin14", "isbn"].flatMap((k) => asArray(o[k] as unknown).map(str)).filter((x): x is string => Boolean(x));
  const properties = asArray(o.additionalProperty as unknown)
    .map((p) => (p && typeof p === "object" ? { name: str((p as Record<string, unknown>).name) ?? "", value: str((p as Record<string, unknown>).value) ?? "" } : null))
    .filter((p): p is { name: string; value: string } => Boolean(p && p.name && p.value));
  const variants: RawProduct[] = [];
  if (kind === "ProductGroup" && depth < 2) {
    for (const v of asArray(o.hasVariant as unknown)) {
      if (v && typeof v === "object") variants.push(readProduct(v as Record<string, unknown>, "Product", depth + 1));
    }
  }
  return {
    kind,
    name: str(o.name),
    brand: str(o.brand),
    mpn: str(o.mpn),
    model: str(o.model),
    sku: str(o.sku),
    gtins,
    color: str(o.color),
    size: str(o.size),
    url: str(o.url),
    condition: lastSegment(o.itemCondition),
    properties,
    offers: readOffers(o.offers),
    variants,
  };
}

function cleanBlock(text: string): string {
  return text
    .replace(/^﻿/, "")
    .replace(/^\s*<!--/, "")
    .replace(/-->\s*$/, "")
    .replace(/^\s*\/\/<!\[CDATA\[/, "")
    .replace(/\/\/\]\]>\s*$/, "")
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "")
    .trim();
}

export function extractJsonLd($: cheerio.CheerioAPI): JsonLdResult {
  const warnings: string[] = [];
  const products: RawProduct[] = [];
  const blocks = $('script[type]')
    .toArray()
    .filter((el) => ($(el).attr("type") ?? "").toLowerCase().split(";")[0]!.trim() === "application/ld+json");
  if (blocks.length > MAX_BLOCKS) warnings.push("jsonld_too_many_blocks");
  let nodes = 0;
  for (const el of blocks.slice(0, MAX_BLOCKS)) {
    const text = $(el).text();
    if (text.length > MAX_BLOCK_CHARS) {
      warnings.push("jsonld_block_too_large");
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanBlock(text));
    } catch {
      warnings.push("jsonld_malformed");
      continue;
    }
    const walk = (v: unknown, depth: number): void => {
      if (depth > MAX_DEPTH || nodes > MAX_NODES || !v || typeof v !== "object") return;
      nodes++;
      if (Array.isArray(v)) {
        for (const x of v) walk(x, depth + 1);
        return;
      }
      const o = v as Record<string, unknown>;
      const t = typeOf(o);
      if (t.includes("ProductGroup")) products.push(readProduct(o, "ProductGroup", 0));
      else if (t.some((x) => x === "Product" || x === "IndividualProduct" || x === "ProductModel")) products.push(readProduct(o, "Product", 0));
      if ("@graph" in o) walk(o["@graph"], depth + 1);
      // Seuls @graph et mainEntity sont parcourus : les listes de produits liés (ItemList) ne sont pas la fiche elle-même.
      for (const k of ["mainEntity", "mainEntityOfPage"]) if (k in o) walk(o[k], depth + 1);
    };
    walk(parsed, 0);
  }
  return { products, warnings };
}
