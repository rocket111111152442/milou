/**
 * Envoi par SMTP (nodemailer) : alternative gratuite à Resend (serveur SMTP du domaine) et
 * transport des tests locaux (Mailpit). SMTP_URL = smtp://utilisateur:motdepasse@hote:port
 * ou smtps://… ; les identifiants ne sont jamais journalisés.
 */
import nodemailer from "nodemailer";
import { createResendSender, EmailSendError, type EmailSender } from "./resend";

export function createSmtpSender(url: string): EmailSender {
  const transport = nodemailer.createTransport(url);
  return {
    async send(msg) {
      try {
        const info = await transport.sendMail({
          from: msg.from,
          to: msg.to,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          replyTo: msg.replyTo,
          headers: msg.idempotencyKey ? { "X-Entity-Ref-ID": msg.idempotencyKey.slice(0, 200) } : undefined,
        });
        return { id: info.messageId ?? "smtp" };
      } catch (err) {
        const code = (err as { responseCode?: number }).responseCode ?? 0;
        throw new EmailSendError(`SMTP ${code || "erreur de connexion"}`, code === 0 || code >= 400 && code < 500);
      }
    },
  };
}

/** Transport configuré : Resend (RESEND_API_KEY) en priorité, sinon SMTP (SMTP_URL), sinon aucun. */
export function createSenderFromEnv(env: Record<string, string | undefined> = process.env): { sender: EmailSender; provider: "resend" | "smtp" } | null {
  if (env.RESEND_API_KEY) return { sender: createResendSender(env.RESEND_API_KEY, env.RESEND_API_BASE), provider: "resend" };
  if (env.SMTP_URL) return { sender: createSmtpSender(env.SMTP_URL), provider: "smtp" };
  return null;
}
