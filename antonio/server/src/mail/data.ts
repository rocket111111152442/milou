import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { EventDTO, Extracted, MailCategory, MessageDetailDTO, MessageDTO, TaskDTO } from "@antonio/shared";
import { db, schema } from "../db/client.js";
import { notFound } from "../lib/audit.js";
import { adapterFor } from "../connectors/registry.js";
import { withToken, type Actor } from "../connectors/service.js";

type MsgRow = typeof schema.messages.$inferSelect;
type EvRow = typeof schema.events.$inferSelect;

/** Toute lecture filtre sur userId ET orgId : isolation stricte entre comptes. */
const own = (actor: Actor) => and(eq(schema.messages.userId, actor.userId), eq(schema.messages.orgId, actor.orgId));

async function demoConnectionIds(actor: Actor): Promise<Set<string>> {
  const rows = await db()
    .select({ id: schema.connections.id })
    .from(schema.connections)
    .where(and(eq(schema.connections.userId, actor.userId), eq(schema.connections.provider, "demo")));
  return new Set(rows.map((r) => r.id));
}

export function toMessageDTO(m: MsgRow, demo: Set<string>): MessageDTO {
  return {
    id: m.id,
    connectionId: m.connectionId,
    threadId: m.providerThreadId,
    from: { name: m.fromName, email: m.fromEmail },
    to: m.toList,
    subject: m.subject,
    snippet: m.snippet,
    receivedAt: m.receivedAt.toISOString(),
    unread: m.unread,
    category: m.category as MailCategory,
    categoryReason: m.categoryReason,
    categorySource: m.categorySource as MessageDTO["categorySource"],
    needsAction: m.needsAction,
    inTrash: m.inTrash,
    hasAttachments: m.hasAttachments,
    extracted: (m.extracted as Extracted) ?? null,
    simulated: demo.has(m.connectionId),
  };
}

export interface MessageQuery {
  category?: MailCategory;
  needsAction?: boolean;
  includeTrash?: boolean;
  onlyTrash?: boolean;
  sent?: boolean;
  fromContains?: string;
  text?: string;
  since?: Date;
  limit?: number;
  ids?: string[];
}

export async function listMessages(actor: Actor, q: MessageQuery = {}): Promise<MessageDTO[]> {
  const conds = [own(actor)];
  if (q.ids) {
    if (!q.ids.length) return [];
    conds.push(inArray(schema.messages.id, q.ids));
  }
  if (q.category) conds.push(eq(schema.messages.category, q.category));
  if (q.needsAction !== undefined) conds.push(eq(schema.messages.needsAction, q.needsAction));
  if (q.onlyTrash) conds.push(eq(schema.messages.inTrash, true));
  else if (!q.includeTrash && !q.ids) conds.push(eq(schema.messages.inTrash, false));
  if (q.sent !== undefined) conds.push(eq(schema.messages.isSent, q.sent));
  if (q.since) conds.push(gte(schema.messages.receivedAt, q.since));
  if (q.fromContains) {
    const like = `%${q.fromContains.toLowerCase()}%`;
    conds.push(sql`(lower(${schema.messages.fromEmail}) like ${like} or lower(coalesce(${schema.messages.fromName}, '')) like ${like})`);
  }
  if (q.text) {
    const like = `%${q.text.toLowerCase()}%`;
    conds.push(
      sql`(lower(${schema.messages.subject}) like ${like} or lower(${schema.messages.snippet}) like ${like} or lower(${schema.messages.fromEmail}) like ${like} or lower(coalesce(${schema.messages.fromName}, '')) like ${like})`,
    );
  }
  const rows = await db()
    .select()
    .from(schema.messages)
    .where(and(...conds))
    .orderBy(desc(schema.messages.receivedAt))
    .limit(q.limit ?? 50);
  const demo = await demoConnectionIds(actor);
  return rows.map((r) => toMessageDTO(r, demo));
}

/** Contenu lu à la demande chez le fournisseur (non stocké). */
export async function getMessageDetail(actor: Actor, id: string): Promise<MessageDetailDTO> {
  const [m] = await db()
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.id, id), own(actor)));
  if (!m) throw notFound("Message");
  const [conn] = await db().select().from(schema.connections).where(eq(schema.connections.id, m.connectionId));
  let body = m.snippet;
  if (conn && conn.status !== "revoked") {
    try {
      const b = await withToken(conn, (t) => adapterFor(conn.provider).getMessageBody(conn, t, m.providerMessageId));
      body = b.text;
      if (b.attachments.length) body += `\n\n[Pièces jointes : ${b.attachments.map((a) => a.name).join(", ")} — accès via le fournisseur]`;
    } catch {
      body = `${m.snippet}\n\n[Contenu complet indisponible : le fournisseur n'a pas répondu]`;
    }
  }
  if (m.unread) await db().update(schema.messages).set({ unread: false }).where(eq(schema.messages.id, m.id));
  const threadRows = await db()
    .select()
    .from(schema.messages)
    .where(and(own(actor), eq(schema.messages.connectionId, m.connectionId), eq(schema.messages.providerThreadId, m.providerThreadId)))
    .orderBy(asc(schema.messages.receivedAt));
  const demo = await demoConnectionIds(actor);
  return { ...toMessageDTO(m, demo), body, thread: threadRows.map((r) => toMessageDTO(r, demo)) };
}

