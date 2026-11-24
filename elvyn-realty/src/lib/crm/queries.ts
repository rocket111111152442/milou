import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export interface LeadFilters {
  q?: string;
  status?: string;
  intent?: string;
  temperature?: string;
  priority?: boolean;
  from?: string;
  to?: string;
  page?: number;
}

export const ADMIN_PAGE_SIZE = 25;

export async function listContacts(f: LeadFilters) {
  const db = await getDb();
  const c = schema.contacts;
  const conds: SQL[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(c.fullName, like), ilike(c.email, like), ilike(c.phone, like), ilike(c.summary, like))!);
  }
  if (f.status) conds.push(eq(c.status, f.status));
  if (f.temperature) conds.push(eq(c.temperature, f.temperature));
  if (f.intent) conds.push(sql`${c.criteria}->>'intent' = ${f.intent}`);
  if (f.priority) conds.push(eq(c.priority, true));
  if (f.from) conds.push(gte(c.createdAt, new Date(f.from)));
  if (f.to) conds.push(lte(c.createdAt, new Date(`${f.to}T23:59:59`)));
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, f.page ?? 1);
  const [rows, [{ n }]] = await Promise.all([
    db.select().from(c).where(where).orderBy(desc(c.lastActivityAt)).limit(ADMIN_PAGE_SIZE).offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: sql<number>`count(*)` }).from(c).where(where),
  ]);
  return { rows, total: Number(n), page, pages: Math.max(1, Math.ceil(Number(n) / ADMIN_PAGE_SIZE)) };
}

export async function getContactDetail(id: number) {
  const db = await getDb();
  const [contact] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, id));
  if (!contact) return null;
  const [inquiries, appointments, notes, activities, chats, notifications] = await Promise.all([
    db.select().from(schema.inquiries).where(eq(schema.inquiries.contactId, id)).orderBy(desc(schema.inquiries.createdAt)),
    db.select().from(schema.appointments).where(eq(schema.appointments.contactId, id)).orderBy(desc(schema.appointments.createdAt)),
    db.select({ id: schema.notes.id, body: schema.notes.body, createdAt: schema.notes.createdAt, author: schema.adminUsers.name }).from(schema.notes).leftJoin(schema.adminUsers, eq(schema.notes.authorId, schema.adminUsers.id)).where(eq(schema.notes.contactId, id)).orderBy(desc(schema.notes.createdAt)),
    db.select().from(schema.activities).where(eq(schema.activities.contactId, id)).orderBy(desc(schema.activities.createdAt)).limit(100),
    db.select({ id: schema.chatSessions.id }).from(schema.chatSessions).where(eq(schema.chatSessions.contactId, id)),
    db.select().from(schema.notifications).where(eq(schema.notifications.contactId, id)).orderBy(desc(schema.notifications.createdAt)).limit(30),
  ]);
  const transcripts = chats.length
    ? await db
        .select({ sessionId: schema.chatMessages.sessionId, seq: schema.chatMessages.seq, role: schema.chatMessages.role, display: schema.chatMessages.display, createdAt: schema.chatMessages.createdAt })
        .from(schema.chatMessages)
        .where(inArray(schema.chatMessages.sessionId, chats.map((c) => c.id)))
        .orderBy(asc(schema.chatMessages.createdAt), asc(schema.chatMessages.seq))
    : [];
  return { contact, inquiries, appointments, notes, activities, transcripts: transcripts.filter((t) => t.display), notifications };
}

export async function dashboardData() {
  const db = await getDb();
  const c = schema.contacts;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      nuevos: sql<number>`count(*) filter (where ${c.status} = 'nuevo')`,
      calientes: sql<number>`count(*) filter (where ${c.temperature} = 'caliente' and ${c.status} not in ('ganado','perdido'))`,
      prioritarios: sql<number>`count(*) filter (where ${c.priority} and ${c.status} not in ('ganado','perdido'))`,
      semana: sql<number>`count(*) filter (where ${c.createdAt} >= ${weekAgo.toISOString()})`,
      vencidas: sql<number>`count(*) filter (where ${c.nextActionAt} < ${now.toISOString()} and ${c.status} not in ('ganado','perdido'))`,
    })
    .from(c);
  const pendingVisits = await db
    .select({ a: schema.appointments, name: c.fullName })
    .from(schema.appointments)
    .innerJoin(c, eq(c.id, schema.appointments.contactId))
    .where(eq(schema.appointments.status, "solicitada"))
    .orderBy(asc(schema.appointments.createdAt))
    .limit(10);
  const upcoming = await db
    .select({ a: schema.appointments, name: c.fullName })
    .from(schema.appointments)
    .innerJoin(c, eq(c.id, schema.appointments.contactId))
    .where(and(eq(schema.appointments.status, "confirmada"), gte(schema.appointments.startsAt, now)))
    .orderBy(asc(schema.appointments.startsAt))
    .limit(10);
  const nextActions = await db
    .select()
    .from(c)
    .where(sql`${c.nextActionAt} is not null and ${c.status} not in ('ganado','perdido')`)
    .orderBy(asc(c.nextActionAt))
    .limit(10);
  const recent = await db
    .select({ i: schema.inquiries, name: c.fullName, temperature: c.temperature, priority: c.priority })
    .from(schema.inquiries)
    .innerJoin(c, eq(c.id, schema.inquiries.contactId))
    .orderBy(desc(schema.inquiries.createdAt))
    .limit(10);
  return { counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)])) as Record<string, number>, pendingVisits, upcoming, nextActions, recent };
}

export async function listAppointments(status?: string) {
  const db = await getDb();
  const c = schema.contacts;
  return db
    .select({ a: schema.appointments, name: c.fullName, phone: c.phone, email: c.email })
    .from(schema.appointments)
    .innerJoin(c, eq(c.id, schema.appointments.contactId))
    .where(status ? eq(schema.appointments.status, status) : undefined)
    .orderBy(sql`${schema.appointments.startsAt} asc nulls first`, desc(schema.appointments.createdAt))
    .limit(200);
}

export async function listNotifications() {
  const db = await getDb();
  return db.select().from(schema.notifications).orderBy(desc(schema.notifications.createdAt)).limit(200);
}

/** Everything stored about one contact, for a data-access request. */
export async function exportContact(id: number) {
  const d = await getContactDetail(id);
  if (!d) return null;
  return {
    exportedAt: new Date().toISOString(),
    contact: d.contact,
    inquiries: d.inquiries,
    appointments: d.appointments,
    notes: d.notes,
    activities: d.activities,
    conversations: d.transcripts.map((t) => ({ at: t.createdAt, role: t.role, ...(t.display as object) })),
    notifications: d.notifications.map((n) => ({ event: n.event, channel: n.channel, status: n.status, createdAt: n.createdAt })),
  };
}

export async function deleteContact(id: number) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.chatSessions).where(eq(schema.chatSessions.contactId, id));
    await tx.delete(schema.contacts).where(eq(schema.contacts.id, id));
  });
}
