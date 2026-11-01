/**
 * Pré-filtrage des résultats de recherche AVANT toute vérification de fiche (donc avant toute requête HTTP) :
 * adresses invalides, doublons, sites qui ne sont pas des vendeurs, pages qui ne sont pas des fiches produit,
 * accessoires, autres modèles, autres variantes. Un extrait de recherche n'est JAMAIS un prix : seuls un titre et un
 * extrait de texte sont conservés (le type OfferCandidate n'a pas de champ de prix).
 */
import type { SearchResultItem } from "../../search/brave";
import { compareListings } from "../match";
import { canonicalizeUrl, registrableDomain } from "../text";
import type { MatchResult, OfferCandidate, ProductTarget } from "../types";

export type DropReason = "invalid_url" | "duplicate" | "non_merchant_host" | "not_product_page" | "accessory" | "different_product" | "variant";

export interface Dropped {
  url: string;
  reason: DropReason;
}

export interface PrefilterOutcome {
  kept: Array<{ candidate: OfferCandidate; match: MatchResult }>;
  dropped: Dropped[];
}

/** Réseaux sociaux, encyclopédies, forums, comparateurs : ce ne sont pas des vendeurs (un comparateur affiche le prix d'autres). */
const NON_MERCHANT = new Set([
  "wikipedia.org", "youtube.com", "youtu.be", "reddit.com", "facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com",
  "pinterest.com", "pinterest.fr", "linkedin.com", "quora.com", "medium.com", "github.com", "commentcamarche.net", "forum.hardware.fr",
  "idealo.fr", "idealo.com", "ledenicheur.fr", "kelkoo.fr", "kelkoo.com", "twenga.fr", "shopzilla.com", "pricerunner.com", "google.com", "bing.com",
]);

const EDITORIAL = /\/(blog|actualites?|news|forum|forums|avis|test|tests|comparatif|comparatifs|guide|guides|magazine|article|articles|wiki|dossiers?)(\/|$)/i;
const LISTING = /\/(search|recherche|rechercher|catalogsearch|categorie|categories|category|collections?|marques?|brand|tag|tags|s)(\/|$)/i;
const PRODUCT_LIKE = /\/(products?|produits?|p|dp|item|article-produit|fiche)(\/|$)|\.(html?|php)$|-p-\d|\/\d{5,}/i;
const SEARCH_QUERY = /^(q|query|search|recherche|k|s|keyword|keywords|text)$/i;

function pageKind(url: URL): "ok" | "non_merchant" | "not_product" {
  const domain = registrableDomain(url.hostname);
  if (NON_MERCHANT.has(domain) || NON_MERCHANT.has(url.hostname.replace(/^www\./, ""))) return "non_merchant";
  if (EDITORIAL.test(url.pathname)) return "not_product";
  for (const k of url.searchParams.keys()) if (SEARCH_QUERY.test(k)) return "not_product";
  if (LISTING.test(url.pathname) && !PRODUCT_LIKE.test(url.pathname)) return "not_product";
  return "ok";
}

export function prefilterResults(target: ProductTarget, items: SearchResultItem[], opts: { now: Date; discoveredBy?: string } = { now: new Date() }): PrefilterOutcome {
  const kept: PrefilterOutcome["kept"] = [];
  const dropped: Dropped[] = [];
  const seen = new Set<string>();
  const targetListing = { identity: { ...target.identity, condition: target.condition }, title: target.identity.name };
  for (const item of items) {
    const key = typeof item.url === "string" && item.url.length <= 2048 ? canonicalizeUrl(item.url) : null;
    if (!key) {
      dropped.push({ url: String(item.url).slice(0, 200), reason: "invalid_url" });
      continue;
    }
    if (seen.has(key)) {
      dropped.push({ url: item.url, reason: "duplicate" });
      continue;
    }
    seen.add(key);
    let parsed: URL;
    try {
      parsed = new URL(item.url);
    } catch {
      dropped.push({ url: item.url.slice(0, 200), reason: "invalid_url" });
      continue;
    }
    if (parsed.username || parsed.password) {
      dropped.push({ url: parsed.origin, reason: "invalid_url" });
      continue;
    }
    const kind = pageKind(parsed);
    if (kind !== "ok") {
      dropped.push({ url: item.url, reason: kind === "non_merchant" ? "non_merchant_host" : "not_product_page" });
      continue;
    }
    const title = (item.title ?? "").trim();
    const match = compareListings(targetListing, { identity: { name: title }, title, hintText: item.description });
    if (match.verdict === "different" && !match.inconclusive) {
      dropped.push({ url: item.url, reason: match.reasons.includes("accessory") ? "accessory" : "different_product" });
      continue;
    }
    if (match.verdict === "variant") {
      dropped.push({ url: item.url, reason: "variant" });
      continue;
    }
    kept.push({ candidate: { url: item.url, title, snippet: item.description || undefined, discoveredBy: opts.discoveredBy ?? "brave", discoveredAt: opts.now }, match });
  }
  // Les plus probables d'abord ; les titres trop vagues (« non déterminés ») en dernier.
  kept.sort((a, b) => Number(a.match.inconclusive) - Number(b.match.inconclusive) || b.match.confidence - a.match.confidence);
  return { kept, dropped };
}