/** Fils où le dernier message est de l'utilisateur et sans réponse depuis N jours. */
export async function awaitingReplies(actor: Actor, days: number): Promise<MessageDTO[]> {
  const cutoff = new Date(Date.now() - days * 86400_000);
  const sent = await db()
    .select()
    .from(schema.messages)
    .where(and(own(actor), eq(schema.messages.isSent, true), lte(schema.messages.receivedAt, cutoff)))
    .orderBy(desc(schema.messages.receivedAt))
    .limit(100);
  const out: MsgRow[] = [];
  for (const s of sent) {
    const [later] = await db()
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(and(eq(schema.messages.connectionId, s.connectionId), eq(schema.messages.providerThreadId, s.providerThreadId), sql`${schema.messages.receivedAt} > ${s.receivedAt.toISOString()}::timestamptz`))
      .limit(1);
    if (!later) out.push(s);
  }
  // Demandes reçues non traitées depuis N jours.
  const received = await db()
    .select()
    .from(schema.messages)
    .where(and(own(actor), eq(schema.messages.isSent, false), eq(schema.messages.needsAction, true), eq(schema.messages.inTrash, false), lte(schema.messages.receivedAt, cutoff)))
    .limit(50);
  for (const r of received) {
    const [reply] = await db()
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(and(eq(schema.messages.connectionId, r.connectionId), eq(schema.messages.providerThreadId, r.providerThreadId), eq(schema.messages.isSent, true)))
      .limit(1);
    if (!reply) out.push(r);
  }
  const demo = await demoConnectionIds(actor);
  return out.map((r) => toMessageDTO(r, demo));
}

export function toEventDTO(e: EvRow, demo: Set<string>): EventDTO {
  return {
    id: e.id,
    connectionId: e.connectionId,
    title: e.title,
    start: e.startAt.toISOString(),
    end: e.endAt.toISOString(),
    allDay: e.allDay,
    timezone: e.timezone,
    location: e.location,
    onlineMeetingUrl: e.onlineMeetingUrl,
    attendees: e.attendees as EventDTO["attendees"],
    organizerEmail: e.organizerEmail,
    status: e.status as EventDTO["status"],
    recurring: e.recurring,
    simulated: demo.has(e.connectionId),
  };
}

export async function listEvents(actor: Actor, from: Date, to: Date, ids?: string[]): Promise<EventDTO[]> {
  const conds = [eq(schema.events.userId, actor.userId), eq(schema.events.orgId, actor.orgId), sql`${schema.events.status} <> 'cancelled'`];
  if (ids) conds.push(inArray(schema.events.id, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]));
  else conds.push(lte(schema.events.startAt, to), gte(schema.events.endAt, from));
  const rows = await db()
    .select()
    .from(schema.events)
    .where(and(...conds))
    .orderBy(asc(schema.events.startAt))
    .limit(200);
  const demo = await demoConnectionIds(actor);
  return rows.map((r) => toEventDTO(r, demo));
}

export async function listTasks(actor: Actor, opts: { status?: "open" | "done"; ids?: string[] } = {}): Promise<TaskDTO[]> {
  const conds = [eq(schema.tasks.userId, actor.userId), eq(schema.tasks.orgId, actor.orgId)];
  if (opts.status) conds.push(eq(schema.tasks.status, opts.status));
  if (opts.ids) conds.push(inArray(schema.tasks.id, opts.ids.length ? opts.ids : ["00000000-0000-0000-0000-000000000000"]));
  const rows = await db()
    .select()
    .from(schema.tasks)
    .where(and(...conds))
    .orderBy(asc(schema.tasks.status), desc(schema.tasks.createdAt))
    .limit(200);
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    notes: t.notes,
    dueAt: t.dueAt?.toISOString() ?? null,
    status: t.status as TaskDTO["status"],
    createdBy: t.createdBy as TaskDTO["createdBy"],
    sourceMessageId: t.sourceMessageId,
    createdAt: t.createdAt.toISOString(),
  }));
}
