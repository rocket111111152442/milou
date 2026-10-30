import { sql } from "drizzle-orm";
import type { Executor } from "./client";

/** Ressources facturables suivies par compteur (une ligne par compte, métrique et période). */
export type UsageMetric = "brave_search" | "email_alert" | "ai_call" | "browser_run";

/** Période mensuelle (« 2026-10 ») ou journalière (« 2026-10-30 »), en UTC. */
export function usagePeriod(kind: "month" | "day", now: Date = new Date()): string {
  const iso = now.toISOString();
  return kind === "month" ? iso.slice(0, 7) : iso.slice(0, 10);
}

/**
 * Réserve `amount` unités si la limite n'est pas dépassée. Incrément atomique conditionnel : deux
 * workers simultanés ne peuvent pas dépasser la limite ensemble. Renvoie la nouvelle valeur, ou null
 * si la réservation est refusée. `userId` null : compteur global de la plateforme.
 */
export async function consumeUsage(
  db: Executor,
  params: { userId: string | null; metric: UsageMetric; period: string; limit: number; amount?: number },
): Promise<number | null> {
  const amount = params.amount ?? 1;
  if (amount <= 0) throw new Error("amount must be positive");
  if (params.limit < amount) return null;
  const rows = await db.execute<{ value: string }>(sql`
    insert into usage_counters (user_id, metric, period, value)
    values (${params.userId}, ${params.metric}, ${params.period}, ${amount})
    on conflict on constraint usage_counters_key do update
      set value = usage_counters.value + excluded.value, updated_at = now()
      where usage_counters.value + excluded.value <= ${params.limit}
    returning value`);
  return rows[0] ? Number(rows[0].value) : null;
}

/** Restitue une réservation (appel facturable finalement non effectué). */
export async function releaseUsage(
  db: Executor,
  params: { userId: string | null; metric: UsageMetric; period: string; amount?: number },
): Promise<void> {
  await db.execute(sql`
    update usage_counters set value = greatest(0, value - ${params.amount ?? 1}), updated_at = now()
    where user_id is not distinct from ${params.userId} and metric = ${params.metric} and period = ${params.period}`);
}

/** Valeur actuelle d'un compteur (0 s'il n'existe pas). */
export async function readUsage(db: Executor, params: { userId: string | null; metric: UsageMetric; period: string }): Promise<number> {
  const rows = await db.execute<{ value: string }>(sql`
    select value from usage_counters
    where user_id is not distinct from ${params.userId} and metric = ${params.metric} and period = ${params.period}`);
  return rows[0] ? Number(rows[0].value) : 0;
}
