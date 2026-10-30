/**
 * Statistiques quotidiennes (disponibilité, temps de réponse, durée d'indisponibilité),
 * calculées UNIQUEMENT à partir des contrôles réellement effectués.
 */
import { sql, type Executor } from "@waverti/database";

/** Recalcule (idempotent) les statistiques des jours donnés (format AAAA-MM-JJ, UTC). */
export async function rollupDailyStats(db: Executor, days: string[]): Promise<number> {
  let n = 0;
  for (const day of days) {
    const rows = await db.execute<{ endpoint_id: string }>(sql`
      insert into business_daily_stats (endpoint_id, site_id, user_id, day, checks, failures, avg_response_ms, p95_response_ms, downtime_seconds)
      select c.endpoint_id, c.site_id, c.user_id, ${day}::date,
        count(*) filter (where not c.is_confirmation),
        count(*) filter (where not c.ok and not c.is_confirmation),
        round(avg(c.response_ms) filter (where c.ok))::int,
        round(percentile_cont(0.95) within group (order by c.response_ms) filter (where c.ok))::int,
        coalesce((
          select sum(extract(epoch from (least(coalesce(i.resolved_at, now()), (${day}::date + 1)::timestamptz)
                                       - greatest(i.started_at, ${day}::date::timestamptz))))::int
          from incidents i
          where i.endpoint_id = c.endpoint_id and i.kind = 'downtime'
            and i.started_at < (${day}::date + 1)::timestamptz and coalesce(i.resolved_at, now()) > ${day}::date::timestamptz
        ), 0)
      from business_checks c
      where c.checked_at >= ${day}::date::timestamptz and c.checked_at < (${day}::date + 1)::timestamptz
      group by c.endpoint_id, c.site_id, c.user_id
      on conflict (endpoint_id, day) do update set
        checks = excluded.checks, failures = excluded.failures, avg_response_ms = excluded.avg_response_ms,
        p95_response_ms = excluded.p95_response_ms, downtime_seconds = excluded.downtime_seconds
      returning endpoint_id`);
    n += rows.length;
  }
  return n;
}

export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
