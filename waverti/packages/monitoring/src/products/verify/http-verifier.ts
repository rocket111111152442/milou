/**
 * Vérificateur HTTP réel : implémente `OfferVerifier` en ouvrant la fiche publique d'une offre.
 *
 * Sécurité et coûts (tout est borné et configurable) :
 *  - récupération par `safeFetch` : schéma http(s), ports, DNS contrôlé à la connexion (anti-rebinding), adresses
 *    privées refusées, redirections revalidées une à une, délais, taille maximale après décompression ;
 *  - robots.txt respecté, espacement minimal par site, aucune protection contournée (CAPTCHA, anti-robot : « blocked ») ;
 *  - concurrence globale limitée, requêtes simultanées identiques fusionnées, cache à durée limitée (l'heure de
 *    contrôle d'origine est conservée : une réponse en cache vieillit honnêtement).
 */
import { createHash } from "node:crypto";
import { FetchError, HostPoliteness, InvalidTargetError, RobotsCache, decodeBody, parseTargetUrl, safeFetch, type SafeFetchOptions } from "../../net";
import type { OfferVerifier } from "../pipeline";
import { canonicalizeUrl, registrableDomain } from "../text";
import type { OfferCandidate, OfferProvenance, VerificationFailure, VerificationFailureReason, VerificationOutcome, VerifiedOffer } from "../types";
import { extractOfferFromHtml } from "./extract";

/** Seules options de `safeFetch` modifiables de l'extérieur : jamais les protections elles-mêmes (tests uniquement). */
export type VerifierNetworkOptions = Pick<SafeFetchOptions, "allowLoopback" | "allowAnyPort" | "allowLocalhostName" | "resolver">;

export interface CachedOutcome {
  outcome: VerificationOutcome;
  expiresAt: number;
}

/** Cache d'issues de vérification. L'implémentation mémoire est locale au processus ; une version partagée peut suivre. */
export interface OutcomeCache {
  get(key: string): CachedOutcome | undefined | Promise<CachedOutcome | undefined>;
  set(key: string, value: CachedOutcome): void | Promise<void>;
}

export class MemoryOutcomeCache implements OutcomeCache {
  private map = new Map<string, CachedOutcome>();
  constructor(private readonly maxEntries = 5000) {}
  get(key: string): CachedOutcome | undefined {
    const v = this.map.get(key);
    if (v && v.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return v;
  }
  set(key: string, value: CachedOutcome): void {
    if (this.map.size >= this.maxEntries) this.map.delete(this.map.keys().next().value!);
    this.map.set(key, value);
  }
}

export class Semaphore {
  private active = 0;
  private waiters: Array<() => void> = [];
  constructor(private readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((r) => this.waiters.push(r));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiters.shift()?.();
    }
  }
}

export interface HttpVerifierOptions {
  /** Réglages réseau pour les tests locaux uniquement. */
  network?: VerifierNetworkOptions;
  timeoutMs?: number;
  /** Taille maximale du HTML lu (après décompression). */
  maxBytes?: number;
  maxRedirects?: number;
  /** Requêtes de vérification simultanées au plus (tous sites confondus). */
  maxConcurrent?: number;
  /** Espacement minimal entre deux requêtes vers un même site. */
  perHostMinGapMs?: number;
  maxHostWaitMs?: number;
  respectRobots?: boolean;
  /** Durée de validité d'une offre vérifiée en cache (0 = pas de cache). */
  cacheTtlMs?: number;
  /** Durée de mémorisation d'un échec (évite de marteler une fiche bloquée). */
  failureTtlMs?: number;
  cache?: OutcomeCache;
  /** Pays de livraison visé (frais lus seulement pour ce pays). */
  country?: string;
  now?: () => Date;
}

const MARKETPLACES = new Set(["amazon.fr", "amazon.com", "amazon.de", "cdiscount.com", "ebay.fr", "ebay.com", "rakuten.com", "fnac.com"]);

