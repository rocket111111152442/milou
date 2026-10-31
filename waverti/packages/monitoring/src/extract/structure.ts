/**
 * Extraction structurée d'une page (compatible navigateur : utilisée aussi par l'application desktop).
 * Produit des données BORNÉES (nombre et taille) pour les règles : liens, rubriques, documents, éléments de liste
 * ou de catalogue, dates, tableaux, formulaires, prix barré, empreinte du contenu « nettoyé ».
 *
 * Réduction des faux positifs : les zones volatiles ou annexes (navigation, pied de page, publicités, bandeaux de
 * cookies, recommandations, carrousels) sont ignorées ; les horloges, compteurs et identifiants de session sont
 * retirés avant le calcul de l'empreinte.
 */
import { sha256 as sha256Bytes } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as cheerio from "cheerio/slim";
import type { LinkRef } from "@waverti/types";
import { findPricesInText, parsePrice } from "./price";
import { collapseWhitespace, normalizeForMatch, stripVolatile } from "./text";

export const NOISE_SELECTOR = [
  "nav",
  "footer",
  "aside",
  "body > header",
  "header[role=banner]",
  "[role=navigation]",
  "[role=contentinfo]",
  "[aria-hidden=true]",
  "[hidden]",
  "dialog",
  '[class*="cookie" i]',
  '[id*="cookie" i]',
  '[class*="consent" i]',
  '[class*="advert" i]',
  '[id*="advert" i]',
  '[class*="sponsor" i]',
  '[class*="recommend" i]',
  '[class*="related" i]',
  '[class*="upsell" i]',
  '[class*="cross-sell" i]',
  '[class*="carousel" i]',
  '[class*="newsletter" i]',
  '[class*="breadcrumb" i]',
  ".ad",
  ".ads",
  '[id^="ad-" i]',
  '[class^="ad-" i]',
].join(",");

const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|csv|rtf|epub)(?:$|[?#])/i;
const TRACKING = /^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|_ga|igshid|yclid)$/i;

const sha = (s: string) => bytesToHex(sha256Bytes(utf8ToBytes(s)));
export const shortHash = (s: string) => sha(s).slice(0, 16);

export function absoluteUrl(href: string | undefined, base: string): string | null {
  if (!href || href.length > 2000) return null;
  const h = href.trim();
  if (!h || h.startsWith("#") || /^(javascript|mailto|tel|data|blob):/i.test(h)) return null;
  try {
    const u = new URL(h, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    const out = u.toString();
    return out.length <= 500 ? out : null;
  } catch {
    return null;
  }
}

const label = (s: string, max = 160) => collapseWhitespace(s).replace(/\n/g, " ").slice(0, max);

export interface JsonLdListItem {
  u: string;
  t: string;
  p: number | null;
}

/** Éléments de liste déclarés en JSON-LD (ItemList, Product, JobPosting, Event) — lus avant le retrait des scripts. */
export function jsonLdItems($: cheerio.CheerioAPI, base: string): JsonLdListItem[] {
  const out: JsonLdListItem[] = [];
  const seen = new Set<string>();
  const push = (url: unknown, name: unknown, price: unknown) => {
    const u = absoluteUrl(typeof url === "string" ? url : undefined, base);
    const t = typeof name === "string" ? label(name, 140) : "";
    if (!u || !t || seen.has(u)) return;
    seen.add(u);
    out.push({ u, t, p: parsePrice(price) });
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    if (out.length >= 60) return;
    const raw = $(el).text();
    if (!raw || raw.length > 500_000) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const visit = (node: unknown, depth: number) => {
      if (depth > 6 || !node || out.length >= 60) return;
      if (Array.isArray(node)) return node.forEach((n) => visit(n, depth + 1));
      if (typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      const type = String(Array.isArray(o["@type"]) ? o["@type"][0] : (o["@type"] ?? "")).toLowerCase();
      if (type === "itemlist" && Array.isArray(o.itemListElement)) {
        for (const li of o.itemListElement as Array<Record<string, unknown>>) {
          const item = (li?.item as Record<string, unknown>) ?? li;
          const offers = item?.offers as Record<string, unknown> | undefined;
          push(item?.url ?? li?.url, item?.name ?? li?.name, offers?.price);
        }
      } else if (depth > 0 && (type === "product" || type === "jobposting" || type === "event")) {
        const offers = o.offers as Record<string, unknown> | undefined;
        push(o.url, o.name ?? o.title, offers?.price);
      }
      for (const k of ["@graph", "mainEntity", "itemListElement"]) if (o[k] && type !== "itemlist") visit(o[k], depth + 1);
    };
    visit(data, 0);
  });
  return out;
}

/** Prix barré déclaré en JSON-LD (priceSpecification de type ListPrice / StrikethroughPrice). */
export function jsonLdRegularPrice($: cheerio.CheerioAPI): number | null {
  let found: number | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (found !== null) return;
    const raw = $(el).text();
    if (!raw || raw.length > 500_000 || !/ListPrice|StrikethroughPrice/i.test(raw)) return;
    try {
      const walk = (n: unknown, d: number) => {
        if (found !== null || d > 8 || !n || typeof n !== "object") return;
        if (Array.isArray(n)) return n.forEach((x) => walk(x, d + 1));
        const o = n as Record<string, unknown>;
        if (typeof o.priceType === "string" && /ListPrice|StrikethroughPrice/i.test(o.priceType)) {
          found = parsePrice(o.price);
          return;
        }
        Object.values(o).forEach((v) => walk(v, d + 1));
      };
      walk(JSON.parse(raw), 0);
    } catch {
      /* JSON invalide : ignoré */
    }
  });
  return found;
}

