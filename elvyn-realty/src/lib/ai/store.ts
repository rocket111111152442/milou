import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Handoff, Profile } from "./tools";

export interface ChatSessionState {
  id: string;
  lang: string;
  propertySlug: string | null;
  profile: Profile;
  seenSlugs: string[];
  handoff: Handoff | null;
  contactId: number | null;
  userTurns: number;
}

export async function loadSession(id: string): Promise<ChatSessionState | null> {
  const db = await getDb();
  const [s] = await db.select().from(schema.chatSessions).where(eq(schema.chatSessions.id, id));
  if (!s) return null;
  return {
    id: s.id,
    lang: s.lang,
    propertySlug: s.propertySlug,
    profile: (s.profile ?? {}) as Profile,
    seenSlugs: s.seenSlugs ?? [],
    handoff: (s.handoff ?? null) as Handoff | null,
    contactId: s.contactId,
    userTurns: s.userTurns,
  };
}

export async function createSession(id: string, lang: string): Promise<ChatSessionState> {
  const db = await getDb();
  await db.insert(schema.chatSessions).values({ id, lang }).onConflictDoNothing();
  return { id, lang, propertySlug: null, profile: {}, seenSlugs: [], handoff: null, contactId: null, userTurns: 0 };
}

/** Model transcript, replayed verbatim (append-only: preserves thinking blocks and cache prefix). */
export async function loadTranscript(id: string): Promise<{ role: string; content: unknown }[]> {
  const db = await getDb();
  const rows = await db.select({ role: schema.chatMessages.role, content: schema.chatMessages.content }).from(schema.chatMessages).where(eq(schema.chatMessages.sessionId, id)).orderBy(asc(schema.chatMessages.seq));
  return rows;
}

export async function loadDisplay(id: string) {
  const db = await getDb();
  const rows = await db
    .select({ role: schema.chatMessages.role, display: schema.chatMessages.display })
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.sessionId, id))
    .orderBy(asc(schema.chatMessages.seq));
  return rows.filter((r) => r.display).map((r) => ({ role: r.role, ...(r.display as Record<string, unknown>) }));
}

/** Persists a whole successful turn atomically, then the session state. */
export async function saveTurn(
  state: ChatSessionState,
  messages: { role: string; content: unknown; display?: Record<string, unknown> | null }[],
) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${schema.chatMessages.seq}), 0)` }).from(schema.chatMessages).where(eq(schema.chatMessages.sessionId, state.id));
    let seq = Number(max);
    for (const m of messages) {
      seq++;
      await tx.insert(schema.chatMessages).values({ sessionId: state.id, seq, role: m.role, content: m.content as object, display: m.display ?? null });
    }
    await tx
      .update(schema.chatSessions)
      .set({ profile: state.profile, seenSlugs: state.seenSlugs.slice(-200), handoff: state.handoff as Record<string, unknown> | null, propertySlug: state.propertySlug, userTurns: state.userTurns, lang: state.lang, updatedAt: new Date() })
      .where(eq(schema.chatSessions.id, state.id));
  });
}

export async function updateSessionState(state: ChatSessionState) {
  const db = await getDb();
  await db
    .update(schema.chatSessions)
    .set({ profile: state.profile, handoff: state.handoff as Record<string, unknown> | null, contactId: state.contactId, updatedAt: new Date() })
    .where(eq(schema.chatSessions.id, state.id));
}

/** Deletes a conversation that is not linked to a prospect (visitor pressed "new conversation"). */
export async function discardSession(id: string) {
  const db = await getDb();
  const [s] = await db.select({ contactId: schema.chatSessions.contactId }).from(schema.chatSessions).where(eq(schema.chatSessions.id, id));
  if (s && !s.contactId) await db.delete(schema.chatSessions).where(eq(schema.chatSessions.id, id));
}
