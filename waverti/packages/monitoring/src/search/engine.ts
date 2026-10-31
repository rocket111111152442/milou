/**
 * Moteur B — exécution d'une recherche sur Internet pour une surveillance.
 *  - Une seule requête par exécution (rotation entre les requêtes prévues) : coût maîtrisé.
 *  - Cache partagé : une requête identique (normalisée) n'est payée qu'une fois par fenêtre,
 *    quel que soit le nombre d'utilisateurs ; seuls des résultats PUBLICS sont mutualisés.
 *  - Budget : plafond mensuel global (app_settings) + plafonds mensuel/journalier par utilisateur.
 *  - Déduplication : chaque information (URL ou affirmation datée) n'est signalée qu'une fois.
 */
import { createHash } from "node:crypto";
import {
  and,
  consumeUsage,
  eq,
  monitoringSeenItems,
  recordProviderRequest,
  releaseUsage,
  sql,
  usagePeriod,
  type Database,
} from "@waverti/database";
import type { Evaluation } from "../compare/evaluate";
import type { WebFinding, WebTopicCondition, WebTopicObservation } from "@waverti/types";
import { STATUS_LABELS } from "@waverti/types";
import type { SearchProvider, SearchResponseMeta, SearchResultItem } from "./brave";
import { SearchProviderError } from "./brave";
import { classifyResult, meetsThreshold, topicStatus } from "./classify";

export const SEARCH_CACHE_TTL_SECONDS = 6 * 3600;

export class BudgetExceededError extends Error {
  constructor(
    public readonly scope: "global" | "user_month" | "user_day",
    message: string,
  ) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export interface WebTopicTask {
  id: string;
  userId: string;
  name: string;
  condition: WebTopicCondition;
  queries: string[];
  officialDomains: string[];
  runIndex: number;
}

export interface WebRunDeps {
  db: Database;
  provider: SearchProvider | null;
  planId: string;
  /** Plafond de la période de quota (proportionnel aux jours de la période facturée, cf. billing/search-quota). */
  monthlyCallLimit: number;
  dailyCallLimit: number | null;
  /** Clé de la période de quota (« bp:AAAA-MM-JJ » ou « AAAA-MM ») ; par défaut le mois civil UTC. */
  quotaPeriod?: string;
  /** Numéro de tentative du travail (> 1 : nouvelle tentative après une erreur temporaire). */
  attempt?: number;
  now?: Date;
}

export function queryHash(provider: string, query: string): string {
  const norm = query.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`${provider}|fr|${norm}`).digest("hex");
}

