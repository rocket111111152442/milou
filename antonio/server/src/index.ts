import { buildApp } from "./app.js";
import { config } from "./config.js";
import { startHub, stopHub } from "./realtime/hub.js";
import { registerJobHandlers, scheduleRecurringJobs } from "./jobs/handlers.js";
import { startQueue, stopQueue } from "./jobs/queue.js";
import { runMigrations } from "./migrate.js";
import { closeDb } from "./db/client.js";

/**
 * Processus web : API, SSE, webhooks. Les tâches de fond tournent dans le
 * processus worker (src/worker.ts) ; RUN_WORKER_IN_WEB=true les exécute ici
 * (pratique pour un déploiement mono-instance).
 */
async function main() {
  const c = config();
  await runMigrations();
  await startHub();
  registerJobHandlers();
  await startQueue({ work: c.RUN_WORKER_IN_WEB });
  if (c.RUN_WORKER_IN_WEB) await scheduleRecurringJobs();
  const app = await buildApp();
  await app.listen({ port: c.PORT, host: "0.0.0.0" });
  const shutdown = async () => {
    await app.close();
    await stopQueue();
    await stopHub();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
