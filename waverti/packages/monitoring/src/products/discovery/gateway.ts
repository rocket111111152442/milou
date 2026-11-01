/**
 * Passerelle Brave : l'UNIQUE endroit par où la découverte de produits émet un appel Brave.
 *
 *  - Plafonds : plafond mensuel global (dollars, compteur atomique) puis quota de l'abonnement, avant tout appel.
 *  - Aucun retry automatique : une tentative par requête ; un échec est remonté, jamais rejoué ici.
 *  - Requêtes identiques simultanées fusionnées (un seul appel, facturé une fois, au demandeur « chef de file »).
 *  - Cache partagé PostgreSQL (plusieurs workers) UNIQUEMENT si les droits de stockage de Brave sont confirmés
 *    (WAVERTI_BRAVE_STORAGE_RIGHTS=granted) : les conditions de Brave (§3(b)(i)) interdisent de stocker ou de mettre en
 *    cache les résultats hors stockage transitoire, sauf plan ou contrat le prévoyant. Sans cette confirmation, aucun
 *    résultat n'est écrit en base ni conservé en mémoire au-delà de la requête en cours.
 *  - Journal : chaque appel est enregistré (provider_requests) et tracé sans jamais contenir la clé API.
 */
import { createHash } from "node:crypto";
import { recordProviderRequest, sql, type Database } from "@waverti/database";
import { SearchProviderError, type SearchProvider, type SearchResponseMeta, type SearchResultItem } from "../../search/brave";
import { BudgetExceededError } from "../../search/errors";
import { reserveBraveCall, type Reservation } from "../../search/reserve";
import { loadBraveGlobalCap } from "../../search/settings";

export type StorageRights = "none" | "granted";

/** Les droits de stockage ne sont jamais présumés : seule la valeur « granted » les active. */
export function storageRightsFromEnv(env: Record<string, string | undefined> = process.env): StorageRights {
  return env.WAVERTI_BRAVE_STORAGE_RIGHTS === "granted" ? "granted" : "none";
}

export const CACHE_PROVIDER = "brave_products";
export const DEFAULT_CACHE_TTL_SECONDS = 6 * 3600;

export interface BraveRequester {
  userId: string;
  /** Compteur de la période d'abonnement et plafond de la formule (voir billing/search-quota). */
  period: string;
  periodLimit: number;
  dailyLimit: number | null;
}

export interface BraveLogEvent {
  event: "brave_request" | "brave_cache_hit" | "brave_shared" | "brave_refused";
  outcome: "success" | "failure" | "rate_limited" | "timeout" | "budget_exceeded";
  status: number | null;
  latencyMs: number | null;
  /** Empreinte courte de la requête (jamais son texte) et de l'utilisateur. */
  query: string;
  user: string;
  scope?: string;
  quotaRemaining?: number | null;
}

export interface GatewayResult {
  items: SearchResultItem[];
  fromCache: boolean;
  /** Appels Brave réellement émis par cet appel de recherche (0 si cache ou requête fusionnée). */
  apiCalls: number;
  shared: boolean;
}

export interface GatewayOptions {
  db: Database;
  provider: SearchProvider | null;
  storageRights?: StorageRights;
  cacheTtlSeconds?: number;
  resultsPerQuery?: number;
  lockTimeoutMs?: number;
  logger?: (e: BraveLogEvent) => void;
  now?: () => Date;
}

type LeaderOutcome = { ok: true; value: Omit<GatewayResult, "shared"> } | { ok: false; error: unknown };

const short = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);

export function productQueryHash(query: string): string {
  const norm = query.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`${CACHE_PROVIDER}|fr|${norm}`).digest("hex");
}

function isValidItems(v: unknown): v is SearchResultItem[] {
  return Array.isArray(v) && v.every((x) => x && typeof x === "object" && typeof (x as SearchResultItem).url === "string" && typeof (x as SearchResultItem).title === "string");
}

export class BraveSearchGateway {
  readonly stats = { apiCalls: 0, cacheHits: 0, mergedRequests: 0, refused: 0, failures: 0 };
  private readonly inflight = new Map<string, Promise<LeaderOutcome>>();
  private readonly rights: StorageRights;
  private readonly ttl: number;