async function settingNumber(db: Database, key: string, fallback: number): Promise<number> {
  const r = await db.execute<{ value: unknown }>(sql`select value from app_settings where key = ${key}`);
  const v = Number(r[0]?.value);
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Réserve un appel facturable avant de l'effectuer : budget global de la plateforme (en euros), puis
 * compteurs atomiques par utilisateur (mois, et jour pendant l'essai). Renvoie la fonction qui restitue
 * la réservation si l'appel n'a finalement pas lieu.
 */
async function reserveSearch(deps: WebRunDeps, userId: string, costMicros: number): Promise<() => Promise<void>> {
  const db = deps.db;
  const now = deps.now ?? new Date();
  const budgetEur = await settingNumber(db, "budget.monthly_api_eur", 50);
  const [g] = await db.execute<{ spent: string | null }>(sql`
    select coalesce(sum(estimated_cost_micros), 0)::text as spent from api_usage
    where occurred_at >= date_trunc('month', now()) and provider = 'brave_search' and not cache_hit`);
  if (Number(g?.spent ?? 0) + costMicros > budgetEur * 1_000_000) {
    throw new BudgetExceededError("global", "Budget mensuel des recherches atteint");
  }
  const month = deps.quotaPeriod ?? usagePeriod("month", now);
  const monthOk = await consumeUsage(db, { userId, metric: "brave_search", period: month, limit: deps.monthlyCallLimit });
  if (monthOk === null) throw new BudgetExceededError("user_month", "Quota de recherches de la période atteint pour votre formule");
  const releases = [() => releaseUsage(db, { userId, metric: "brave_search", period: month })];
  if (deps.dailyCallLimit !== null) {
    const day = usagePeriod("day", now);
    const dayOk = await consumeUsage(db, { userId, metric: "brave_search", period: day, limit: deps.dailyCallLimit });
    if (dayOk === null) {
      await releases[0]!();
      throw new BudgetExceededError("user_day", "Quota journalier de recherches atteint (période d'essai)");
    }
    releases.push(() => releaseUsage(db, { userId, metric: "brave_search", period: day }));
  }
  return async () => {
    for (const r of releases) await r();
  };
}

/** Recherche avec cache partagé ; enregistre la consommation (coût estimé) dans api_usage. */
export async function cachedSearch(deps: WebRunDeps, userId: string, query: string): Promise<{ items: SearchResultItem[]; fromCache: boolean }> {
  if (!deps.provider) throw new SearchProviderError("Aucun moteur de recherche configuré (BRAVE_SEARCH_API_KEY absente)", false);
  const hash = queryHash(deps.provider.name, query);
  const hit = await deps.db.execute<{ results: SearchResultItem[] }>(sql`
    update search_cache set hit_count = hit_count + 1 where query_hash = ${hash} and expires_at > now() returning results`);
  if (hit[0]) {
    await deps.db.execute(sql`
      insert into api_usage (provider, user_id, plan_id, units, estimated_cost_micros, executed_by, cache_hit, meta)
      values ('brave_search', ${userId}, ${deps.planId}, 1, 0, 'cloud', true, ${JSON.stringify({ q: hash.slice(0, 16) })}::jsonb)`);
    return { items: hit[0].results, fromCache: true };
  }
  const cost = await settingNumber(deps.db, "cost.brave_search_call_micros", 5000);
  const release = await reserveSearch(deps, userId, cost);
  let items: SearchResultItem[];
  let meta: SearchResponseMeta | null = null;
  const started = Date.now();
  const track = { provider: "brave_search" as const, userId, attempt: deps.attempt ?? 1 };
  try {
    items = await deps.provider.search(query, { count: 10, onResponse: (m) => (meta = m) });
  } catch (err) {
    // Appel non abouti : la réservation est rendue (non décompté à l'utilisateur). Coût estimé 0 : Brave ne
    // facture pas les requêtes refusées (429) ; pour les erreurs serveur, à vérifier sur la facture.
    await release();
    const m = meta as SearchResponseMeta | null;
    const name = (err as Error).name;
    await recordProviderRequest(deps.db, {
      ...track,
      outcome: m?.status === 429 ? "rate_limited" : name === "TimeoutError" || name === "AbortError" ? "timeout" : "failure",
      httpStatus: m?.status ?? null,
      latencyMs: Date.now() - started,
      providerQuotaRemaining: m?.quotaRemaining ?? null,
      providerQuotaLimit: m?.quotaLimit ?? null,
      error: (err as Error).message,
    });
    throw err;
  }
  const okMeta = meta as SearchResponseMeta | null;
  await recordProviderRequest(deps.db, {
    ...track,
    outcome: "success",
    httpStatus: okMeta?.status ?? 200,
    latencyMs: Date.now() - started,
    estimatedCostMicros: cost,
    providerQuotaRemaining: okMeta?.quotaRemaining ?? null,
    providerQuotaLimit: okMeta?.quotaLimit ?? null,
  });
  await deps.db.execute(sql`
    insert into search_cache (query_hash, provider, query, results, fetched_at, expires_at)
    values (${hash}, ${deps.provider.name}, ${query.slice(0, 400)}, ${JSON.stringify(items)}::jsonb, now(), now() + make_interval(secs => ${SEARCH_CACHE_TTL_SECONDS}))
    on conflict (query_hash) do update set results = excluded.results, fetched_at = now(), expires_at = excluded.expires_at`);
  await deps.db.execute(sql`
    insert into api_usage (provider, user_id, plan_id, units, estimated_cost_micros, executed_by, cache_hit, meta)
    values ('brave_search', ${userId}, ${deps.planId}, 1, ${cost}, 'cloud', false, ${JSON.stringify({ q: hash.slice(0, 16) })}::jsonb)`);
  return { items, fromCache: false };
}

export interface WebRunResult {
  observation: WebTopicObservation;
  evaluation: Evaluation;
}

export async function runWebTopic(deps: WebRunDeps, task: WebTopicTask): Promise<WebRunResult> {
  const now = deps.now ?? new Date();
  const query = task.queries[task.runIndex % Math.max(1, task.queries.length)] ?? task.condition.subject;
  const { items, fromCache } = await cachedSearch(deps, task.userId, query);
  const findings = items.map((i) => classifyResult(i, task.condition, task.officialDomains)).filter((f) => f.classification !== "irrelevant");

  const seen = findings.length
    ? await deps.db
        .select({ fingerprint: monitoringSeenItems.fingerprint })
        .from(monitoringSeenItems)
        .where(and(eq(monitoringSeenItems.taskId, task.id), sql`${monitoringSeenItems.fingerprint} in ${findings.map((f) => f.fingerprint)}`))
    : [];
  const seenSet = new Set(seen.map((s) => s.fingerprint));
  const fresh = findings.filter((f) => !seenSet.has(f.fingerprint));
  if (fresh.length) {
    await deps.db
      .insert(monitoringSeenItems)
      .values(fresh.map((f) => ({ taskId: task.id, userId: task.userId, fingerprint: f.fingerprint, url: f.url, title: f.title, classification: f.classification })))
      .onConflictDoNothing();
  }
  const status = topicStatus(findings);
  const observation: WebTopicObservation = {
    kind: "web_topic",
    queries: [query],
    status,
    findings: findings.slice(0, 30),
    newFingerprints: fresh.map((f) => f.fingerprint).slice(0, 30),
    provider: deps.provider?.name ?? "none",
    fromCache,
    fetchedAt: now.toISOString(),
  };

  const alertable = fresh
    .filter((f) => meetsThreshold(f.classification, task.condition.requireOfficial))
    .sort((a, b) => (a.classification === "confirmed" ? -1 : b.classification === "confirmed" ? 1 : 0));
  const best: WebFinding | undefined = alertable[0];
  const summary =
    status === "none"
      ? "Aucune information pertinente trouvée."
      : `${STATUS_LABELS[status]} — ${findings.length} résultat(s) pertinent(s), ${fresh.length} nouveau(x).`;
  const evaluation: Evaluation = best
    ? {
        outcome: "triggered",
        triggered: true,
        summary: `${best.classification === "confirmed" ? "Information confirmée" : "Information probable"} : ${best.title}`,
        value: STATUS_LABELS[best.classification === "confirmed" ? "confirmed" : "probable"],
        alert: {
          kind: "web_topic",
          title:
            best.classification === "confirmed"
              ? `Confirmé : nouvelle information sur « ${task.condition.subject} »`
              : `Nouvelle information probable sur « ${task.condition.subject} »`,
          body: `${best.title}${best.extractedDate ? ` (date mentionnée : ${best.extractedDate})` : ""}. Source : ${best.domain}. ${best.reasons[0] ?? ""}`.trim(),
        },
        changeSummary: { sourceUrl: best.url, findings: alertable.slice(0, 5).map((f) => ({ url: f.url, title: f.title, classification: f.classification })) },
        errorCode: null,
      }
    : {
        outcome: fresh.length ? "changed" : "ok",
        triggered: false,
        summary,
        value: STATUS_LABELS[status],
        alert: null,
        changeSummary: fresh.length ? { findings: fresh.slice(0, 5).map((f) => ({ url: f.url, title: f.title, classification: f.classification })) } : null,
        errorCode: null,
      };
  return { observation, evaluation };
}
