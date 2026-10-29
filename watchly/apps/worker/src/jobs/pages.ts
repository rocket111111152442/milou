import { eq, monitoringTargets, sql } from "@watchly/database";
import { claimCloudJobs, runPageCheck, StaleClaimError, submitResult } from "@watchly/monitoring";
import type { WorkerContext } from "../context";
import { logger } from "../logger";
import { mapLimit } from "../loop";

/** Contrôles de pages exécutés par les serveurs (relais cloud ou mode « serveur uniquement »). */
export async function processPageJobs(ctx: WorkerContext): Promise<number> {
  const claims = await claimCloudJobs(ctx.db, { workerId: ctx.config.WORKER_ID, max: ctx.config.WORKER_PAGE_CONCURRENCY * 2, kinds: ["page"], leaseSeconds: 180 });
  await mapLimit(claims, ctx.config.WORKER_PAGE_CONCURRENCY, async (claim) => {
    const [target] = await ctx.db.select().from(monitoringTargets).where(eq(monitoringTargets.taskId, claim.taskId)).limit(1);
    if (!target?.url) {
      await submitResult(ctx.db, { jobId: claim.jobId, claimToken: claim.claimToken, executor: "cloud", durationMs: 0, error: { code: "target_missing", message: "Cible introuvable" } }).catch(() => undefined);
      return;
    }
    const run = await runPageCheck(
      {
        db: ctx.db,
        robots: ctx.robots,
        politeness: ctx.politeness,
        fetchOptions: ctx.fetchOptions,
        browser: ctx.browser ? { render: (url, o) => ctx.browser!.render(url, { ...o, allowLoopback: ctx.fetchOptions.allowLoopback, allowAnyPort: ctx.fetchOptions.allowAnyPort }) } : null,
        recordUsage: async (u) => {
          if (u.provider === "playwright") {
            await ctx.db.execute(sql`
              insert into api_usage (provider, user_id, units, estimated_cost_micros, executed_by, cache_hit)
              values ('playwright', ${claim.userId}, 1, coalesce((select (value)::text::bigint from app_settings where key = 'cost.playwright_run_micros'), 2000), 'cloud', false)`);
          }
        },
      },
      { url: target.url, cssSelector: target.cssSelector, renderMode: target.renderMode },
    );
    if (run.error?.code === "host_busy") {
      // Site déjà sollicité : on rend la tâche à la file pour un nouvel essai ultérieur.
      await ctx.db.execute(sql`
        update monitoring_jobs set status = 'pending', claim_token = null, claimed_by = null, worker_id = null, lease_expires_at = null,
               slot_at = now() + interval '2 minutes', attempts = greatest(attempts - 1, 0)
        where id = ${claim.jobId} and claim_token = ${claim.claimToken}`);
      return;
    }
    try {
      const r = await submitResult(ctx.db, {
        jobId: claim.jobId,
        claimToken: claim.claimToken,
        executor: "cloud",
        durationMs: run.durationMs,
        observation: run.observation,
        error: run.error,
        fromCache: run.fromCache,
      });
      ctx.counters[r.outcome === "error" ? "failed" : "succeeded"]++;
    } catch (err) {
      if (err instanceof StaleClaimError) logger.warn({ job: claim.jobId }, "stale claim, result discarded");
      else throw err;
    }
  });
  return claims.length;
}
