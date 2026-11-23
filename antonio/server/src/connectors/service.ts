import { and, eq, inArray, lt } from "drizzle-orm";
import type { Capability, ConnectionDTO, ProviderId } from "@antonio/shared";
import { db, getPool, schema } from "../db/client.js";
import { decryptSecret, encryptSecret, pkceChallenge, randomToken } from "../lib/crypto.js";
import { AppError, audit, badRequest, forbidden, notFound } from "../lib/audit.js";
import { publish } from "../realtime/hub.js";
import { enqueue, JOBS } from "../jobs/queue.js";
import { adapterFor } from "./registry.js";
import { type ConnectionRow, type EventMeta, type MessageMeta, ProviderError } from "./types.js";
import { providerConfigured } from "../config.js";

export interface Actor {
  userId: string;
  orgId: string;
}

/** Charge une connexion en vérifiant qu'elle appartient bien à l'utilisateur (isolation stricte). */
export async function getOwnedConnection(actor: Actor, connectionId: string): Promise<ConnectionRow> {
  const [conn] = await db()
    .select()
    .from(schema.connections)
    .where(and(eq(schema.connections.id, connectionId), eq(schema.connections.userId, actor.userId), eq(schema.connections.orgId, actor.orgId)));
  if (!conn) throw notFound("Connexion");
  return conn;
}