const STRIKE_SELECTOR =
  'del, s, strike, [class*="old-price" i], [class*="price-old" i], [class*="was-price" i], [class*="regular-price" i], [class*="compare-at" i], [class*="price--compare" i], [class*="strike" i], [class*="barre" i], [class*="crossed" i]';

/** Prix barré visible (balise <del>/<s> ou classe explicite), accepté seulement s'il est cohérent avec le prix actuel. */
export function strikethroughPrice($: cheerio.CheerioAPI, scope: cheerio.Cheerio<never> | null, current: number | null): number | null {
  if (current === null) return null;
  const root = scope ?? $("body");
  let found: number | null = null;
  root.find(STRIKE_SELECTOR).each((_, el) => {
    if (found !== null) return;
    const txt = $(el).text();
    if (txt.length > 60 || !/\d/.test(txt)) return;
    const v = findPricesInText(txt, 1)[0]?.value ?? parsePrice(txt);
    if (v !== null && v > current && v < current * 10) found = v;
  });
  return found;
}

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Dates explicites (jour, mois, année) trouvées dans un texte. Les années seules ne sont pas retenues. */
export function findDates(text: string, max = 40): string[] {
  const out = new Set<string>();
  const n = normalizeForMatch(text.slice(0, 100_000));
  const add = (v: string | null) => v && out.size < max && out.add(v);
  const monthNames = Object.keys(MONTHS).join("|");
  for (const m of n.matchAll(new RegExp(String.raw`\b(\d{1,2})(?:er)?\s+(${monthNames})\s+(\d{4})\b`, "g"))) add(iso(+m[3]!, MONTHS[m[2]!]!, +m[1]!));
  for (const m of n.matchAll(new RegExp(String.raw`\b(${monthNames})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b`, "g"))) add(iso(+m[3]!, MONTHS[m[1]!]!, +m[2]!));
  for (const m of n.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) add(iso(+m[3]!, +m[2]!, +m[1]!));
  for (const m of n.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) add(iso(+m[1]!, +m[2]!, +m[3]!));
  return [...out].sort();
}

