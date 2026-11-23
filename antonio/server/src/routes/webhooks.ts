import type { FastifyInstance } from "fastify";
import { handleGmailPush, handleGoogleCalendarPush, handleGraphNotifications, verifyPubSubToken } from "../webhooks/service.js";

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/api/webhooks/google/pubsub", async (req, reply) => {
    if (!(await verifyPubSubToken(req.headers.authorization))) return reply.status(401).send({ error: "invalid_token" });
    await handleGmailPush(req.body as never);
    return reply.status(204).send();
  });

  app.post("/api/webhooks/google/calendar", async (req, reply) => {
    const r = await handleGoogleCalendarPush(req.headers);
    return reply.status(r.ok ? 200 : 401).send();
  });

  // Microsoft Graph : poignée de main de validation puis notifications (clientState vérifié).
  const graph = async (req: { query: unknown; body: unknown }, reply: import("fastify").FastifyReply) => {
    const token = (req.query as { validationToken?: string }).validationToken;
    if (token) return reply.status(200).header("Content-Type", "text/plain").send(token);
    // Répondre vite (Graph attend < 3 s) ; la synchronisation est mise en file.
    await handleGraphNotifications((req.body as never) ?? {});
    return reply.status(202).send();
  };
  app.post("/api/webhooks/microsoft", graph);
  app.post("/api/webhooks/microsoft/lifecycle", graph);
}
