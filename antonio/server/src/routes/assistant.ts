import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { actorOf } from "../app.js";
import { db, schema } from "../db/client.js";
import { runTurn } from "../agent/orchestrator.js";
import { createVoiceSession, handleDelegation, reportUsage, transcribe } from "../voice/service.js";
import { subscribe } from "../realtime/hub.js";
import { config } from "../config.js";

export async function assistantRoutes(app: FastifyInstance) {
  app.post("/api/assistant/message", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => {
    const u = actorOf(req);
    const body = z.object({ text: z.string().min(1).max(4000), conversationId: z.string().uuid().nullable().optional() }).parse(req.body);
    return runTurn(u, { text: body.text, conversationId: body.conversationId, channel: "chat" });
  });

  app.get("/api/assistant/conversation", async (req) => {
    const u = actorOf(req);
    const [conv] = await db().select().from(schema.conversations).where(eq(schema.conversations.userId, u.userId)).orderBy(desc(schema.conversations.lastActivityAt)).limit(1);
    if (!conv) return { conversationId: null, turns: [] };
    const turns = await db()
      .select({ id: schema.turns.id, role: schema.turns.role, content: schema.turns.content, channel: schema.turns.channel, uiEvents: schema.turns.uiEvents, createdAt: schema.turns.createdAt })
      .from(schema.turns)
      .where(eq(schema.turns.conversationId, conv.id))
      .orderBy(desc(schema.turns.createdAt))
      .limit(40);
    return { conversationId: conv.id, turns: turns.reverse() };
  });

  /** Effacer les transcriptions (la conservation est aussi configurable dans le profil). */
  app.delete("/api/assistant/conversations", async (req) => {
    const u = actorOf(req);
    await db().delete(schema.conversations).where(eq(schema.conversations.userId, u.userId));
    return { ok: true };
  });

  // ----------------------------------------------------------------- Voix
  app.get("/api/voice/capabilities", async (req) => {
    actorOf(req);
    return {
      available: Boolean(config().OPENAI_API_KEY),
      model: config().OPENAI_LIVE_MODEL,
      backendModel: config().OPENAI_TEXT_MODEL,
      audioRecording: false,
    };
  });
  app.post("/api/voice/session", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const body = z.object({ sdp: z.string().min(10).max(65536) }).parse(req.body);
    return createVoiceSession(actorOf(req), body.sdp);
  });
  app.post("/api/voice/delegate", async (req) => {
    const body = z.object({ voiceSessionId: z.string().uuid(), utterance: z.string().max(4000) }).parse(req.body);
    return handleDelegation(actorOf(req), body.voiceSessionId, body.utterance);
  });
  app.post("/api/voice/usage", async (req) => {
    const body = z.object({ voiceSessionId: z.string().uuid(), seconds: z.number().min(0).max(86400), final: z.boolean().default(false), reason: z.string().max(60).optional() }).parse(req.body);
    return reportUsage(actorOf(req), body.voiceSessionId, body.seconds, body.final, body.reason);
  });

  app.addContentTypeParser(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"], { parseAs: "buffer", bodyLimit: 8 * 1024 * 1024 }, (_req, body, done) =>
    done(null, body),
  );
  app.post("/api/voice/transcribe", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req) => {
    const seconds = Number((req.query as { seconds?: string }).seconds ?? 10);
    return transcribe(actorOf(req), req.body as Buffer, String(req.headers["content-type"] ?? "audio/webm").split(";")[0], Math.min(Math.max(seconds, 1), 300));
  });

  // ------------------------------------------------- Temps réel (SSE)
  app.get("/api/stream", async (req, reply) => {
    const u = actorOf(req);
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write(`event: ready\ndata: {}\n\n`);
    const unsubscribe = subscribe(u.userId, (event) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`));
    const ping = setInterval(() => reply.raw.write(`: ping\n\n`), 25_000);
    req.raw.on("close", () => {
      clearInterval(ping);
      unsubscribe();
    });
    return reply;
  });

  void and;
}