/** Empreinte du contenu sans éléments volatils (horloges, compteurs, identifiants techniques). */
export function stableContentHash(text: string): string {
  const cleaned = normalizeForMatch(stripVolatile(text))
    .replace(/\b[a-f0-9]{16,}\b/g, "")
    .replace(/\b[a-z0-9_-]{24,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return sha(cleaned.slice(0, 200_000));
}

const CARD = 'li, article, tr, [class*="card" i], [class*="product" i], [class*="item" i], [class*="tile" i], [class*="offer" i], [class*="job" i], [class*="event" i], [class*="result" i]';
const TITLE_IN_CARD = 'h1, h2, h3, h4, h5, h6, [class*="title" i], [class*="name" i], [itemprop="name"]';

function signature($: cheerio.CheerioAPI, el: cheerio.Cheerio<never>): string {
  const node = el.get(0) as { tagName?: string } | undefined;
  const cls = (el.attr("class") ?? "").split(/\s+/).filter((c) => c && !/\d{3,}|active|selected|first|last|odd|even/.test(c)).slice(0, 2).sort().join(".");
  const parent = el.parent();
  const p = parent.get(0) as { tagName?: string } | undefined;
  return `${p?.tagName ?? ""}.${(parent.attr("class") ?? "").split(/\s+/)[0] ?? ""}>${node?.tagName ?? ""}.${cls}`;
}

/** Éléments répétés (cartes produit, offres, événements) : le plus grand groupe homogène d'au moins 3 éléments. */
export function repeatedItems($: cheerio.CheerioAPI, root: cheerio.Cheerio<never>, base: string): Array<LinkRef & { p: number | null }> {
  const groups = new Map<string, Map<string, LinkRef & { p: number | null }>>();
  root.find("a[href]").each((_, a) => {
    const $a = $(a);
    const u = absoluteUrl($a.attr("href"), base);
    if (!u) return;
    const card = $a.closest(CARD) as cheerio.Cheerio<never>;
    if (!card.length) return;
    const cardText = collapseWhitespace(card.text());
    if (cardText.length < 3 || cardText.length > 1500) return;
    const sig = signature($, card);
    const g = groups.get(sig) ?? new Map();
    if (!g.has(u)) {
      const t = label(card.find(TITLE_IN_CARD).first().text() || $a.text() || $a.attr("title") || "", 140);
      if (!t) return;
      g.set(u, { u, t, p: findPricesInText(cardText, 1)[0]?.value ?? null });
    }
    groups.set(sig, g);
  });
  let best: Map<string, LinkRef & { p: number | null }> | null = null;
  for (const g of groups.values()) if (g.size >= 3 && (!best || g.size > best.size)) best = g;
  return best ? [...best.values()].slice(0, 60) : [];
}

export interface Structure {
  contentHash: string;
  headings: string[];
  links: LinkRef[];
  documents: LinkRef[];
  items: Array<LinkRef & { p: number | null }>;
  dates: string[];
  tableHashes: string[];
  forms: { count: number; signup: boolean };
}

const SIGNUP = /inscri|s'inscrire|register|sign ?up|reserv|book|billet|ticket|candidat|postuler|participer/i;

/**
 * À appeler APRÈS le calcul du texte historique (textHash) : retire les zones annexes du document.
 * `scope` : zone ciblée par le sélecteur de la surveillance, sinon le contenu principal.
 */
export function extractStructure($: cheerio.CheerioAPI, scope: cheerio.Cheerio<never> | null, base: string, ldItems: JsonLdListItem[]): Structure {
  $(NOISE_SELECTOR).remove();
  const main = $("main").first();
  const root = (scope ?? (main.length && collapseWhitespace(main.text()).length > 200 ? main : $("body").length ? $("body") : $.root())) as cheerio.Cheerio<never>;
  const text = collapseWhitespace(root.text());

  const headings: string[] = [];
  root.find("h1, h2, h3").each((_, h) => {
    const t = label($(h).text());
    if (t && !headings.includes(t) && headings.length < 40) headings.push(t);
  });

  const links: LinkRef[] = [];
  const documents: LinkRef[] = [];
  const seenL = new Set<string>();
  root.find("a[href]").each((_, a) => {
    const $a = $(a);
    const u = absoluteUrl($a.attr("href"), base);
    if (!u || seenL.has(u)) return;
    seenL.add(u);
    const t = label($a.text() || $a.attr("title") || $a.attr("aria-label") || "");
    const isDoc = DOC_EXT.test(u) || /pdf|msword|officedocument|opendocument/i.test($a.attr("type") ?? "");
    if (isDoc && documents.length < 30) documents.push({ u, t: t || decodeURIComponent(u.split("/").pop() ?? "").slice(0, 160) });
    if (links.length < 100) links.push({ u, t });
  });

  let items: Array<LinkRef & { p: number | null }> = ldItems.slice(0, 60);
  if (items.length < 2) {
    const micro: Array<LinkRef & { p: number | null }> = [];
    root.find('[itemtype*="schema.org/Product" i], [itemtype*="schema.org/JobPosting" i], [itemtype*="schema.org/Event" i]').each((_, el) => {
      const $el = $(el);
      const u = absoluteUrl($el.find("a[href]").first().attr("href") ?? $el.find('[itemprop="url"]').attr("href"), base);
      const t = label($el.find('[itemprop="name"], [itemprop="title"]').first().text(), 140);
      if (u && t && !micro.some((m) => m.u === u) && micro.length < 60) {
        const pr = $el.find('[itemprop="price"]').first();
        micro.push({ u, t, p: parsePrice(pr.attr("content") ?? pr.text()) });
      }
    });
    items = micro.length >= 2 ? micro : repeatedItems($, root, base);
  }

  const timeDates: string[] = [];
  root.find("time[datetime]").each((_, t) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec($(t).attr("datetime") ?? "");
    if (m) timeDates.push(`${m[1]}-${m[2]}-${m[3]}`);
  });
  const dates = [...new Set([...findDates(text), ...timeDates])].sort().slice(0, 40);

  const tableHashes: string[] = [];
  root.find("table").each((_, t) => {
    if (tableHashes.length < 10) tableHashes.push(shortHash(normalizeForMatch(stripVolatile($(t).text()))));
  });

  const formsEl = root.find("form");
  let signup = false;
  formsEl.each((_, f) => {
    const $f = $(f);
    if ($f.find('input[type="email"]').length || SIGNUP.test($f.find('button, input[type="submit"]').text() + " " + ($f.find('input[type="submit"]').attr("value") ?? ""))) signup = true;
  });
  if (!signup) {
    root.find('button, input[type="submit"], a[class*="btn" i], a[class*="button" i]').each((_, b) => {
      const t = ($(b).text() || $(b).attr("value") || "").slice(0, 60);
      if (/^(\s*)(s'inscrire|je m'inscris|inscription|reserver|réserver|acheter des billets|billetterie|postuler|candidater|register|sign up|book now)\b/i.test(t.trim())) signup = true;
    });
  }

  return {
    contentHash: stableContentHash(text),
    headings,
    links,
    documents,
    items,
    dates,
    tableHashes,
    forms: { count: formsEl.length, signup },
  };
}

export interface PageBlock {
  selector: string;
  label: string;
  sample: string;
  kind: "section" | "table" | "list" | "price" | "block";
}

const IDENT = /^-?[_a-zA-Z][_a-zA-Z0-9-]{0,60}$/;

/**
 * Zones sélectionnables d'une page (« sélection visuelle » sans exécuter la page) : chaque zone est proposée avec
 * un sélecteur CSS UNIQUE dans la page et un extrait de son contenu. L'utilisateur choisit la zone à surveiller.
 */
/** Chemin positionnel (au plus 4 niveaux) jusqu'à l'ancêtre identifié le plus proche, vérifié unique. */
function positionalSelector($: cheerio.CheerioAPI, el: cheerio.Cheerio<never>): string | null {
  const parts: string[] = [];
  let cur = el;
  for (let depth = 0; depth < 4 && cur.length; depth++) {
    const node = cur.get(0) as { tagName?: string } | undefined;
    if (!node?.tagName || node.tagName === "body" || node.tagName === "html") break;
    const id = cur.attr("id");
    if (id && IDENT.test(id)) {
      parts.unshift(`#${id}`);
      break;
    }
    const sameTag = cur.parent().children(node.tagName);
    parts.unshift(sameTag.length > 1 ? `${node.tagName}:nth-of-type(${sameTag.index(cur) + 1})` : node.tagName);
    cur = cur.parent() as cheerio.Cheerio<never>;
  }
  const sel = parts.join(" > ");
  try {
    return sel && $(sel).length === 1 ? sel : null;
  } catch {
    return null;
  }
}

export function listBlocks(html: string, max = 25): PageBlock[] {
  const $ = cheerio.load(html.slice(0, 2_000_000));
  // Les zones annexes ne sont PAS retirées (les positions des sélecteurs doivent correspondre à la vraie page) :
  // elles sont seulement exclues des propositions.
  const out: PageBlock[] = [];
  const used = new Set<string>();
  const consider = (el: cheerio.Cheerio<never>, kind: PageBlock["kind"]) => {
    if (out.length >= max) return;
    const node = el.get(0) as { tagName?: string } | undefined;
    if (!node?.tagName || el.closest(NOISE_SELECTOR).length) return;
    const clone = el.clone();
    clone.find("script, style, noscript, svg, template").remove();
    const text = label(clone.text(), 400);
    if (text.length < 15) return;
    let selector: string | null = null;
    const id = el.attr("id");
    if (id && IDENT.test(id) && $(`#${id}`).length === 1) selector = `#${id}`;
    if (!selector) {
      const classes = (el.attr("class") ?? "").split(/\s+/).filter((c) => IDENT.test(c) && !/^(js-|is-|has-)/.test(c)).slice(0, 2);
      if (classes.length) {
        const sel = `${node.tagName}.${classes.join(".")}`;
        try {
          if ($(sel).length === 1) selector = sel;
        } catch {
          /* sélecteur invalide */
        }
      }
    }
    if (!selector) selector = positionalSelector($, el);
    if (!selector || used.has(selector)) return;
    used.add(selector);
    const heading = label(el.find("h1, h2, h3, h4, caption, legend").first().text(), 80);
    out.push({ selector, label: heading || (kind === "table" ? "Tableau" : kind === "list" ? "Liste" : `Zone ${selector}`), sample: text.slice(0, 160), kind });
  };
  $("[itemprop=price], [class*=price i]").slice(0, 3).each((_, e) => {
    const el = $(e) as cheerio.Cheerio<never>;
    if (/\d/.test(el.text()) && el.text().length < 40) consider(el, "price");
  });
  $("table").slice(0, 5).each((_, e) => consider($(e) as cheerio.Cheerio<never>, "table"));
  $("main, section, article, [id]").each((_, e) => consider($(e) as cheerio.Cheerio<never>, "section"));
  $("div[class]").each((_, e) => {
    const el = $(e) as cheerio.Cheerio<never>;
    if (el.children("h2, h3, h4").length) consider(el, "block");
  });
  $("ul, ol").slice(0, 20).each((_, e) => {
    const el = $(e) as cheerio.Cheerio<never>;
    if (el.children("li").length >= 3) consider(el, "list");
  });
  return out;
}
