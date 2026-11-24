import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { env } from "@/config/env";
import { getDb, schema } from "@/lib/db";
import { log } from "@/lib/log";

export type NotifyEvent = "lead.created" | "lead.hot" | "visit.requested" | "handoff.requested";

export interface NotifyPayload {
  event: NotifyEvent;
  entityId: string; // inquiry id: makes the idempotency key
  contactId: number;
  subject: string;
  text: string; // already minimised summary
  whatsappParams?: string[]; // template body parameters
}

export interface DispatchResult { channel: "email" | "whatsapp"; recipient: string; status: string }

/**
 * Records and (in live mode) sends a notification once per (event, entity, channel, recipient).
 * NOTIFY_MODE=test (default) records it in the CRM with status "test" and sends nothing.
 * A failed send never fails the lead: it is stored as "failed" and can be retried.
 */
export async function notify(p: NotifyPayload): Promise<DispatchResult[]> {
  const results: DispatchResult[] = [];
  if (!env.notify.events.includes(p.event)) return results;
  const db = await getDb();

  const emailTargets = env.notify.emailTo.length ? env.notify.emailTo : ["(sin destinatario)"];
  for (const recipient of emailTargets) {
    const key = `${p.event}:${p.entityId}:email:${recipient}`;
    const status = env.notify.emailTo.length === 0 ? "skipped" : env.notify.mode === "test" ? "test" : "pending";
    const inserted = await db
      .insert(schema.notifications)
      .values({ idempotencyKey: key, event: p.event, channel: "email", recipient, subject: p.subject, body: p.text, contactId: p.contactId, status, lastError: status === "skipped" ? "NOTIFY_EMAIL_TO no configurado" : null })
      .onConflictDoNothing({ target: schema.notifications.idempotencyKey })
      .returning({ id: schema.notifications.id });
    if (!inserted.length) continue; // already handled: no duplicate send
    if (status === "pending") results.push({ channel: "email", recipient, status: await deliver(inserted[0].id) });
    else results.push({ channel: "email", recipient, status });
  }

  const wa = env.notify.whatsapp;
  if (wa.enabled && wa.events.includes(p.event)) {
    const recipient = wa.to || "(sin destinatario)";
    const key = `${p.event}:${p.entityId}:whatsapp:${recipient}`;
    const configured = Boolean(wa.to && wa.token && wa.phoneNumberId && wa.template);
    const status = !configured ? "skipped" : env.notify.mode === "test" ? "test" : "pending";
    const inserted = await db
      .insert(schema.notifications)
      .values({ idempotencyKey: key, event: p.event, channel: "whatsapp", recipient, subject: null, body: JSON.stringify(p.whatsappParams ?? [p.subject]), contactId: p.contactId, status, lastError: configured ? null : "WhatsApp Cloud API no configurada" })
      .onConflictDoNothing({ target: schema.notifications.idempotencyKey })
      .returning({ id: schema.notifications.id });
    if (inserted.length) results.push({ channel: "whatsapp", recipient, status: status === "pending" ? await deliver(inserted[0].id) : status });
  }
  return results;
}

/** Sends one stored notification. Returns the resulting status. */
export async function deliver(id: number): Promise<string> {
  const db = await getDb();
  const [n] = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id));
  if (!n || n.status === "sent") return n?.status ?? "missing";
  if (env.notify.mode !== "live") {
    if (n.status === "pending") await db.update(schema.notifications).set({ status: "test" }).where(eq(schema.notifications.id, id));
    return "test";
  }
  try {
    if (n.channel === "email") await sendEmail(n.recipient, n.subject ?? "", n.body);
    else await sendWhatsAppTemplate(n.recipient, JSON.parse(n.body) as string[]);
    await db.update(schema.notifications).set({ status: "sent", attempts: n.attempts + 1, sentAt: new Date(), lastError: null }).where(eq(schema.notifications.id, id));
    return "sent";
  } catch (err) {
    const reason = (err as Error).message.slice(0, 300);
    await db.update(schema.notifications).set({ status: "failed", attempts: n.attempts + 1, lastError: reason }).where(eq(schema.notifications.id, id));
    log.error("notify.failed", { id, channel: n.channel });
    return "failed";
  }
}

export async function retryFailed(maxAttempts = 3): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ id: schema.notifications.id }).from(schema.notifications).where(and(eq(schema.notifications.status, "failed"), lt(schema.notifications.attempts, maxAttempts)));
  for (const r of rows) await deliver(r.id);
  return rows.length;
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!env.notify.resendApiKey || !env.notify.emailFrom) throw new Error("RESEND_API_KEY o EMAIL_FROM no configurados");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.notify.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.notify.emailFrom, to: [to], subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`resend_http_${res.status}`);
}

/**
 * WhatsApp Cloud API (Meta). Business-initiated messages require an approved template;
 * WHATSAPP_TEMPLATE_NAME must have as many body parameters as `params`.
 * Not tested against a real account: see README.
 */
async function sendWhatsAppTemplate(to: string, params: string[]) {
  const wa = env.notify.whatsapp;
  const res = await fetch(`https://graph.facebook.com/v21.0/${wa.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${wa.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "template",
      template: {
        name: wa.template,
        language: { code: wa.templateLang },
        components: [{ type: "body", parameters: params.map((t) => ({ type: "text", text: t.slice(0, 900) })) }],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`whatsapp_http_${res.status}`);
}
