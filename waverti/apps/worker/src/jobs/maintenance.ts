import { sql } from "@waverti/database";
import { recomputeEntitlements } from "@waverti/billing";
import type { WorkerContext } from "../context";
import { logger } from "../logger";

async function setting(ctx: WorkerContext, key: string, fallback: number): Promise<number> {
  const r = await ctx.db.execute<{ v: string }>(sql`select (value)::text as v from app_settings where key = ${key}`);
  const n = Number(r[0]?.v);
  return Number.isFinite(n) ? n : fallback;
}

/** Suppression par lots pour ne pas verrouiller les tables longtemps. */
async function deleteBatched(ctx: WorkerContext, label: string, statement: (limit: number) => ReturnType<typeof sql>): Promise<number> {
  let total = 0;
  for (let i = 0; i < 50; i++) {
    const r = await ctx.db.execute(statement(5000));
    total += r.length;
    if (r.length < 5000) break;
  }
  if (total) logger.info({ label, deleted: total }, "retention");
  return total;
}

/**
 * Maintenance horaire : durées de conservation (RGPD, minimisation), caches expirés,
 * droits expirés recalculés, demandes de liaison d'appareil périmées.
 */
export async function runMaintenance(ctx: WorkerContext): Promise<void> {
  const checksDays = await setting(ctx, "retention.business_checks_days", 30);
  const hbDays = await setting(ctx, "retention.agent_heartbeats_days", 7);
  const jobsDays = await setting(ctx, "retention.finished_jobs_days", 14);
  const usageDays = await setting(ctx, "retention.api_usage_days", 400);
  const rlHours = await setting(ctx, "retention.rate_limits_hours", 48);

  await deleteBatched(ctx, "monitoring_results", (n) => sql`
    delete from monitoring_results where id in (
      select r.id from monitoring_results r join entitlements e on e.user_id = r.user_id
      where r.checked_at < now() - make_interval(days => e.history_days) limit ${n}) returning id`);
  await deleteBatched(ctx, "monitoring_jobs", (n) => sql`
    delete from monitoring_jobs where id in (
      select id from monitoring_jobs where finished_at < now() - make_interval(days => ${jobsDays}) limit ${n}) returning id`);
  await deleteBatched(ctx, "business_checks", (n) => sql`
    delete from business_checks where id in (
      select id from business_checks where checked_at < now() - make_interval(days => ${checksDays}) limit ${n}) returning id`);
  await deleteBatched(ctx, "agent_heartbeats", (n) => sql`
    delete from agent_heartbeats where id in (
      select id from agent_heartbeats where received_at < now() - make_interval(days => ${hbDays}) limit ${n}) returning id`);
  await deleteBatched(ctx, "api_usage", (n) => sql`
    delete from api_usage where id in (
      select id from api_usage where occurred_at < now() - make_interval(days => ${usageDays}) limit ${n}) returning id`);
  await ctx.db.execute(sql`delete from rate_limits where window_start < now() - make_interval(hours => ${rlHours})`);
  await ctx.db.execute(sql`delete from search_cache where expires_at < now() - interval '1 day'`);
  await ctx.db.execute(sql`delete from page_cache where expires_at < now() - interval '1 hour'`);
  await ctx.db.execute(sql`delete from artifacts where expires_at < now()`);
  await ctx.db.execute(sql`update agent_link_requests set status = 'expired' where status = 'pending' and expires_at < now()`);
  await ctx.db.execute(sql`delete from agent_link_requests where created_at < now() - interval '7 days'`);
  await ctx.db.execute(sql`delete from email_outbox where status in ('sent', 'canceled') and created_at < now() - interval '30 days'`);
}

/**
 * Fin d'essai ou de période sans webhook Stripe : recalcule les droits expirés (suspension des
 * surveillances, arrêt des tâches locales et serveur). Exécuté toutes les 5 minutes.
 */
export async function recomputeExpiredEntitlements(ctx: WorkerContext): Promise<number> {
  const expired = await ctx.db.execute<{ user_id: string }>(sql`select user_id from entitlements where valid_until < now() limit 500`);
  for (const e of expired) await recomputeEntitlements(ctx.db, e.user_id);
  return expired.length;
}
