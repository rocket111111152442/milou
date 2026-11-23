import { startHub, stopHub } from "./realtime/hub.js";
import { recoverStuckActions, registerJobHandlers, scheduleRecurringJobs } from "./jobs/handlers.js";
import { startQueue, stopQueue } from "./jobs/queue.js";
import { runMigrations } from "./migrate.js";
import { closeDb } from "./db/client.js";

/**
 * Worker : synchronisations, traitement des nouveaux messages, règles,
 * exécution et vérification des actions, point quotidien, renouvellement
 * des webhooks. Fonctionne indépendamment des navigateurs ouverts.
 */
async function main() {
  await runMigrations();
  await startHub();
  registerJobHandlers();
  await startQueue({ work: true });
  await scheduleRecurringJobs();
  // Reprise après interruption : actions restées « en cours » lors d'un arrêt brutal.
  await recoverStuckActions();
  console.log("[worker] prêt");
  const shutdown = async () => {
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