  constructor(private readonly o: GatewayOptions) {
    this.rights = o.storageRights ?? "none";
    this.ttl = Math.max(60, Math.min(86_400, o.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS));
  }

  private log(e: BraveLogEvent): void {
    (this.o.logger ?? ((x: BraveLogEvent) => console.info(JSON.stringify({ msg: "brave", ...x }))))(e);
  }

  get storageRights(): StorageRights {
    return this.rights;
  }

  async search(query: string, requester: BraveRequester, depth = 0): Promise<GatewayResult> {
    const hash = productQueryHash(query);
    const running = this.inflight.get(hash);
    if (running) {
      this.stats.mergedRequests++;
      const out = await running;
      if (out.ok) {
        this.log({ event: "brave_shared", outcome: "success", status: null, latencyMs: null, query: short(hash), user: short(requester.userId) });
        return { ...out.value, apiCalls: 0, fromCache: out.value.fromCache, shared: true };
      }
      // Le quota personnel du chef de file ne prive pas les autres demandeurs : ils tentent avec le leur (une seule fois).
      if (depth === 0 && out.error instanceof BudgetExceededError && out.error.scope !== "global") return this.search(query, requester, 1);
      throw out.error;
    }
    const p: Promise<LeaderOutcome> = this.lead(hash, query, requester).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    this.inflight.set(hash, p);
    try {
      const out = await p;
      if (!out.ok) throw out.error;
      return { ...out.value, shared: false };
    } finally {
      this.inflight.delete(hash);
    }
  }

  private async readCache(db: Pick<Database, "execute">, hash: string): Promise<SearchResultItem[] | null> {
    const rows = await db.execute<{ results: unknown }>(sql`
      update search_cache set hit_count = hit_count + 1
      where query_hash = ${hash} and provider = ${CACHE_PROVIDER} and expires_at > now() returning results`);
    const v = rows[0]?.results;
    return isValidItems(v) ? v : null;
  }

