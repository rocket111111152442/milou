import { PgBoss } from "pg-boss";
import { config } from "../config.js";

/**
 * File de tâches persistante (pg-boss, stockée dans PostgreSQL).
 * - mode « boss » : production / développement, tâches durables et reprises après redémarrage ;
 * - mode « inline » : tests, exécution immédiate et déterministe.
 * La prévention des doublons ne repose PAS sur la file : elle est garantie en base
 * (clé d'idempotence unique des actions, verrous consultatifs de synchronisation).
 */

export const JOBS = {
  syncConnection: "sync-connection",
  processMessage: "process-message",
  executeAction: "execute-action",
  verifyAction: "verify-action",
  briefingTick: "briefing-tick",
  renewWebhooks: "renew-webhooks",
  periodicSync: "periodic-sync",
  retention: "retention-cleanup",
} as const;
export type JobName = (typeof JOBS)[keyof typeof JOBS];

type Handler = (data: Record<string, unknown>) => Promise<void>;
const handlers = new Map<string, Handler>();
let boss: PgBoss | null = null;
let mode: "inline" | "boss" = "inline";
const inlineErrors: Error[] = [];

export function registerHandler(name: JobName, handler: Handler) {
  handlers.set(name, handler);
}

export function useInlineQueue() {
  mode = "inline";
}

export function drainInlineErrors(): Error[] {
  return inlineErrors.splice(0, inlineErrors.length);
}

export async function startQueue(opts: { work: boolean }) {
  boss = new PgBoss({ connectionString: config().DATABASE_URL, schema: "pgboss" });
  boss.on("error", (err: unknown) => console.error("[queue]", (err as Error).message));
  await boss.start();
  for (const name of Object.values(JOBS)) await boss.createQueue(name).catch(() => undefined);
  mode = "boss";
  if (opts.work) {
    for (const [name, handler] of handlers) {
      await boss.work<Record<string, unknown>>(name, { batchSize: 1 }, async (jobs) => {
        for (const job of jobs) await handler(job.data ?? {});
      });
    }
  }
  return boss;
}

export async function stopQueue() {
  if (boss) await boss.stop({ graceful: true }).catch(() => undefined);
  boss = null;
}

export async function schedule(name: JobName, cron: string) {
  if (boss) await boss.schedule(name, cron, {}, { tz: "UTC" });
}

export async function enqueue(name: JobName, data: Record<string, unknown>, opts: { delaySeconds?: number; retryLimit?: number } = {}) {
  if (mode === "boss" && boss) {
    const options = { retryLimit: opts.retryLimit ?? 3, retryDelay: 15, retryBackoff: true };
    if (opts.delaySeconds) return boss.sendAfter(name, data, options, opts.delaySeconds);
    return boss.send(name, data, options);
  }
  const handler = handlers.get(name);
  if (!handler) return null;
  if (opts.delaySeconds) return null; // en mode inline, les tâches différées sont déclenchées explicitement par les tests
  try {
    await handler(data);
  } catch (err) {
    inlineErrors.push(err as Error);
  }
  return null;
}
