/**
 * WATCHLY — worker de surveillance (VPS).
 * Rôles (WORKER_ROLES) : scheduler, pages, web, business, email, maintenance.
 * Plusieurs instances peuvent tourner en parallèle : la coordination passe par PostgreSQL
 * (réservations SKIP LOCKED, baux), sans état partagé en mémoire.
 */
import { createDb, sql } from "@watchly/database";
import { recoverJobs, scheduleDueTasks, HostPoliteness, RobotsCache } from "@watchly/monitoring";
import { BrowserPool } from "@watchly/monitoring/browser";
import { createBraveProvider } from "@watchly/monitoring/search";
import { createResendSender } from "@watchly/notifications";
import { loadConfig } from "./config";
import { makeFetchOptions, type WorkerContext } from "./context";
import { logger } from "./logger";
import { startLoop, type LoopHandle } from "./loop";
import { processEmails } from "./jobs/email";
import { writeHeartbeat } from "./jobs/heartbeat";
import { recomputeExpiredEntitlements, runMaintenance } from "./jobs/maintenance";
import { processPageJobs } from "./jobs/pages";
import { sendTrialReminders } from "./jobs/trial-reminders";
import { processWebJobs } from "./jobs/web";
import { startBusiness } from "./jobs/business";

export async function startWorker(env: Record<string, string | undefined> = process.env) {
  const config = loadConfig(env);
  const handle = createDb(config.DATABASE_URL, { max: 20, applicationName: `watchly-worker:${config.WORKER_ID}` });
  const fetchOptions = makeFetchOptions(config);
  const ctx: WorkerContext = {
    config,
    db: handle.db,
    fetchOptions,
    robots: new RobotsCache(fetchOptions),
    politeness: new HostPoliteness(5000, 30_000),
    browser:
      config.WORKER_BROWSER_CONCURRENCY > 0 && (config.roles.has("pages") || config.roles.has("business"))
        ? new BrowserPool({
            maxConcurrency: config.WORKER_BROWSER_CONCURRENCY,
            executablePath: config.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
            egress: { allowLoopback: config.allowPrivate, allowAnyPort: config.allowPrivate },
          })
        : null,
    search: config.BRAVE_SEARCH_API_KEY ? createBraveProvider(config.BRAVE_SEARCH_API_KEY, config.BRAVE_SEARCH_API_BASE) : null,
    email: config.RESEND_API_KEY ? createResendSender(config.RESEND_API_KEY, config.RESEND_API_BASE) : null,
    counters: { succeeded: 0, failed: 0 },
  };
  if (!ctx.search) logger.warn("BRAVE_SEARCH_API_KEY absente : les recherches Web échoueront avec un message explicite");
  if (!ctx.email) logger.warn("RESEND_API_KEY absente : les e-mails restent en file d'attente (non envoyés)");

  const startedAt = new Date();
  const loops: LoopHandle[] = [];
  const r = config.roles;
  if (r.has("scheduler")) {
    loops.push(startLoop("schedule", 10_000, () => scheduleDueTasks(ctx.db, { limit: 1000 })));
    loops.push(startLoop("recover", 15_000, () => recoverJobs(ctx.db)));
    loops.push(startLoop("entitlements", 5 * 60_000, () => recomputeExpiredEntitlements(ctx)));
    loops.push(startLoop("trial-reminders", 10 * 60_000, () => sendTrialReminders(ctx)));
  }
  if (r.has("pages")) loops.push(startLoop("pages", 2_000, () => processPageJobs(ctx)));
  if (r.has("web")) loops.push(startLoop("web", 5_000, () => processWebJobs(ctx)));
  if (r.has("email")) loops.push(startLoop("email", 5_000, () => processEmails(ctx)));
  if (r.has("maintenance")) loops.push(startLoop("maintenance", 60 * 60_000, () => runMaintenance(ctx)));
  if (r.has("business")) loops.push(...startBusiness(ctx));
  loops.push(startLoop("heartbeat", 30_000, () => writeHeartbeat(ctx, startedAt, loops)));
  logger.info({ worker: config.WORKER_ID, roles: [...r] }, "worker started");

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    logger.info("shutting down");
    await Promise.race([Promise.all(loops.map((l) => l.stop())), new Promise((res) => setTimeout(res, 30_000))]);
    // Rend immédiatement à la file les tâches encore réservées par ce worker.
    await ctx.db
      .execute(sql`
        update monitoring_jobs set status = 'pending', claim_token = null, claimed_by = null, worker_id = null, lease_expires_at = null
        where worker_id = ${config.WORKER_ID} and status = 'claimed'`)
      .catch(() => undefined);
    await ctx.browser?.close();
    await handle.close();
    logger.info("stopped");
  };
  return { ctx, stop, loops };
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("dist/index.js");
if (isMain) {
  startWorker()
    .then(({ stop }) => {
      for (const sig of ["SIGTERM", "SIGINT"] as const) process.once(sig, () => void stop().then(() => process.exit(0)));
    })
    .catch((err) => {
      logger.fatal({ err: { message: (err as Error).message } }, "worker failed to start");
      process.exit(1);
    });
}