  private async lead(hash: string, query: string, requester: BraveRequester): Promise<Omit<GatewayResult, "shared">> {
    if (this.rights !== "granted") return this.callBrave(hash, query, requester);

    const hit = await this.readCache(this.o.db, hash);
    if (hit) return this.cacheHit(hash, requester, hit);

    // Cache partagé : un seul worker interroge Brave pour une même requête ; les autres attendent puis lisent le cache.
    const lockMs = this.o.lockTimeoutMs ?? 15_000;
    return this.o.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('lock_timeout', ${`${lockMs}ms`}, true)`);
      try {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${hash}, 73))`);
      } catch (err) {
        if ((err as { code?: string }).code === "55P03") throw new SearchProviderError("Recherche déjà en cours sur un autre worker : réessayer plus tard", true);
        throw err;
      }
      const again = await this.readCache(tx, hash);
      if (again) return this.cacheHit(hash, requester, again);
      const result = await this.callBrave(hash, query, requester);
      await tx.execute(sql`
        insert into search_cache (query_hash, provider, query, results, fetched_at, expires_at)
        values (${hash}, ${CACHE_PROVIDER}, ${query.slice(0, 400)}, ${JSON.stringify(result.items)}::jsonb, now(), now() + make_interval(secs => ${this.ttl}))
        on conflict (query_hash) do update set results = excluded.results, fetched_at = now(), expires_at = excluded.expires_at, provider = excluded.provider`);
      return result;
    });
  }

  private cacheHit(hash: string, requester: BraveRequester, items: SearchResultItem[]): Omit<GatewayResult, "shared"> {
    this.stats.cacheHits++;
    this.log({ event: "brave_cache_hit", outcome: "success", status: null, latencyMs: null, query: short(hash), user: short(requester.userId) });
    return { items, fromCache: true, apiCalls: 0 };
  }

  private async callBrave(hash: string, query: string, requester: BraveRequester): Promise<Omit<GatewayResult, "shared">> {
    const { db, provider } = this.o;
    if (!provider) throw new SearchProviderError("Aucun moteur de recherche configuré (BRAVE_SEARCH_API_KEY absente)", false);
    const now = (this.o.now ?? (() => new Date()))();
    const cap = await loadBraveGlobalCap(db);
    let reservation: Reservation;
    try {
      reservation = await reserveBraveCall({
        db,
        userId: requester.userId,
        period: requester.period,
        periodLimit: requester.periodLimit,
        dailyLimit: requester.dailyLimit,
        globalMonthlyRequests: cap.maxRequests,
        now,
      });
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        this.stats.refused++;
        this.log({ event: "brave_refused", outcome: "budget_exceeded", status: null, latencyMs: null, query: short(hash), user: short(requester.userId), scope: err.scope });
      }
      throw err;
    }
    let meta: SearchResponseMeta | null = null;
    const started = Date.now();
    const track = { provider: "brave_search" as const, userId: requester.userId, attempt: 1 };
    this.stats.apiCalls++;
    try {
      const items = await provider.search(query, { count: this.o.resultsPerQuery ?? 10, onResponse: (m) => (meta = m) });
      const m = meta as SearchResponseMeta | null;
      await recordProviderRequest(db, { ...track, outcome: "success", httpStatus: m?.status ?? 200, latencyMs: Date.now() - started, estimatedCostMicros: cap.costMicros, providerQuotaRemaining: m?.quotaRemaining ?? null, providerQuotaLimit: m?.quotaLimit ?? null });
      this.log({ event: "brave_request", outcome: "success", status: m?.status ?? 200, latencyMs: Date.now() - started, query: short(hash), user: short(requester.userId), quotaRemaining: m?.quotaRemaining ?? null });
      return { items, fromCache: false, apiCalls: 1 };
    } catch (err) {
      this.stats.failures++;
      const m = meta as SearchResponseMeta | null;
      const status = m?.status ?? (err instanceof SearchProviderError ? (err.status ?? null) : null);
      const name = (err as Error).name;
      const timedOut = name === "TimeoutError" || name === "AbortError";
      const outcome = status === 429 ? "rate_limited" : timedOut ? "timeout" : "failure";
      // Refus certain (429, erreur client) = non facturé : tout est restitué. Timeout, 5xx, réponse illisible : peut-être
      // facturé → la dépense globale est conservée, seul le quota de l'utilisateur est rendu.
      const certainlyNotBilled = status === 429 || (status !== null && status >= 400 && status < 500);
      if (certainlyNotBilled) await reservation.release();
      else await reservation.releaseUserOnly();
      await recordProviderRequest(db, {
        ...track,
        outcome,
        httpStatus: status,
        latencyMs: Date.now() - started,
        estimatedCostMicros: certainlyNotBilled ? 0 : cap.costMicros,
        providerQuotaRemaining: m?.quotaRemaining ?? null,
        providerQuotaLimit: m?.quotaLimit ?? null,
        error: (err as Error).message,
      });
      this.log({ event: "brave_request", outcome, status, latencyMs: Date.now() - started, query: short(hash), user: short(requester.userId) });
      throw err;
    }
  }
}

/** Supprime les résultats mis en cache dont la durée est écoulée (hygiène du stockage ; à appeler périodiquement). */
export async function purgeExpiredBraveCache(db: Database): Promise<number> {
  const rows = await db.execute<{ n: string }>(sql`with d as (delete from search_cache where provider = ${CACHE_PROVIDER} and expires_at <= now() returning 1) select count(*)::text as n from d`);
  return Number(rows[0]?.n ?? 0);
}

/** Détruit TOUS les résultats Brave conservés (fin de contrat, retrait des droits de stockage : conditions de Brave §13(c)). */
export async function purgeAllBraveResults(db: Database): Promise<number> {
  const rows = await db.execute<{ n: string }>(sql`with d as (delete from search_cache where provider in (${CACHE_PROVIDER}, 'brave') returning 1) select count(*)::text as n from d`);
  return Number(rows[0]?.n ?? 0);
}

