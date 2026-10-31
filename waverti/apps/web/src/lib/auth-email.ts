import "server-only";
import { emailOutbox, type Database } from "@waverti/database";
import { createSenderFromEnv, processEmailOutbox } from "@waverti/notifications";
import { appUrl } from "./request";

/**
 * E-mails d'authentification (vérification d'adresse, réinitialisation) : mis en file puis envoyés
 * immédiatement si un transport est configuré (Resend ou SMTP) ; sinon le worker les enverra.
 * Le lien à usage unique est effacé de la file dès l'envoi.
 */
export async function sendAuthEmail(
  db: Database,
  input: { userId: string; to: string; template: "verify_email" | "reset_password"; url: string },
): Promise<"sent" | "queued"> {
  const subject = input.template === "verify_email" ? "Confirmez votre adresse e-mail Waverti" : "Réinitialisation de votre mot de passe Waverti";
  const [row] = await db
    .insert(emailOutbox)
    .values({
      userId: input.userId,
      toEmail: input.to,
      template: input.template,
      subject,
      payload: { url: input.url },
      priority: "high",
      idempotencyKey: `${input.template}:${input.userId}:${Date.now()}`,
    })
    .returning({ id: emailOutbox.id });
  const transport = createSenderFromEnv();
  if (!transport || !row) return "queued";
  const r = await processEmailOutbox(db, transport.sender, {
    from: process.env.EMAIL_FROM ?? "Waverti <alertes@waverti.invalid>",
    appUrl: appUrl(),
    workerId: "web",
    ids: [row.id],
  }).catch(() => ({ sent: 0, failed: 1 }));
  return r.sent ? "sent" : "queued";
}
