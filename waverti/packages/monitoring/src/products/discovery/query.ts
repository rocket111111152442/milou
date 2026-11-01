/**
 * Construction des requêtes Brave à partir de l'identité du produit : précises d'abord (code-barres, référence),
 * large ensuite. Seuls les opérateurs documentés par Brave sont utilisés : guillemets (expression exacte) et « -terme »
 * (exclusion). Une seconde requête n'est lancée par la source que si la première ne suffit pas (économie d'appels).
 */
import { normalizeGtin, normalizeMpn } from "../text";
import type { ProductTarget } from "../types";

export const MAX_QUERY_CHARS = 380;
export const MAX_QUERY_WORDS = 45;

const ACCESSORY_EXCLUSIONS = ["coque", "étui", "housse", "protection", "film"];

const clean = (s: string) =>
  s
    .replace(/[\u0000-\u001f\u007f"“”]/g, " ")
    .replace(/[\\<>{}[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** GTIN tel que saisi (13 chiffres pour un EAN, 12 pour un UPC…) : c'est la forme affichée par les boutiques. Null si invalide. */
export function gtinForQuery(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[\s-]/g, "");
  return normalizeGtin(digits) ? digits : null;
}

function conditionWord(c: ProductTarget["condition"]): string {
  return c === "new" ? "neuf" : c === "refurbished" ? "reconditionné" : "occasion";
}

function trimToLimits(q: string): string {
  const words = q.split(" ").slice(0, MAX_QUERY_WORDS);
  let out = words.join(" ");
  while (out.length > MAX_QUERY_CHARS && words.length > 1) {
    words.pop();
    out = words.join(" ");
  }
  return out.slice(0, MAX_QUERY_CHARS);
}

/**
 * Requêtes ordonnées, sans doublon, au plus `maxQueries`. Liste vide si le produit n'a aucun nom exploitable
 * (aucun appel inutile).
 */
export function buildProductQueries(target: ProductTarget, opts: { maxQueries?: number } = {}): string[] {
  const max = Math.max(1, Math.min(3, opts.maxQueries ?? 2));
  const id = target.identity;
  const brand = clean(id.brand ?? "");
  const name = clean(id.name ?? "");
  const nameNoBrand = brand && name.toLowerCase().startsWith(brand.toLowerCase()) ? name.slice(brand.length).trim() : name;
  const gtin = gtinForQuery(id.gtin);
  const mpn = normalizeMpn(id.mpn) ? clean(id.mpn!) : null;
  if (!name && !gtin && !mpn) return [];

  const isAccessory = /\b(coque|etui|étui|housse|film|protection|chargeur|cable|câble)\b/i.test(name);
  const excl = isAccessory ? "" : ACCESSORY_EXCLUSIONS.map((w) => `-${w}`).join(" ");
  const cond = conditionWord(target.condition);
  const nameQuery = [brand, nameNoBrand, cond].filter(Boolean).join(" ");

  const candidates: string[] = [];
  if (gtin) candidates.push([`"${gtin}"`, brand, excl].filter(Boolean).join(" "));
  if (mpn) candidates.push([`"${mpn}"`, brand, cond, excl].filter(Boolean).join(" "));
  if (nameQuery.trim()) candidates.push([nameQuery, excl].filter(Boolean).join(" "));

  const out: string[] = [];
  for (const c of candidates) {
    const q = trimToLimits(c);
    if (q && !out.includes(q)) out.push(q);
    if (out.length >= max) break;
  }
  return out;
}
