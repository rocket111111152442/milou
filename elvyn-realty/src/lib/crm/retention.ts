import "server-only";
import { lt } from "drizzle-orm";
import { env } from "@/config/env";
import { getDb, schema } from "@/lib/db";

/** Applies the retention rules. Returns how many rows were removed per category. */
export async function purgeExpired(now = new Date()) {
  const db = await getDb();
  const chatCutoff = new Date(now.getTime() - env.crm.chatRetentionDays * 86400_000);
  const chats = await db.delete(schema.chatSessions).where(lt(schema.chatSessions.updatedAt, chatCutoff)).returning({ id: schema.chatSessions.id });
  // Usage rows keep costs but lose the link to the conversation.
  await db.update(schema.aiUsage).set({ sessionId: null }).where(lt(schema.aiUsage.createdAt, chatCutoff));
  let contacts: { id: number }[] = [];
  if (env.crm.inactiveContactRetentionMonths > 0) {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - env.crm.inactiveContactRetentionMonths);
    contacts = await db.delete(schema.contacts).where(lt(schema.contacts.lastActivityAt, cutoff)).returning({ id: schema.contacts.id });
  }
  const notifCutoff = new Date(now.getTime() - 180 * 86400_000);
  const notifs = await db.delete(schema.notifications).where(lt(schema.notifications.createdAt, notifCutoff)).returning({ id: schema.notifications.id });
  return { chatSessions: chats.length, contacts: contacts.length, notifications: notifs.length };
}
