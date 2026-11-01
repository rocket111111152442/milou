/**
 * Exécution d'un contrôle de page côté serveur (worker) :
 * cache partagé des pages publiques -> robots.txt -> espacement par hôte -> HTTP sécurisé
 * -> extraction. Le navigateur automatisé n'est utilisé qu'en repli (page générée en JS),
 * via un module séparé chargé uniquement par le worker.
 */
import { createHash } from "node:crypto";
import { sql, type Database } from "@waverti/database";
import { pageObservationSchema, type PageObservation } from "@waverti/types";
import { readPageResponse, sharedCacheTtl, PAGE_CONTENT_TYPES } from "./extract/response";
import { PDF_MAX_BYTES } from "./extract/pdf";
import type { HostPoliteness } from "./net/politeness";
import { RobotsCache } from "./net/robots";
import { FetchError, safeFetch, type SafeFetchOptions } from "./net/safe-fetch";

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
  /** Aperçu uniquement : HTML reçu (pour proposer les zones sélectionnables). */
  html?: string | null;
  error?: { code: string; message: string };
  fromCache: boolean;
  durationMs: number;
}

export function pageCacheKey(t: PageTarget): string {
  return createHash("sha256").update(`adaptive-v1\n${t.url}\n${t.cssSelector ?? ""}\n${t.renderMode}`).digest("hex");
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
  let cacheTtl = 0;
  try {
    if (target.renderMode === "browser" && !deps.browser) return { error: { code: "render_required", message: "La lecture approfondie de ce site n’est pas disponible." }, fromCache: false, durationMs: Date.now() - started };
    if (target.renderMode === "browser" && deps.browser) {
      await deps.recordUsage?.({ provider: "playwright", cacheHit: false });
      observation = await renderWithBrowser(deps.browser, target);
    } else {
      await deps.recordUsage?.({ provider: "http_fetch", cacheHit: false });
      const res = await safeFetch(target.url, { ...deps.fetchOptions, allowedContentTypes: PAGE_CONTENT_TYPES, maxBytes: Math.min(deps.fetchOptions?.maxBytes ?? PDF_MAX_BYTES, PDF_MAX_BYTES), timeoutMs: deps.fetchOptions?.timeoutMs ?? 20_000 });
      const reading = readPageResponse(res, target);
      observation = reading.observation;
      if (reading.blocked) return { error: { code: "access_restricted", message: "Ce site limite les vérifications automatiques. Utilisez un flux public ou une source autorisée." }, fromCache: false, durationMs: Date.now() - started };
      cacheTtl = sharedCacheTtl(res.headers, deps.cacheTtlSeconds ?? 900);
      if (target.renderMode === "auto" && reading.needsBrowser) {
        if (!deps.browser) return { error: { code: "render_required", message: "Certaines informations ne sont pas disponibles. Cette page nécessite une lecture approfondie." }, fromCache: false, durationMs: Date.now() - started };
        await deps.recordUsage?.({ provider: "playwright", cacheHit: false });
        observation = await renderWithBrowser(deps.browser, target);
        cacheTtl = 0;
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

  if (observation.httpStatus >= 200 && observation.httpStatus < 300 && cacheTtl > 0) {
    const ttl = cacheTtl;
    await deps.db.execute(sql`
      insert into page_cache (cache_key, url_hash, observation, fetched_at, expires_at)
      values (${key}, ${createHash("sha256").update(target.url).digest("hex")}, ${JSON.stringify(observation)}::jsonb, now(), now() + make_interval(secs => ${ttl}))
      on conflict (cache_key) do update set observation = excluded.observation, fetched_at = now(), expires_at = excluded.expires_at`);
  }
  return { observation, fromCache: false, durationMs: Date.now() - started };
}

async function renderWithBrowser(browser: BrowserRenderer, target: PageTarget): Promise<PageObservation> {
  const r = await browser.render(target.url, { timeoutMs: 30_000 });
  const reading = readPageResponse({ url: target.url, finalUrl: r.finalUrl, status: r.status, body: Buffer.from(r.html), contentType: "text/html", headers: {}, truncated: false, redirects: 0, durationMs: 0, remoteAddress: null }, target);
  if (reading.blocked) throw new FetchError("unsupported_content", "Ce site limite les vérifications automatiques. Utilisez un flux public ou une source autorisée.");
  if (reading.needsBrowser) throw new FetchError("unsupported_content", "Certaines informations ne sont pas disponibles après la lecture approfondie.");
  return { ...reading.observation, method: "browser" };
}

/** Aperçu sans enregistrement (création d'une surveillance, page d'accueil de l'onboarding). */
export async function previewPage(target: PageTarget, fetchOptions: SafeFetchOptions = {}, robots = new RobotsCache(fetchOptions)): Promise<PageRunResult> {
  const started = Date.now();
  try {
    const url = new URL(target.url);
    if (!(await robots.isAllowed(url))) {
      return { error: { code: "robots_disallowed", message: "Le site interdit l'accès automatisé à cette page (robots.txt)." }, fromCache: false, durationMs: Date.now() - started };
    }
    const res = await safeFetch(target.url, { ...fetchOptions, allowedContentTypes: PAGE_CONTENT_TYPES, maxBytes: Math.min(fetchOptions.maxBytes ?? PDF_MAX_BYTES, PDF_MAX_BYTES), timeoutMs: Math.min(fetchOptions.timeoutMs ?? 15_000, 15_000) });
    const reading = readPageResponse(res, target);
    if (reading.blocked) return { error: { code: "access_restricted", message: "Ce site limite les vérifications automatiques. Utilisez un flux public ou une source autorisée." }, fromCache: false, durationMs: Date.now() - started };
    if (reading.needsBrowser) return { error: { code: "render_required", message: "Certaines informations ne sont pas disponibles. Cette page nécessite une lecture approfondie." }, fromCache: false, durationMs: Date.now() - started };
    const { observation, html } = reading;
    return { observation, html, fromCache: false, durationMs: Date.now() - started };
  } catch (err) {
    const fe = err instanceof FetchError ? err : null;
    return { error: { code: fe?.code ?? "check_failed", message: fe?.message ?? "Page inaccessible." }, fromCache: false, durationMs: Date.now() - started };
  }
}
