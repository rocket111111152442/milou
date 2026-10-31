import { sql } from "drizzle-orm";
import type { Executor } from "./client";
import { providerRequests, type ProviderName, type ProviderOutcome } from "./schema";

export interface ProviderRequestRecord {
  provider: ProviderName;
  userId?: string | null;
  outcome: ProviderOutcome;
  httpStatus?: number | null;
  attempt?: number;
  latencyMs?: number | null;
  estimatedCostMicros?: number;
  providerQuotaRemaining?: number | null;
  providerQuotaLimit?: number | null;
  error?: string | null;
}

/** Journalise une requête réellement émise vers un fournisseur. Ne fait jamais échouer l'appelant. */
export async function recordProviderRequest(db: Executor, r: ProviderRequestRecord): Promise<void> {
  const attempt = Math.max(1, Math.min(32_000, r.attempt ?? 1));
  await db
    .insert(providerRequests)
    .values({
      provider: r.provider,
      userId: r.userId ?? null,
      outcome: r.outcome,
      httpStatus: r.httpStatus ?? null,
      attempt,
      isRetry: attempt > 1,
      latencyMs: r.latencyMs == null ? null : Math.max(0, Math.round(r.latencyMs)),
      estimatedCostMicros: Math.max(0, Math.round(r.estimatedCostMicros ?? 0)),
      providerQuotaRemaining: r.providerQuotaRemaining ?? null,
      providerQuotaLimit: r.providerQuotaLimit ?? null,
      error: r.error ? r.error.slice(0, 300) : null,
    })
    .catch(() => undefined);
}

export interface ProviderMonthSummary {
  provider: string;
  requests: number;
  successes: number;
  failures: number;
  rateLimited: number;
  timeouts: number;
  retries: number;
  estimatedCostMicros: number;
  actualCostMicros: number | null;
  lastQuotaRemaining: number | null;
  lastQuotaLimit: number | null;
}

/** Synthèse mensuelle par fournisseur (administration). `month` : « AAAA-MM » (UTC). */
export async function providerMonthSummary(db: Executor, month: string): Promise<ProviderMonthSummary[]> {
  const rows = await db.execute<{
    provider: string;
    requests: string;
    successes: string;
    failures: string;
    rate_limited: string;
    timeouts: string;
    retries: string;
    estimated: string;
    actual: string | null;
    q_remaining: number | null;
    q_limit: number | null;
  }>(sql`
    with m as (select (${month} || '-01')::date as start),
    agg as (
      select provider,
             count(*) as requests,
             count(*) filter (where outcome = 'success') as successes,
             count(*) filter (where outcome = 'failure') as failures,
             count(*) filter (where outcome = 'rate_limited') as rate_limited,
             count(*) filter (where outcome = 'timeout') as timeouts,
             count(*) filter (where is_retry) as retries,
             coalesce(sum(estimated_cost_micros), 0) as estimated
      from provider_requests, m
      where occurred_at >= m.start and occurred_at < (m.start + interval '1 month')
      group by provider
    ),
    last_q as (
      select distinct on (provider) provider, provider_quota_remaining as q_remaining, provider_quota_limit as q_limit
      from provider_requests, m
      where provider_quota_remaining is not null and occurred_at >= m.start and occurred_at < (m.start + interval '1 month')
      order by provider, occurred_at desc
    ),
    providers as (
      select provider from agg union select provider from provider_monthly_costs where month = ${month}
    )
    select p.provider,
           coalesce(a.requests, 0)::text as requests, coalesce(a.successes, 0)::text as successes,
           coalesce(a.failures, 0)::text as failures, coalesce(a.rate_limited, 0)::text as rate_limited,
           coalesce(a.timeouts, 0)::text as timeouts, coalesce(a.retries, 0)::text as retries,
           coalesce(a.estimated, 0)::text as estimated,
           c.actual_cost_micros::text as actual, q.q_remaining, q.q_limit
    from providers p
    left join agg a on a.provider = p.provider
    left join last_q q on q.provider = p.provider
    left join provider_monthly_costs c on c.provider = p.provider and c.month = ${month}
    order by p.provider`);
  return rows.map((r) => ({
    provider: r.provider,
    requests: Number(r.requests),
    successes: Number(r.successes),
    failures: Number(r.failures),
    rateLimited: Number(r.rate_limited),
    timeouts: Number(r.timeouts),
    retries: Number(r.retries),
    estimatedCostMicros: Number(r.estimated),
    actualCostMicros: r.actual === null ? null : Number(r.actual),
    lastQuotaRemaining: r.q_remaining,
    lastQuotaLimit: r.q_limit,
  }));
}