export function toConnectionDTO(c: ConnectionRow): ConnectionDTO {
  const ws = c.webhookState ?? {};
  const webhook = ws.gmailWatchExpiration || ws.calendarChannel || ws.graphSubscriptions ? "active" : c.provider === "demo" ? "none" : "polling";
  return {
    id: c.id,
    provider: c.provider as ProviderId,
    providerLabel: adapterFor(c.provider).label,
    accountEmail: c.accountEmail,
    status: c.status as ConnectionDTO["status"],
    capabilities: c.capabilities as Capability[],
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    lastError: c.lastError,
    isDemo: c.provider === "demo",
    webhook,
    createdAt: c.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// OAuth : autorisations progressives
// ---------------------------------------------------------------------------

export async function startOAuth(actor: Actor, provider: "google" | "microsoft", requested: Capability[], connectionId?: string) {
  if (!providerConfigured(provider)) {
    throw new AppError(
      503,
      "provider_not_configured",
      `Le connecteur ${provider === "google" ? "Google" : "Microsoft"} n'est pas configuré sur ce serveur (identifiants OAuth manquants). Voir docs/OAUTH.md.`,
    );
  }
  const adapter = adapterFor(provider);
  let existing: ConnectionRow | null = null;
  if (connectionId) existing = await getOwnedConnection(actor, connectionId);
  // On redemande l'union des capacités déjà accordées et des nouvelles (Google : include_granted_scopes).
  const caps = [...new Set([...(existing?.capabilities ?? []), ...requested])] as Capability[];
  const state = randomToken(24);
  const verifier = randomToken(48);
  await db()
    .insert(schema.oauthStates)
    .values({
      state,
      userId: actor.userId,
      orgId: actor.orgId,
      provider,
      capabilities: caps,
      codeVerifier: encryptSecret(verifier),
      connectionId: existing?.id ?? null,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
  return adapter.buildAuthUrl!({ state, codeChallenge: pkceChallenge(verifier), scopes: adapter.scopesFor(caps), loginHint: existing?.accountEmail });
}

export async function completeOAuth(provider: "google" | "microsoft", code: string, state: string): Promise<{ connection: ConnectionRow; userId: string }> {
  const [st] = await db().delete(schema.oauthStates).where(eq(schema.oauthStates.state, state)).returning();
  if (!st || st.provider !== provider) throw badRequest("État OAuth invalide ou déjà utilisé");
  if (st.expiresAt < new Date()) throw badRequest("La demande d'autorisation a expiré, recommencez.");
  const adapter = adapterFor(provider);
  const tokens = await adapter.exchangeCode!(code, decryptSecret(st.codeVerifier));
  const granted = adapter.capabilitiesFromScopes(tokens.scopes);
  const values = {
    orgId: st.orgId,
    userId: st.userId,
    provider,
    accountEmail: tokens.accountEmail,
    providerAccountId: tokens.providerAccountId,
    status: "active",
    grantedScopes: tokens.scopes,
    capabilities: granted,
    accessTokenEnc: encryptSecret(tokens.accessToken),
    tokenExpiresAt: tokens.expiresAt,
    lastError: null,
    updatedAt: new Date(),
  };
  const [connection] = await db()
    .insert(schema.connections)
    .values({ ...values, refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null })
    .onConflictDoUpdate({
      target: [schema.connections.userId, schema.connections.provider, schema.connections.accountEmail],
      set: { ...values, ...(tokens.refreshToken ? { refreshTokenEnc: encryptSecret(tokens.refreshToken) } : {}) },
    })
    .returning();
  await audit("connection.authorized", {
    orgId: st.orgId,
    userId: st.userId,
    meta: { provider, connectionId: connection.id, capabilities: granted, requested: st.capabilities },
  });
  await setupWebhooks(connection).catch((e) => console.warn("[webhooks]", (e as Error).message));
  await enqueue(JOBS.syncConnection, { connectionId: connection.id });
  return { connection, userId: st.userId };
}

// ---------------------------------------------------------------------------
// Jetons
// ---------------------------------------------------------------------------

export async function accessTokenFor(conn: ConnectionRow, forceRefresh = false): Promise<string> {
  if (conn.provider === "demo") return "demo";
  if (conn.status === "revoked") throw new ProviderError("Connexion révoquée", "auth");
  const valid = conn.accessTokenEnc && conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() > Date.now() + 30_000;
  if (valid && !forceRefresh) return decryptSecret(conn.accessTokenEnc!);
  if (!conn.refreshTokenEnc) {
    await markConnection(conn, "expired", "Autorisation expirée : reconnectez le compte.");
    throw new ProviderError("Aucun jeton de rafraîchissement", "auth");
  }
  const adapter = adapterFor(conn.provider);
  try {
    const r = await adapter.refreshAccessToken!(decryptSecret(conn.refreshTokenEnc));
    const set: Partial<typeof schema.connections.$inferInsert> = {
      accessTokenEnc: encryptSecret(r.accessToken),
      tokenExpiresAt: r.expiresAt,
      updatedAt: new Date(),
    };
    if (r.refreshToken) set.refreshTokenEnc = encryptSecret(r.refreshToken);
    if (r.scopes?.length) {
      set.grantedScopes = r.scopes;
      set.capabilities = adapter.capabilitiesFromScopes(r.scopes);
    }
    await db().update(schema.connections).set(set).where(eq(schema.connections.id, conn.id));
    Object.assign(conn, set);
    return r.accessToken;
  } catch (e) {
    if (e instanceof ProviderError && (e.kind === "invalid" || e.kind === "auth")) {
      await markConnection(conn, "expired", "Autorisation expirée ou révoquée chez le fournisseur : reconnectez le compte.");
    }
    throw e;
  }
}

/** Exécute un appel fournisseur avec un jeton valide ; un 401 déclenche un rafraîchissement unique. */
export async function withToken<T>(conn: ConnectionRow, fn: (token: string) => Promise<T>): Promise<T> {
  const token = await accessTokenFor(conn);
  try {
    return await fn(token);
  } catch (e) {
    if (e instanceof ProviderError && e.kind === "auth" && conn.provider !== "demo") {
      const fresh = await accessTokenFor(conn, true);
      try {
        return await fn(fresh);
      } catch (e2) {
        if (e2 instanceof ProviderError && e2.kind === "auth") await markConnection(conn, "expired", "Autorisation insuffisante ou expirée.");
        throw e2;
      }
    }
    throw e;
  }
}

async function markConnection(conn: ConnectionRow, status: string, error: string | null) {
  await db().update(schema.connections).set({ status, lastError: error, updatedAt: new Date() }).where(eq(schema.connections.id, conn.id));
  conn.status = status;
  conn.lastError = error;
  await publish(conn.userId, { type: "connection.changed", connectionId: conn.id });
}

export function requireCapability(conn: ConnectionRow, cap: Capability) {
  if (!conn.capabilities.includes(cap)) {
    throw forbidden(`La connexion ${conn.accountEmail} n'a pas la capacité « ${cap} ». Ajoutez cette autorisation dans Connexions.`);
  }
  if (conn.status !== "active") throw forbidden(`La connexion ${conn.accountEmail} n'est pas active (${conn.status}).`);
}

// ---------------------------------------------------------------------------
// Synchronisation (initiale et incrémentale)
// ---------------------------------------------------------------------------

/** Verrou consultatif : une seule synchronisation par connexion à la fois, même avec plusieurs workers. */
async function withSyncLock<T>(connectionId: string, fn: () => Promise<T>): Promise<T | null> {
  const client = await getPool().connect();
  try {
    const key = connectionId.replace(/-/g, "").slice(0, 15);
    const { rows } = await client.query("SELECT pg_try_advisory_lock(('x' || $1)::bit(60)::bigint) AS ok", [key]);
    if (!rows[0].ok) return null;
    try {
      return await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock(('x' || $1)::bit(60)::bigint)", [key]);
    }
  } finally {
    client.release();
  }
}

export async function syncConnection(connectionId: string): Promise<{ newMessageIds: string[] } | null> {
  const [conn] = await db().select().from(schema.connections).where(eq(schema.connections.id, connectionId));
  if (!conn || conn.status === "revoked") return null;
  return withSyncLock(connectionId, async () => {
    const adapter = adapterFor(conn.provider);
    const newMessageIds: string[] = [];
    let cursor = { ...(conn.syncState ?? {}) };
    try {
      if (conn.capabilities.includes("mail.read")) {
        const r = await withToken(conn, (t) => adapter.syncMail(conn, t, cursor));
        newMessageIds.push(...(await upsertMessages(conn, r.upserts)));
        if (r.deletedIds.length) {
          await db()
            .delete(schema.messages)
            .where(and(eq(schema.messages.connectionId, conn.id), inArray(schema.messages.providerMessageId, r.deletedIds)));
        }
        cursor = { ...cursor, ...r.cursor };
        if (r.upserts.length || r.deletedIds.length) await publish(conn.userId, { type: "messages.changed", connectionId: conn.id });
      }
      if (conn.capabilities.includes("calendar.read")) {
        const window = { from: new Date(Date.now() - 30 * 86400_000), to: new Date(Date.now() + 120 * 86400_000) };
        const r = await withToken(conn, (t) => adapter.syncEvents(conn, t, cursor, window));
        if (r.full && conn.provider !== "demo") await db().delete(schema.events).where(eq(schema.events.connectionId, conn.id));
        await upsertEvents(conn, r.upserts);
        if (r.deletedIds.length) {
          await db()
            .delete(schema.events)
            .where(and(eq(schema.events.connectionId, conn.id), inArray(schema.events.providerEventId, r.deletedIds)));
        }
        cursor = { ...cursor, ...r.cursor };
        if (r.upserts.length || r.deletedIds.length) await publish(conn.userId, { type: "events.changed", connectionId: conn.id });
      }
      await db()
        .update(schema.connections)
        .set({ syncState: cursor, lastSyncAt: new Date(), lastError: null, status: conn.status === "error" ? "active" : conn.status, updatedAt: new Date() })
        .where(eq(schema.connections.id, conn.id));
    } catch (e) {
      const msg = e instanceof ProviderError ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ""}` : (e as Error).message;
      const status = e instanceof ProviderError && e.kind === "auth" ? "expired" : "error";
      await markConnection(conn, conn.status === "expired" ? "expired" : status, `Synchronisation : ${msg}`);
      if (e instanceof ProviderError && (e.kind === "rate_limit" || e.kind === "transient")) {
        await enqueue(JOBS.syncConnection, { connectionId }, { delaySeconds: Math.ceil((e.retryAfterMs ?? 60_000) / 1000) });
      }
      return { newMessageIds };
    }
    for (const id of newMessageIds) await enqueue(JOBS.processMessage, { messageId: id });
    await publish(conn.userId, { type: "connection.changed", connectionId: conn.id });
    return { newMessageIds };
  });
}

/** Upsert idempotent : un même message reçu plusieurs fois ne crée qu'une ligne. Renvoie les nouveaux. */
export async function upsertMessages(conn: ConnectionRow, metas: MessageMeta[]): Promise<string[]> {
  const created: string[] = [];
  for (const m of metas) {
    const base = {
      providerThreadId: m.providerThreadId,
      internetMessageId: m.internetMessageId,
      fromEmail: m.from.email,
      fromName: m.from.name,
      toList: m.to,
      ccList: m.cc,
      subject: m.subject,
      snippet: m.snippet.slice(0, 400),
      receivedAt: m.receivedAt,
      unread: m.unread,
      inTrash: m.inTrash,
      archived: m.archived,
      isSent: m.isSent,
      labels: m.labels,
      folderId: m.folderId,
      hasAttachments: m.hasAttachments,
    };
    const [row] = await db()
      .insert(schema.messages)
      .values({ ...base, orgId: conn.orgId, userId: conn.userId, connectionId: conn.id, providerMessageId: m.providerMessageId })
      .onConflictDoUpdate({ target: [schema.messages.connectionId, schema.messages.providerMessageId], set: base })
      .returning({ id: schema.messages.id, processedAt: schema.messages.processedAt });
    if (!row.processedAt && !m.isSent) created.push(row.id);
    if (m.demoBody) await db().insert(schema.demoMailbox).values({ messageId: row.id, body: m.demoBody }).onConflictDoNothing();
  }
  return created;
}

export async function upsertEvents(conn: ConnectionRow, metas: EventMeta[]) {
  for (const e of metas) {
    const base = {
      calendarId: e.calendarId,
      title: e.title,
      startAt: e.start,
      endAt: e.end,
      allDay: e.allDay,
      timezone: e.timezone,
      location: e.location,
      onlineMeetingUrl: e.onlineMeetingUrl,
      attendees: e.attendees,
      organizerEmail: e.organizerEmail,
      status: e.status,
      recurring: e.recurring,
      showAs: e.showAs,
      updatedAt: new Date(),
    };
    await db()
      .insert(schema.events)
      .values({ ...base, orgId: conn.orgId, userId: conn.userId, connectionId: conn.id, providerEventId: e.providerEventId })
      .onConflictDoUpdate({ target: [schema.events.connectionId, schema.events.providerEventId], set: base });
  }
}

// ---------------------------------------------------------------------------
// Webhooks & révocation
// ---------------------------------------------------------------------------

export async function setupWebhooks(conn: ConnectionRow) {
  const adapter = adapterFor(conn.provider);
  if (!adapter.subscribe) return;
  const state = await withToken(conn, (t) => adapter.subscribe!(conn, t));
  await db().update(schema.connections).set({ webhookState: state }).where(eq(schema.connections.id, conn.id));
  conn.webhookState = state;
}

export async function renewExpiringWebhooks() {
  const soon = Date.now() + 36 * 3600_000;
  const conns = await db().select().from(schema.connections).where(eq(schema.connections.status, "active"));
  for (const c of conns) {
    if (c.provider === "demo") continue;
    const ws = c.webhookState ?? {};
    const expiries = [ws.gmailWatchExpiration, (ws.calendarChannel as { expiration?: number } | undefined)?.expiration, ws.graphExpiration].filter(
      (x): x is number => typeof x === "number",
    );
    if (expiries.length && Math.min(...expiries) > soon) continue;
    try {
      const adapter = adapterFor(c.provider);
      if (adapter.unsubscribe) await withToken(c, (t) => adapter.unsubscribe!(c, t)).catch(() => undefined);
      await setupWebhooks(c);
    } catch (e) {
      console.warn(`[webhooks] renouvellement ${c.id} : ${(e as Error).message}`);
    }
  }
}

export async function disconnect(actor: Actor, connectionId: string) {
  const conn = await getOwnedConnection(actor, connectionId);
  const adapter = adapterFor(conn.provider);
  if (conn.provider !== "demo" && conn.accessTokenEnc) {
    try {
      const token = await accessTokenFor(conn);
      if (adapter.unsubscribe) await adapter.unsubscribe(conn, token).catch(() => undefined);
      await adapter.revoke?.(conn, conn.refreshTokenEnc ? decryptSecret(conn.refreshTokenEnc) : token);
    } catch {
      /* la révocation locale a lieu même si le fournisseur est injoignable */
    }
  }
  // Annule les actions encore en attente sur ce compte.
  await db()
    .update(schema.actions)
    .set({ status: "cancelled", error: "Connexion révoquée", updatedAt: new Date() })
    .where(and(eq(schema.actions.connectionId, conn.id), inArray(schema.actions.status, ["proposed", "awaiting_approval", "authorized"])));
  // Les copies locales des données du compte sont supprimées.
  await db().delete(schema.messages).where(eq(schema.messages.connectionId, conn.id));
  await db().delete(schema.events).where(eq(schema.events.connectionId, conn.id));
  await db()
    .update(schema.connections)
    .set({ status: "revoked", accessTokenEnc: null, refreshTokenEnc: null, syncState: {}, webhookState: {}, capabilities: [], updatedAt: new Date() })
    .where(eq(schema.connections.id, conn.id));
  await audit("connection.revoked", { orgId: actor.orgId, userId: actor.userId, meta: { connectionId, provider: conn.provider } });
  await publish(actor.userId, { type: "connection.changed", connectionId });
}

export async function cleanupExpiredOAuthStates() {
  await db().delete(schema.oauthStates).where(lt(schema.oauthStates.expiresAt, new Date()));
}
