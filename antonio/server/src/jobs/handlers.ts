import { lt, sql } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { executeAction, verifyAction } from "../actions/executor.js";
import { cleanupExpiredOAuthStates, renewExpiringWebhooks, syncConnection } from "../connectors/service.js";
import { processMessage } from "../rules/engine.js";
import { briefingTick } from "../briefing/service.js";
import { enqueue, JOBS, registerHandler, schedule } from "./queue.js";

/** Enregistre les traitements de fond. Ils tournent côté serveur, page web fermée ou non. */
export function registerJobHandlers() {
  registerHandler(JOBS.syncConnection, async (d) => {
    await syncConnection(d.connectionId as string);
  });
  registerHandler(JOBS.processMessage, async (d) => {
    await processMessage(d.messageId as string);
  });
  registerHandler(JOBS.executeAction, async (d) => {
    await executeAction(d.actionId as string);
  });
  registerHandler(JOBS.verifyAction, async (d) => {
    await verifyAction(d.actionId as string, Number(d.attempt ?? 0));
  });
  registerHandler(JOBS.briefingTick, async () => {
    await briefingTick();
  });
  registerHandler(JOBS.renewWebhooks, async () => {
    await renewExpiringWebhooks();
  });
  registerHandler(JOBS.periodicSync, async () => {
    // Filet de sécurité si les webhooks ne sont pas disponibles ou ont été manqués.
    const conns = await db().select({ id: schema.connections.id, provider: schema.connections.provider }).from(schema.connections).where(sql`${schema.connections.status} = 'active'`);
    for (const c of conns) if (c.provider !== "demo") await enqueue(JOBS.syncConnection, { connectionId: c.id });
    // Reprise après interruption : actions restées « en cours » trop longtemps.
    await recoverStuckActions();
  });
  registerHandler(JOBS.retention, async () => {
    await applyRetention();
  });
}

export async function scheduleRecurringJobs() {
  await schedule(JOBS.briefingTick, "*/5 * * * *");
  await schedule(JOBS.periodicSync, "*/10 * * * *");
  await schedule(JOBS.renewWebhooks, "17 * * * *");
  await schedule(JOBS.retention, "41 3 * * *");
}

/**
 * Une action « executing » depuis plus de 10 minutes : le worker a été interrompu.
 * Envoi d'e-mail => « incertain » (vérification) ; autres => nouvel essai (idempotent).
 */
export async function recoverStuckActions() {
  const stuck = await db()
    .select()
    .from(schema.actions)
    .where(sql`${schema.actions.status} = 'executing' and ${schema.actions.updatedAt} < now() - interval '10 minutes'`);
  for (const a of stuck) {
    if (a.kind === "email.send" || a.kind === "email.reply") {
      await db().update(schema.actions).set({ status: "uncertain", updatedAt: new Date(), error: "Interruption pendant l'envoi" }).where(sql`${schema.actions.id} = ${a.id} and ${schema.actions.status} = 'executing'`);
      await enqueue(JOBS.verifyAction, { actionId: a.id, attempt: 0 });
    } else {
      await db().update(schema.actions).set({ status: "authorized", updatedAt: new Date() }).where(sql`${schema.actions.id} = ${a.id} and ${schema.actions.status} = 'executing'`);
      await enqueue(JOBS.executeAction, { actionId: a.id });
    }
  }
}

/** Conservation : transcriptions selon le réglage de chaque utilisateur, reçus de webhooks 7 jours. */
export async function applyRetention() {
  await db().execute(sql`
    delete from ${schema.turns} t using ${schema.profiles} p
    where t.user_id = p.user_id and t.created_at < now() - (p.transcript_retention_days || ' days')::interval`);
  await db().delete(schema.webhookReceipts).where(lt(schema.webhookReceipts.receivedAt, new Date(Date.now() - 7 * 86400_000)));
  await cleanupExpiredOAuthStates();
}
