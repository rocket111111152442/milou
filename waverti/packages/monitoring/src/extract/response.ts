/** Format selection for the existing page runner. No network or script execution. */
import * as cheerio from "cheerio/slim";
import type { PageObservation } from "@waverti/types";
import { decodeBody, FetchError, type SafeFetchResult } from "../net/safe-fetch";
import { extractPage, looksJsRendered } from "./html";
import { extractPdfObservation, isPdf } from "./pdf";

export const PAGE_CONTENT_TYPES = /^(?:text\/(?:html|plain|xml)|application\/(?:xhtml\+xml|json|ld\+json|rss\+xml|atom\+xml|xml|pdf))(?:\s*;|$)/i;
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface ResponseReading {
  observation: PageObservation;
  format: "html" | "json" | "feed" | "text" | "pdf";
  html: string | null;
  needsBrowser: boolean;
  blocked: boolean;
}

export function readPageResponse(res: SafeFetchResult, target: { url: string; cssSelector: string | null }): ResponseReading {
  if (res.truncated) throw new FetchError("too_large", "Le document dépasse la taille autorisée.");
  const base = { url: target.url, finalUrl: res.finalUrl, httpStatus: res.status, responseMs: res.durationMs };
  if (isPdf(res.contentType, res.body)) {
    return { observation: extractPdfObservation({ ...base, body: res.body }), format: "pdf", html: null, needsBrowser: false, blocked: [401, 403, 429, 451].includes(res.status) };
  }
  if (res.body.length > 2 * 1024 * 1024) throw new FetchError("too_large", "Page trop volumineuse (plus de 2 Mo).");
  const raw = decodeBody(res.body, res.contentType);
  const mime = res.contentType.split(";")[0]!.trim();
  let format: ResponseReading["format"] = "html";
  let html = raw;
  if (/^application\/(ld\+)?json$/.test(mime)) {
    format = "json";
    let data: unknown;
    try { data = JSON.parse(raw); } catch { throw new FetchError("unsupported_content", "Les données publiées sont illisibles."); }
    // Stable key ordering prevents false changes when an API reorders its object keys.
    const stable = (value: unknown, depth = 0): unknown => {
      if (depth > 40) throw new FetchError("unsupported_content", "Document trop complexe.");
      if (Array.isArray(value)) return value.map((v) => stable(v, depth + 1));
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v, depth + 1)]));
      return value;
    };
    const canonical = JSON.stringify(stable(data));
    const obj = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
    const title = typeof obj.name === "string" ? obj.name : typeof obj.title === "string" ? obj.title : "";
    // Only explicit schema.org data is offered to the existing structured extractor.
    const ld = obj["@type"] || obj["@graph"] ? `<script type="application/ld+json">${canonical.replace(/</g, "\\u003c")}</script>` : "";
    html = `<html><head><title>${escape(title)}</title>${ld}</head><body><pre>${escape(canonical)}</pre></body></html>`;
  } else if (/^(?:application\/(?:rss\+xml|atom\+xml|xml)|text\/xml)$/.test(mime)) {
    format = "feed";
    // No external entities/DTDs are resolved. Reject them explicitly.
    if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new FetchError("unsupported_content", "Ce format de document n’est pas pris en charge.");
    const $ = cheerio.load(raw, { xmlMode: true });
    const rss = $("rss > channel").first();
    const atom = $("feed").first();
    if (!rss.length && !atom.length) throw new FetchError("unsupported_content", "Ce document n’est pas un flux reconnu.");
    const root = rss.length ? rss : atom;
    const entries = root.children(rss.length ? "item" : "entry").slice(0, 60);
    const parts: string[] = [];
    entries.each((_, el) => {
      const e = $(el);
      const title = e.children("title").first().text();
      const link = e.children("link").first();
      let href = "";
      try { const u = new URL(link.attr("href") ?? link.text(), res.finalUrl); if (/^https?:$/.test(u.protocol)) href = u.href; } catch { /* absent link */ }
      const description = e.children("description, summary, content").first().text();
      const date = e.children("pubDate, published, updated").first().text();
      parts.push(`<article><h2>${href ? `<a href="${escape(href)}">${escape(title)}</a>` : escape(title)}</h2><p>${escape(description)}</p><time>${escape(date)}</time></article>`);
    });
    html = `<html><head><title>${escape(root.children("title").first().text())}</title></head><body>${parts.join(" ")}</body></html>`;
  } else if (mime === "text/plain") {
    format = "text";
    html = `<html><body><pre>${escape(raw)}</pre></body></html>`;
  }
  const observation = extractPage({ ...base, html, cssSelector: format === "html" ? target.cssSelector : null, method: "http" });
  if (format !== "html") observation.contentKind = "document";
  // Generic API/text content is for change detection, not an inferred product offer.
  if (format !== "html" && observation.priceSource !== "jsonld") {
    observation.price = null; observation.currency = null; observation.priceSource = null;
  }
  if (format !== "html" && observation.availabilitySource !== "jsonld") {
    observation.availability = "unknown"; observation.availabilitySource = "none";
  }
  const blocked = [401, 403, 429, 451].includes(res.status) || (format === "html" && observation.textLength < 3000 && /(?:verify you are (?:a )?human|checking your browser|just a moment|cf-chl-|êtes-vous un robot|vérifiez que vous êtes humain)/i.test(raw));
  const useful = observation.priceSource !== null || (observation.items?.length ?? 0) > 0 || (observation.textLength >= 80 && (observation.headings?.length ?? 0) > 0);
  const needsBrowser = format === "html" && !blocked && res.status >= 200 && res.status < 300 && !useful && (looksJsRendered(raw, observation) || (observation.textLength < 100 && /<app-root\b|ng-version=|data-v-app/.test(raw)));
  return { observation, format, html: format === "html" ? raw : null, needsBrowser, blocked };
}

/** Conservative shared-cache policy. No implicit permission to retain a source. */
export function sharedCacheTtl(headers: Record<string, string | undefined>, cap: number): number {
  const cc = headers["cache-control"] ?? "";
  if (/\b(?:private|no-store|no-cache)\b/i.test(cc) || headers["set-cookie"] || headers.vary || /no-cache/i.test(headers.pragma ?? "")) return 0;
  const match = /(?:^|,)\s*s-maxage\s*=\s*"?(\d+)/i.exec(cc) ?? /(?:^|,)\s*max-age\s*=\s*"?(\d+)/i.exec(cc);
  if (!match) return 0;
  const age = Number(headers.age ?? 0);
  if (!Number.isFinite(age) || age < 0) return 0;
  return Math.max(0, Math.min(cap, Number(match[1]) - age));
}
