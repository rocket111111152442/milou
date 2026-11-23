import { timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config.js";
import { db, schema } from "../db/client.js";
import { sha256 } from "../lib/crypto.js";
import { enqueue, JOBS } from "../jobs/queue.js";

/**
 * Webhooks : les fournisseurs livrent « au moins une fois ». Chaque notification
 * est authentifiée, dédupliquée (webhook_receipts) et ne fait que DÉCLENCHER une
 * synchronisation : son contenu n'est jamais pris pour argent comptant.
 */

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const safeEqual = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

/** Renvoie true si la notification est nouvelle (première réception). */
export async function firstReceipt(provider: string, key: string): Promise<boolean> {
  const r = await db()
    .insert(schema.webhookReceipts)
    .values({ provider, dedupeKey: sha256(`${provider}:${key}`) })
    .onConflictDoNothing()
    .returning();
  return r.length > 0;
}

export async function verifyPubSubToken(authorization: string | undefined): Promise<boolean> {
  const c = config();
  if (!authorization?.startsWith("Bearer ") || !c.GOOGLE_PUBSUB_AUDIENCE) return false;
  try {
    const { payload } = await jwtVerify(authorization.slice(7), googleJwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: c.GOOGLE_PUBSUB_AUDIENCE,
    });
    if (c.GOOGLE_PUBSUB_SERVICE_ACCOUNT && payload.email !== c.GOOGLE_PUBSUB_SERVICE_ACCOUNT) return false;
    return payload.email_verified === true || payload.email_verified === "true";
  } catch {
    return false;
  }
}

export async function handleGmailPush(body: { message?: { data?: string; messageId?: string; message_id?: string } }) {
  const msgId = body.message?.messageId ?? body.message?.message_id;
  if (!body.message?.data || !msgId) return { accepted: false };
  if (!(await firstReceipt("google-pubsub", msgId))) return { accepted: true, duplicate: true };
  const data = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf8")) as { emailAddress?: string; historyId?: string | number };
  if (!data.emailAddress) return { accepted: false };
  const conns = await db()
    .select({ id: schema.connections.id })
    .from(schema.connections)
    .where(and(eq(schema.connections.provider, "google"), eq(schema.connections.accountEmail, data.emailAddress.toLowerCase()), eq(schema.connections.status, "active")));
  for (const c of conns) await enqueue(JOBS.syncConnection, { connectionId: c.id });
  return { accepted: true, connections: conns.length };
}

export async function handleGoogleCalendarPush(headers: Record<string, string | string[] | undefined>) {
  const channelId = String(headers["x-goog-channel-id"] ?? "");
  const token = String(headers["x-goog-channel-token"] ?? "");
  const state = String(headers["x-goog-resource-state"] ?? "");
  const number = String(headers["x-goog-message-number"] ?? "");
  if (!channelId) return { ok: false };
  const [conn] = await db()
    .select()
    .from(schema.connections)
    .where(sql`${schema.connections.webhookState}->'calendarChannel'->>'id' = ${channelId}`);
  const expected = (conn?.webhookState.calendarChannel as { token?: string } | undefined)?.token;
  if (!conn || !expected || !safeEqual(expected, token)) return { ok: false };
  if (state === "sync") return { ok: true };
  if (!(await firstReceipt("google-calendar", `${channelId}:${number}`))) return { ok: true, duplicate: true };
  await enqueue(JOBS.syncConnection, { connectionId: conn.id });
  return { ok: true };
}

interface GraphNotification {
  subscriptionId: string;
  clientState?: string;
  changeType?: string;
  resource?: string;
  lifecycleEvent?: string;
  subscriptionExpirationDateTime?: string;
}

export async function handleGraphNotifications(body: { value?: GraphNotification[] }) {
  let accepted = 0;
  const toSync = new Set<string>();
  for (const n of body.value ?? []) {
    const [conn] = await db()
      .select()
      .from(schema.connections)
      .where(
        sql`${schema.connections.webhookState}->'graphSubscriptions'->>'mail' = ${n.subscriptionId} or ${schema.connections.webhookState}->'graphSubscriptions'->>'calendar' = ${n.subscriptionId}`,
      );
    const expected = conn?.webhookState.graphClientState as string | undefined;
    // clientState inconnu ou différent : notification rejetée (falsification possible).
    if (!conn || !expected || !n.clientState || !safeEqual(expected, n.clientState)) continue;
    accepted++;
    if (n.lifecycleEvent) {
      await enqueue(JOBS.renewWebhooks, {});
      if (n.lifecycleEvent === "missed") toSync.add(conn.id);
      continue;
    }
    // Graph ne fournit pas d'identifiant de notification : déduplication par fenêtre d'une minute.
    // De toute façon une synchronisation en double est sans effet (verrou, upsert, idempotence des actions).
    if (!(await firstReceipt("graph", JSON.stringify([n.subscriptionId, n.changeType, n.resource, Math.floor(Date.now() / 60_000)])))) continue;
    toSync.add(conn.id);
  }
  for (const id of toSync) await enqueue(JOBS.syncConnection, { connectionId: id });
  return { accepted };
}
