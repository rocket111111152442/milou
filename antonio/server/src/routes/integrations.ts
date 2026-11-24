import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { z } from "zod";
import { actorOf } from "../app.js";
import { db, schema } from "../db/client.js";
import { AppError, notFound } from "../lib/audit.js";
import { randomToken, sha256 } from "../lib/crypto.js";

/** Personal read-only API: explicit, revocable access for any HTTP automation tool. */
export async function integrationRoutes(app: FastifyInstance) {
  app.get("/api/integrations/tokens", async (req) => {
    const user = actorOf(req);
    const tokens = await db().select({ id: schema.integrationTokens.id, name: schema.integrationTokens.name, createdAt: schema.integrationTokens.createdAt, expiresAt: schema.integrationTokens.expiresAt, revokedAt: schema.integrationTokens.revokedAt }).from(schema.integrationTokens).where(eq(schema.integrationTokens.userId, user.userId)).orderBy(desc(schema.integrationTokens.createdAt));
    return { tokens };
  });
  app.post("/api/integrations/tokens", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req) => {
    const user = actorOf(req);
    const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(req.body);
    const token = `wvt_${randomToken(32)}`;
    const expiresAt = new Date(Date.now() + 30 * 86400_000);
    const [row] = await db().insert(schema.integrationTokens).values({ userId: user.userId, name, tokenHash: sha256(token), expiresAt }).returning({ id: schema.integrationTokens.id });
    return { id: row.id, token, expiresAt, scope: "tasks_and_events:read" };
  });
  app.delete("/api/integrations/tokens/:id", async (req) => {
    const user = actorOf(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const result = await db().update(schema.integrationTokens).set({ revokedAt: new Date() }).where(and(eq(schema.integrationTokens.id, id), eq(schema.integrationTokens.userId, user.userId))).returning({ id: schema.integrationTokens.id });
    if (!result.length) throw notFound("Connexion API");
    return { ok: true };
  });
  app.get("/api/integrations/export", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req, reply) => {
    const token = req.headers.authorization?.match(/^Bearer (wvt_[A-Za-z0-9_-]+)$/)?.[1];
    if (!token) throw new AppError(401, "invalid_token", "Un jeton personnel de lecture est requis.");
    const [owner] = await db().select().from(schema.integrationTokens).where(and(eq(schema.integrationTokens.tokenHash, sha256(token)), isNull(schema.integrationTokens.revokedAt), gte(schema.integrationTokens.expiresAt, new Date())));
    if (!owner) throw new AppError(401, "invalid_token", "Jeton invalide, expiré ou révoqué.");
    const tasks = await db().select({ id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status, dueAt: schema.tasks.dueAt }).from(schema.tasks).where(eq(schema.tasks.userId, owner.userId)).limit(200);
    const events = await db().select({ id: schema.events.id, title: schema.events.title, startAt: schema.events.startAt, endAt: schema.events.endAt }).from(schema.events).where(and(eq(schema.events.userId, owner.userId), gte(schema.events.startAt, new Date()))).orderBy(schema.events.startAt).limit(100);
    const demo = await db().select({ id: schema.connections.id }).from(schema.connections).where(and(eq(schema.connections.userId, owner.userId), eq(schema.connections.provider, "demo"), eq(schema.connections.status, "active"))).limit(1);
    reply.header("Cache-Control", "no-store");
    return { generatedAt: new Date().toISOString(), hasDemoData: demo.length > 0, tasks, events, scope: "tasks_and_events:read" };
  });
}
