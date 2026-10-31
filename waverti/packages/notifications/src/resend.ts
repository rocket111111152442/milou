/**
 * Envoi d'e-mails via l'API HTTP de Resend (clé uniquement côté serveur).
 * RESEND_API_BASE permet de pointer vers un serveur de test.
 */
export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  replyTo?: string;
}

export interface EmailSender {
  /** Fournisseur, pour le compteur technique des envois (provider_requests). */
  readonly provider?: "resend" | "smtp";
  send(msg: EmailMessage): Promise<{ id: string }>;
}

export class EmailSendError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

export function createResendSender(apiKey: string, base = "https://api.resend.com", fetchImpl: typeof fetch = fetch): EmailSender {
  return {
    provider: "resend",
    async send(msg) {
      const res = await fetchImpl(`${base.replace(/\/$/, "")}/emails`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          ...(msg.idempotencyKey ? { "idempotency-key": msg.idempotencyKey.slice(0, 256) } : {}),
        },
        body: JSON.stringify({
          from: msg.from,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        // On ne journalise jamais le contenu de la requête (adresse, clé).
        const retryable = res.status === 429 || res.status >= 500;
        throw new EmailSendError(`Resend HTTP ${res.status}`, retryable);
      }
      const body = (await res.json().catch(() => ({}))) as { id?: string };
      return { id: body.id ?? "unknown" };
    },
  };
}
