import { and, eq, gte, lte, ne } from "drizzle-orm";
import type { Capability, ConnectorDescriptor } from "@antonio/shared";
import { CAPABILITIES } from "@antonio/shared";
import { db, schema } from "../../db/client.js";
import { type EventMeta, type MessageMeta, type ProviderAdapter, ProviderError } from "../types.js";

/**
 * Connecteur de DÉMONSTRATION.
 * Les données sont fictives et stockées localement ; les « envois » sont simulés
 * et n'atteignent jamais un vrai destinataire. L'interface l'affiche en permanence.
 */

/** Permet aux tests de simuler une coupure après un envoi potentiel. */
export const demoFaults = { failNextSendAfterEffect: false, failNextSendBeforeEffect: false };

export const demoAdapter: ProviderAdapter = {
  id: "demo",
  label: "Démonstration (données fictives)",
  descriptor(): ConnectorDescriptor {
    return {
      id: "demo",
      label: "Compte de démonstration",
      status: "available",
      reads: ["Boîte de réception fictive", "Agenda fictif"],
      writes: ["Actions simulées (aucun e-mail réel n'est envoyé)"],
      unsupported: ["Aucune connexion réelle"],
      notes: ["Les données et actions de ce compte sont simulées et signalées comme telles."],
    };
  },
  scopesFor: () => [],
  capabilitiesFromScopes: () => [...CAPABILITIES] as Capability[],
  reversibility: (kind) => (["email.trash", "email.archive", "email.label", "email.untrash"].includes(kind) ? "reversible" : kind.startsWith("calendar.") ? "partial" : "irreversible"),

  async syncMail(): Promise<{ upserts: MessageMeta[]; deletedIds: string[]; cursor: Record<string, unknown>; full: boolean }> {
    return { upserts: [], deletedIds: [], cursor: { demo: true }, full: false };
  },

  async getMessageBody(conn, _t, id) {
    const rows = await db()
      .select({ body: schema.demoMailbox.body, snippet: schema.messages.snippet })
      .from(schema.messages)
      .leftJoin(schema.demoMailbox, eq(schema.demoMailbox.messageId, schema.messages.id))
      .where(and(eq(schema.messages.connectionId, conn.id), eq(schema.messages.providerMessageId, id)));
    if (!rows[0]) throw new ProviderError("Message introuvable", "not_found", 404);
    return { text: rows[0].body ?? rows[0].snippet, attachments: [] };
  },

  async searchMail(conn, _t, query) {
    const q = query.toLowerCase();
    const rows = await db().select().from(schema.messages).where(eq(schema.messages.connectionId, conn.id));
    return rows
      .filter((m) => `${m.subject} ${m.snippet} ${m.fromEmail} ${m.fromName ?? ""}`.toLowerCase().includes(q))
      .map((m) => m.providerMessageId);
  },

  async createDraft() {
    return { draftId: `demo-draft-${crypto.randomUUID()}` };
  },

  async sendMail(conn, _t, mail) {
    if (demoFaults.failNextSendBeforeEffect) {
      demoFaults.failNextSendBeforeEffect = false;
      throw new ProviderError("Délai dépassé (simulé, avant effet)", "transient");
    }
    const providerMessageId = `demo-sent-${crypto.randomUUID()}`;
    const threadId = mail.inReplyTo?.providerThreadId ?? providerMessageId;
    const [row] = await db()
      .insert(schema.messages)
      .values({
        orgId: conn.orgId,
        userId: conn.userId,
        connectionId: conn.id,
        providerMessageId,
        providerThreadId: threadId,
        internetMessageId: mail.internetMessageId,
        fromEmail: conn.accountEmail,
        fromName: null,
        toList: mail.to,
        ccList: mail.cc,
        subject: mail.subject,
        snippet: mail.body.slice(0, 160),
        receivedAt: new Date(),
        unread: false,
        isSent: true,
        category: "info",
        categoryReason: "Message envoyé (simulé)",
        processedAt: new Date(),
      })
      .returning();
    await db().insert(schema.demoMailbox).values({ messageId: row.id, body: mail.body });
    if (demoFaults.failNextSendAfterEffect) {
      demoFaults.failNextSendAfterEffect = false;
      throw new ProviderError("Connexion coupée après l'envoi (simulé)", "transient");
    }
    return { providerMessageId, providerThreadId: threadId };
  },

  async findSent(conn, _t, internetMessageId) {
    const [row] = await db()
      .select()
      .from(schema.messages)
      .where(and(eq(schema.messages.connectionId, conn.id), eq(schema.messages.internetMessageId, internetMessageId), eq(schema.messages.isSent, true)));
    return row ? { providerMessageId: row.providerMessageId } : null;
  },

  async trash(conn, _t, id) {
    await setFlags(conn.id, id, { inTrash: true });
    return { revertInfo: { method: "untrash" } };
  },
  async untrash(conn, _t, id) {
    await setFlags(conn.id, id, { inTrash: false });
  },
  async archive(conn, _t, id) {
    await setFlags(conn.id, id, { archived: true });
    return { revertInfo: { archived: false } };
  },
  async applyLabel(conn, _t, id, label) {
    const [m] = await db().select().from(schema.messages).where(and(eq(schema.messages.connectionId, conn.id), eq(schema.messages.providerMessageId, id)));
    if (!m) throw new ProviderError("Message introuvable", "not_found", 404);
    await setFlags(conn.id, id, { labels: [...new Set([...m.labels, label])] });
  },

  async syncEvents() {
    return { upserts: [], deletedIds: [], cursor: { demo: true }, full: false };
  },

  async freeBusy(conn, _t, from, to) {
    const rows = await db()
      .select()
      .from(schema.events)
      .where(and(eq(schema.events.connectionId, conn.id), lte(schema.events.startAt, to), gte(schema.events.endAt, from), ne(schema.events.status, "cancelled")));
    return rows.filter((r) => r.showAs !== "free").map((r) => ({ start: r.startAt, end: r.endAt }));
  },

  async createEvent(conn, _t, ev, idempotencyKey): Promise<EventMeta> {
    const providerEventId = `demo-ev-${idempotencyKey}`;
    const meta: EventMeta = {
      providerEventId,
      calendarId: "primary",
      title: ev.title,
      start: ev.start,
      end: ev.end,
      allDay: false,
      timezone: ev.timezone,
      location: ev.location,
      onlineMeetingUrl: ev.addOnlineMeeting ? `https://visio.demo.invalid/${providerEventId.slice(-8)}` : null,
      attendees: ev.attendees.map((a) => ({ email: a.email, name: a.name, response: "needsAction" })),
      organizerEmail: conn.accountEmail,
      status: "confirmed",
      recurring: false,
      showAs: "busy",
    };
    return meta;
  },

  async updateEvent(conn, _t, providerEventId, patch) {
    const [row] = await db().select().from(schema.events).where(and(eq(schema.events.connectionId, conn.id), eq(schema.events.providerEventId, providerEventId)));
    if (!row) throw new ProviderError("Événement introuvable", "not_found", 404);
    return {
      providerEventId,
      calendarId: row.calendarId,
      title: patch.title ?? row.title,
      start: patch.start ?? row.startAt,
      end: patch.end ?? row.endAt,
      allDay: row.allDay,
      timezone: row.timezone,
      location: patch.location !== undefined ? patch.location : row.location,
      onlineMeetingUrl: row.onlineMeetingUrl,
      attendees: patch.attendees ? patch.attendees.map((a) => ({ email: a.email, name: a.name, response: "needsAction" })) : row.attendees,
      organizerEmail: row.organizerEmail,
      status: "confirmed",
      recurring: row.recurring,
      showAs: "busy",
    };
  },

  async cancelEvent(conn, _t, providerEventId) {
    await db()
      .update(schema.events)
      .set({ status: "cancelled" })
      .where(and(eq(schema.events.connectionId, conn.id), eq(schema.events.providerEventId, providerEventId)));
  },
};

async function setFlags(connectionId: string, providerMessageId: string, set: Partial<typeof schema.messages.$inferInsert>) {
  const r = await db()
    .update(schema.messages)
    .set(set)
    .where(and(eq(schema.messages.connectionId, connectionId), eq(schema.messages.providerMessageId, providerMessageId)))
    .returning({ id: schema.messages.id });
  if (!r.length) throw new ProviderError("Message introuvable", "not_found", 404);
}
