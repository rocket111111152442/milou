import { emailOutbox, eq, notifications, sql, type Database } from "@waverti/database";
import { EmailSendError, type EmailSender } from "./resend";
import { renderEmail } from "./templates";

export interface OutboxOptions {
  from: string;
  appUrl: string;
  batchSize?: number;
  workerId: string;
  onSent?: (row: { id: string; userId: string | null }) => Promise<void> | void;
  /** Envoi immédiat de messages précis (e-mails d'authentification envoyés par le site). */
  ids?: string[];
}

/** Gabarits contenant un lien à usage unique : le contenu est effacé de la file dès l'envoi. */
const ONE_TIME_LINK_TEMPLATES = new Set(["verify_email", "reset_password"]);

const MAX_ATTEMPTS = 5;

/**
 * Traite la file d'e-mails : réservation atomique (SKIP LOCKED + bail), envoi, puis
 * succès ou nouvelle tentative avec attente exponentielle. Retourne le nombre d'envois réussis.
 */
export async function processEmailOutbox(db: Database, sender: EmailSender, opts: OutboxOptions): Promise<{ sent: number; failed: number }> {
  const batch = opts.batchSize ?? 20;
  const claimed = await db.execute<{
    id: string;
    to_email: string;
    template: string;
    subject: string;
    payload: Record<string, unknown>;
    attempts: number;
    idempotency_key: string | null;
    notification_id: string | null;
    user_id: string | null;
  }>(sql`
    update email_outbox set status = 'sending', attempts = attempts + 1, lease_expires_at = now() + interval '2 minutes'
    where id in (
      select id from email_outbox
      where ((status = 'pending' and next_attempt_at <= now())
         or (status = 'sending' and lease_expires_at < now()))
        ${opts.ids?.length ? sql`and id in ${opts.ids}` : sql``}
      order by case priority when 'critical' then 0 when 'high' then 1 else 2 end, next_attempt_at
      limit ${batch}
      for update skip locked
    )
    returning id, to_email, template, subject, payload, attempts, idempotency_key, notification_id, user_id`);

  let sent = 0;
  let failed = 0;
  for (const row of claimed) {
    try {
      const rendered = renderEmail(row.template, row.subject, row.payload ?? {}, opts.appUrl);
      const res = await sender.send({
        from: opts.from,
        to: row.to_email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: row.idempotency_key ?? row.id,
      });
      await db
        .update(emailOutbox)
        .set({
          status: "sent",
          sentAt: new Date(),
          providerMessageId: res.id,
          lastError: null,
          leaseExpiresAt: null,
          ...(ONE_TIME_LINK_TEMPLATES.has(row.template) ? { payload: {} } : {}),
        })
        .where(eq(emailOutbox.id, row.id));
      if (row.notification_id) {
        await db.update(notifications).set({ emailStatus: "sent" }).where(eq(notifications.id, row.notification_id));
      }
      sent++;
      await opts.onSent?.({ id: row.id, userId: row.user_id });
    } catch (err) {
      failed++;
      const retryable = !(err instanceof EmailSendError) || err.retryable;
      const final = !retryable || row.attempts >= MAX_ATTEMPTS;
      const delaySec = Math.min(3600, 30 * 2 ** (row.attempts - 1));
      await db
        .update(emailOutbox)
        .set({
          status: final ? "failed" : "pending",
          lastError: (err as Error).message.slice(0, 300),
          nextAttemptAt: new Date(Date.now() + delaySec * 1000),
          leaseExpiresAt: null,
        })
        .where(eq(emailOutbox.id, row.id));
      if (final && row.notification_id) {
        await db.update(notifications).set({ emailStatus: "failed" }).where(eq(notifications.id, row.notification_id));
      }
    }
  }
  return { sent, failed };
}
