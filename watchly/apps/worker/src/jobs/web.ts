import { count, eq, monitoringResults, monitoringTargets, monitoringTasks, sql } from "@watchly/database";
import { getEntitlements } from "@watchly/billing";
import { claimCloudJobs, StaleClaimError, submitResult } from "@watchly/monitoring";
import { BudgetExceededError, runWebTopic, SearchProviderError } from "@watchly/monitoring/search";
import { webTopicConditionSchema } from "@watchly/types";
import type { WorkerContext } from "../context";
import { logger } from "../logger";
import { mapLimit } from "../loop";

/** Recherches sur Internet (moteur B), toujours exécutées par les serveurs (clés d'API côté serveur). */
export async function processWebJobs(ctx: WorkerContext): Promise<number> {
  const claims = await claimCloudJobs(ctx.db, { workerId: ctx.config.WORKER_ID, max: ctx.config.WORKER_WEB_CONCURRENCY, kinds: ["web_topic"], leaseSeconds: 120 });
  await mapLimit(claims, ctx.config.WORKER_WEB_CONCURRENCY, async (claim) => {
    const started = Date.now();
    const [task] = await ctx.db.select().from(monitoringTasks).where(eq(monitoringTasks.id, claim.taskId)).limit(1);
    const [target] = await ctx.db.select().from(monitoringTargets).where(eq(monitoringTargets.taskId, claim.taskId)).limit(1);
    if (!task || !target) return;
    const ent = await getEntitlements(ctx.db, claim.userId);
    if (!ent.planId) {
      // Droits retirés entre la réservation et l'exécution : aucune recherche payante.
      await submitResult(ctx.db, { jobId: claim.jobId, claimToken: claim.claimToken, executor: "cloud", durationMs: 0, error: { code: "subscription_required", message: "Aucun abonnement actif." } }).catch(() => undefined);
      return;
    }
    const [runs] = await ctx.db.select({ n: count() }).from(monitoringResults).where(eq(monitoringResults.taskId, task.id));
    const submitError = (code: string, message: string) =>
      submitResult(ctx.db, { jobId: claim.jobId, claimToken: claim.claimToken, executor: "cloud", durationMs: Date.now() - started, error: { code, message } });
    try {
      const { observation, evaluation } = await runWebTopic(
        { db: ctx.db, provider: ctx.search, planId: ent.planId, monthlyCallLimit: ent.monthlySearchCalls, dailyCallLimit: ent.dailySearchCalls },
        {
          id: task.id,
          userId: task.userId,
          name: task.name,
          condition: webTopicConditionSchema.parse(task.condition),
          queries: target.searchQueries,
          officialDomains: target.officialDomains,
          runIndex: runs?.n ?? 0,
        },
      );
      const r = await submitResult(ctx.db, { jobId: claim.jobId, claimToken: claim.claimToken, executor: "cloud", durationMs: Date.now() - started, observation, webEvaluation: evaluation });
      ctx.counters.succeeded++;
      return r;
    } catch (err) {
      if (err instanceof StaleClaimError) return;
      if (err instanceof BudgetExceededError) {
        ctx.counters.failed++;
        if (err.scope === "global") logger.error({ task: task.id }, "global search budget exhausted");
        return submitError("budget_exceeded", err.message);
      }
      if (err instanceof SearchProviderError && err.retryable) {
        await ctx.db.execute(sql`
          update monitoring_jobs set status = 'pending', claim_token = null, claimed_by = null, worker_id = null, lease_expires_at = null,
                 slot_at = now() + interval '10 minutes'
          where id = ${claim.jobId} and claim_token = ${claim.claimToken}`);
        return;
      }
      ctx.counters.failed++;
      logger.error({ task: task.id, err: { name: (err as Error).name, message: (err as Error).message?.slice(0, 200) } }, "web topic failed");
      return submitError("search_failed", err instanceof SearchProviderError ? "Le moteur de recherche est indisponible." : "La recherche a échoué.");
    }
  });
  return claims.length;
}
