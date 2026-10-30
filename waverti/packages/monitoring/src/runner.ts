/**
 * Exécution d'un contrôle de page côté serveur (worker) :
 * cache partagé des pages publiques -> robots.txt -> espacement par hôte -> HTTP sécurisé
 * -> extraction. Le navigateur automatisé n'est utilisé qu'en repli (page générée en JS),
 * via un module séparé chargé uniquement par le worker.
 */
import { createHash } from "node:crypto";
import { sql, type Database } from "@waverti/database";
import { pageObservationSchema, type PageObservation } from "@waverti/types";
import { extractPage, looksJsRendered } from "./extract/html";
import type { HostPoliteness } from "./net/politeness";
import { RobotsCache } from "./net/robots";
import { decodeBody, FetchError, safeFetch, type SafeFetchOptions } from "./net/safe-fetch";

export interface PageTarget {
  url: string;
  cssSelector: string | null;
  renderMode: "auto" | "http" | "browser";
}

export interface BrowserRenderer {
  render(url: string, opts: { timeoutMs: number }): Promise<{ html: string; finalUrl: string; status: number }>;
}

export interface PageRunnerDeps {
  db: Database;
  robots: RobotsCache;
  politeness: HostPoliteness;
  fetchOptions?: SafeFetchOptions;
  browser?: BrowserRenderer | null;
  cacheTtlSeconds?: number;
  recordUsage?: (u: { provider: "http_fetch" | "playwright"; cacheHit: boolean }) => Promise<void> | void;
}

export interface PageRunResult {
  observation?: PageObservation;
  error?: { code: string; message: string };
  fromCache: boolean;
  durationMs: number;
}

const HTML_TYPES = /^(text\/html|application\/xhtml\+xml|text\/plain|application\/json|application\/ld\+json)/;

export function pageCacheKey(t: PageTarget): string {
  return createHash("sha256").update(`${t.url}\n${t.cssSelector ?? ""}\n${t.renderMode}`).digest("hex");
}

export async function runPageCheck(deps: PageRunnerDeps, target: PageTarget): Promise<PageRunResult> {
  const started = Date.now();
  const key = pageCacheKey(target);
  // Mutualisation : une même page publique (même sélecteur) n'est pas retéléchargée pour chaque utilisateur.
  const cached = await deps.db.execute<{ observation: unknown }>(sql`
    update page_cache set hit_count = hit_count + 1 where cache_key = ${key} and expires_at > now() returning observation`);
  if (cached[0]) {
    const parsed = pageObservationSchema.safeParse(cached[0].observation);
    if (parsed.success) {
      await deps.recordUsage?.({ provider: "http_fetch", cacheHit: true });
      return { observation: parsed.data, fromCache: true, durationMs: Date.now() - started };
    }
  }

  const url = new URL(target.url);
  if (!(await deps.robots.isAllowed(url))) {
    return { error: { code: "robots_disallowed", message: "Le site interdit l'accès automatisé à cette page (robots.txt)." }, fromCache: false, durationMs: Date.now() - started };
  }
  if (!(await deps.politeness.acquire(url.hostname))) {
    return { error: { code: "host_busy", message: "Trop de contrôles en cours vers ce site, nouvel essai plus tard." }, fromCache: false, durationMs: Date.now() - started };
  }

  let observation: PageObservation;
  try {
    if (target.renderMode === "browser" && deps.browser) {
      observation = await renderWithBrowser(deps.browser, target);
    } else {
      const res = await safeFetch(target.url, { ...deps.fetchOptions, allowedContentTypes: HTML_TYPES, maxBytes: 2 * 1024 * 1024, timeoutMs: 20_000 });
      await deps.recordUsage?.({ provider: "http_fetch", cacheHit: false });
      const html = decodeBody(res.body, res.contentType);
      observation = extractPage({ html, url: target.url, finalUrl: res.finalUrl, httpStatus: res.status, cssSelector: target.cssSelector, method: "http" });
      if (target.renderMode === "auto" && deps.browser && res.status < 400 && looksJsRendered(html, observation)) {
        observation = await renderWithBrowser(deps.browser, target);
        await deps.recordUsage?.({ provider: "playwright", cacheHit: false });
      }
    }
  } catch (err) {
    const fe = err instanceof FetchError ? err : null;
    return {
      error: { code: fe?.code ?? "check_failed", message: fe?.message ?? "Le contrôle a échoué." },
      fromCache: false,
      durationMs: Date.now() - started,
    };
  }

  if (observation.httpStatus < 400) {
    const ttl = deps.cacheTtlSeconds ?? 900;
    await deps.db.execute(sql`
      insert into page_cache (cache_key, url_hash, observation, fetched_at, expires_at)
      values (${key}, ${createHash("sha256").update(target.url).digest("hex")}, ${JSON.stringify(observation)}::jsonb, now(), now() + make_interval(secs => ${ttl}))
      on conflict (cache_key) do update set observation = excluded.observation, fetched_at = now(), expires_at = excluded.expires_at`);
  }
  return { observation, fromCache: false, durationMs: Date.now() - started };
}

async function renderWithBrowser(browser: BrowserRenderer, target: PageTarget): Promise<PageObservation> {
  const r = await browser.render(target.url, { timeoutMs: 30_000 });
  return extractPage({ html: r.html, url: target.url, finalUrl: r.finalUrl, httpStatus: r.status, cssSelector: target.cssSelector, method: "browser" });
}

/** Aperçu sans enregistrement (création d'une surveillance, page d'accueil de l'onboarding). */
export async function previewPage(target: PageTarget, fetchOptions: SafeFetchOptions = {}, robots = new RobotsCache(fetchOptions)): Promise<PageRunResult> {
  const started = Date.now();
  try {
    const url = new URL(target.url);
    if (!(await robots.isAllowed(url))) {
      return { error: { code: "robots_disallowed", message: "Le site interdit l'accès automatisé à cette page (robots.txt)." }, fromCache: false, durationMs: Date.now() - started };
    }
    const res = await safeFetch(target.url, { ...fetchOptions, allowedContentTypes: HTML_TYPES, maxBytes: 2 * 1024 * 1024, timeoutMs: 15_000 });
    const html = decodeBody(res.body, res.contentType);
    const observation = extractPage({ html, url: target.url, finalUrl: res.finalUrl, httpStatus: res.status, cssSelector: target.cssSelector, method: "http" });
    return { observation, fromCache: false, durationMs: Date.now() - started };
  } catch (err) {
    const fe = err instanceof FetchError ? err : null;
    return { error: { code: fe?.code ?? "check_failed", message: fe?.message ?? "Page inaccessible." }, fromCache: false, durationMs: Date.now() - started };
  }
}