const HTTP_FAILURES: Record<number, { reason: VerificationFailureReason; transient: boolean }> = {
  401: { reason: "blocked", transient: true },
  403: { reason: "blocked", transient: true },
  429: { reason: "blocked", transient: true },
  451: { reason: "blocked", transient: false },
  404: { reason: "not_found", transient: false },
  410: { reason: "not_found", transient: false },
};

const FETCH_ERRORS: Record<FetchError["code"], { reason: VerificationFailureReason; transient: boolean }> = {
  timeout: { reason: "timeout", transient: true },
  too_many_redirects: { reason: "network_error", transient: false },
  too_large: { reason: "too_large", transient: false },
  unsupported_content: { reason: "unsupported_content", transient: false },
  network_error: { reason: "network_error", transient: true },
  blocked_address: { reason: "unsafe_url", transient: false },
  invalid_url: { reason: "unsafe_url", transient: false },
  blocked_port: { reason: "unsafe_url", transient: false },
  blocked_host: { reason: "unsafe_url", transient: false },
  unsupported_protocol: { reason: "unsafe_url", transient: false },
  credentials_in_url: { reason: "unsafe_url", transient: false },
  dns_error: { reason: "network_error", transient: true },
};

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export class HttpOfferVerifier implements OfferVerifier {
  readonly stats = { fetches: 0, cacheHits: 0, mergedRequests: 0, robotsBlocked: 0 };
  private readonly limiter: Semaphore;
  private readonly polite: HostPoliteness;
  private readonly robots: RobotsCache | null;
  private readonly cache: OutcomeCache | null;
  private readonly inflight = new Map<string, Promise<VerificationOutcome>>();
  private readonly o: Required<Pick<HttpVerifierOptions, "timeoutMs" | "maxBytes" | "maxRedirects" | "cacheTtlMs" | "failureTtlMs" | "country">> & HttpVerifierOptions;

  constructor(opts: HttpVerifierOptions = {}) {
    this.o = { timeoutMs: 12_000, maxBytes: 1_500_000, maxRedirects: 4, cacheTtlMs: 30 * 60_000, failureTtlMs: 2 * 60_000, country: "FR", ...opts };
    this.limiter = new Semaphore(Math.max(1, opts.maxConcurrent ?? 4));
    this.polite = new HostPoliteness(opts.perHostMinGapMs ?? 2000, opts.maxHostWaitMs ?? 15_000);
    this.robots = opts.respectRobots === false ? null : new RobotsCache({ ...opts.network });
    this.cache = this.o.cacheTtlMs > 0 ? (opts.cache ?? new MemoryOutcomeCache()) : null;
  }

  private now(): Date {
    return (this.o.now ?? (() => new Date()))();
  }

  private fail(url: string, reason: VerificationFailureReason, transient: boolean, detail?: string, httpStatus?: number): VerificationFailure {
    return { ok: false, url, reason, transient, checkedAt: this.now(), detail, httpStatus };
  }

  async verify(candidate: OfferCandidate): Promise<VerificationOutcome> {
    const key = canonicalizeUrl(candidate.url);
    if (!key) return this.fail(candidate.url, "unsafe_url", false, "adresse invalide");
    const cached = this.cache ? await this.cache.get(key) : undefined;
    if (cached && cached.expiresAt > Date.now()) {
      this.stats.cacheHits++;
      const out = cached.outcome;
      return out.ok ? { ok: true, offer: { ...out.offer, provenance: out.offer.provenance ? { ...out.offer.provenance, fromCache: true } : undefined } } : out;
    }
    const running = this.inflight.get(key);
    if (running) {
      this.stats.mergedRequests++;
      return running;
    }
    const p = this.run(candidate.url, key)
      .then(async (outcome) => {
        if (this.cache) {
          const ttl = outcome.ok ? this.o.cacheTtlMs : this.o.failureTtlMs;
          if (ttl > 0) await this.cache.set(key, { outcome, expiresAt: Date.now() + ttl });
        }
        return outcome;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private async run(url: string, key: string): Promise<VerificationOutcome> {
    let target: URL;
    try {
      target = parseTargetUrl(url, { ...this.o.network });
    } catch (err) {
      return this.fail(url, "unsafe_url", false, err instanceof InvalidTargetError ? err.message : "adresse refusée");
    }
    if (!(await this.polite.acquire(target.hostname))) return this.fail(url, "rate_limited", true, "espacement par site non respectable dans le délai");
    return this.limiter.run(async () => {
      if (this.robots && !(await this.robots.isAllowed(target))) {
        this.stats.robotsBlocked++;
        return this.fail(url, "robots_disallowed", true, "robots.txt interdit ou inaccessible : aucun contournement");
      }
      this.stats.fetches++;
      let res;
      try {
        res = await safeFetch(target.toString(), {
          ...this.o.network,
          timeoutMs: this.o.timeoutMs,
          maxBytes: this.o.maxBytes,
          maxRedirects: this.o.maxRedirects,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          allowedContentTypes: /html|xhtml/,
        });
      } catch (err) {
        const code = err instanceof FetchError ? err.code : "network_error";
        const m = FETCH_ERRORS[code];
        return this.fail(url, m.reason, m.transient, err instanceof FetchError ? err.message : "erreur réseau");
      }
      const known = HTTP_FAILURES[res.status];
      if (known) return this.fail(url, known.reason, known.transient, `HTTP ${res.status}`, res.status);
      if (res.status >= 500) return this.fail(url, "server_error", true, `HTTP ${res.status}`, res.status);
      if (res.status < 200 || res.status >= 300) return this.fail(url, "not_found", false, `HTTP ${res.status}`, res.status);

      const html = decodeBody(res.body, res.contentType);
      const extracted = extractOfferFromHtml(html, res.finalUrl, { country: this.o.country });
      if (!extracted.ok) {
        const tooLarge = res.truncated && ["not_a_product_page", "price_not_found", "parse_failed"].includes(extracted.reason);
        const reason: VerificationFailureReason = tooLarge ? "too_large" : extracted.reason;
        return { ...this.fail(url, reason, reason === "blocked" || reason === "timeout", extracted.detail, res.status) };
      }
      const d = extracted.data;
      const finalHost = new URL(res.finalUrl).hostname;
      const domain = registrableDomain(finalHost);
      const warnings = [...d.warnings];
      if (registrableDomain(target.hostname) !== domain) warnings.push("redirected_cross_domain");
      if (res.truncated) warnings.push("body_truncated");
      const fetchedAt = this.now();
      const fingerprint = createHash("sha256")
        .update(JSON.stringify([d.name, d.brand ?? null, d.mpn ?? null, d.gtin ?? null, d.priceCents, d.currency, d.availability, d.shipping, d.condition]))
        .digest("hex");
      const provenance: OfferProvenance = {
        fetchedUrl: target.toString(),
        finalUrl: res.finalUrl,
        httpStatus: res.status,
        fetchedAt,
        priceSource: d.priceSource,
        fields: { ...d.fields },
        warnings,
        dataFingerprint: fingerprint,
        fromCache: false,
        truncated: res.truncated,
      };
      const marketplace = MARKETPLACES.has(domain) && d.sellerName ? d.sellerName : undefined;
      const offer: VerifiedOffer = {
        url,
        canonicalUrl: canonicalizeUrl(res.finalUrl) ?? key,
        seller: { key: marketplace ? `${domain}:${slug(marketplace)}` : domain, name: marketplace ?? finalHost, ...(marketplace ? { marketplaceSeller: marketplace } : {}) },
        product: { name: d.name, brand: d.brand, model: d.model, mpn: d.mpn, gtin: d.gtin, condition: d.condition },
        title: d.title,
        priceCents: d.priceCents,
        currency: d.currency,
        availability: d.availability,
        shipping: d.shipping,
        checkedAt: fetchedAt,
        shipsToFrance: d.shipsToFrance,
        provenance,
      };
      return { ok: true, offer };
    });
  }
}
