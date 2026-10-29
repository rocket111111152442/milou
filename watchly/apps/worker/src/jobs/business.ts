import { rollupDailyStats, runScenarioPass, runTlsPass, runUptimePass, utcDay } from "@watchly/monitoring/business";
import type { WorkerContext } from "../context";
import { startLoop, type LoopHandle } from "../loop";

/**
 * Moteur C — contrôles Business, toujours exécutés par les serveurs (jamais par un PC client) :
 * disponibilité HTTP (cadence de la formule, 60 s), certificats HTTPS (quotidien),
 * scénarios navigateur (toutes les 2 h) et statistiques quotidiennes.
 */
export function startBusiness(ctx: WorkerContext): LoopHandle[] {
  const c = ctx.config;
  const local = ctx.fetchOptions.allowLoopback ? { allowLoopback: true, allowAnyPort: true } : {};
  const loops: LoopHandle[] = [
    startLoop("business:uptime", 5_000, async () => {
      // Plusieurs passes tant qu'il reste des contrôles dus, sans dépasser la concurrence configurée.
      for (let i = 0; i < 10; i++) {
        const n = await runUptimePass(ctx.db, {
          workerId: c.WORKER_ID,
          max: c.WORKER_BUSINESS_CONCURRENCY * 4,
          concurrency: c.WORKER_BUSINESS_CONCURRENCY,
          fetchOptions: ctx.fetchOptions,
        });
        if (n < c.WORKER_BUSINESS_CONCURRENCY * 4) break;
      }
    }),
    startLoop("business:tls", 10 * 60_000, () => runTlsPass(ctx.db, { max: 50, tls: { allowLoopback: Boolean(ctx.fetchOptions.allowLoopback) } })),
    startLoop("business:stats", 10 * 60_000, () => rollupDailyStats(ctx.db, [utcDay(new Date(Date.now() - 86_400_000)), utcDay(new Date())])),
  ];
  if (ctx.browser) {
    const browser = ctx.browser;
    loops.push(
      startLoop("business:scenarios", 30_000, () =>
        runScenarioPass(ctx.db, browser, { workerId: c.WORKER_ID, max: Math.max(1, c.WORKER_BROWSER_CONCURRENCY), policy: local }),
      ),
    );
  }
  return loops;
}
