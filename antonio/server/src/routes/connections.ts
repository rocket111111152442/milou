import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { CAPABILITIES } from "@antonio/shared";
import { actorOf } from "../app.js";
import { config, providerConfigured, apiPublicUrl } from "../config.js";
import { db, schema } from "../db/client.js";
import { allDescriptors } from "../connectors/registry.js";
import { completeOAuth, disconnect, getOwnedConnection, startOAuth, syncConnection, toConnectionDTO } from "../connectors/service.js";
import { createDemoConnection } from "../connectors/demo/seed.js";
import { enqueue, JOBS } from "../jobs/queue.js";

export async function connectionRoutes(app: FastifyInstance) {
  app.get("/api/connectors", async (req) => {
    actorOf(req);
    return {
      connectors: allDescriptors(),
      setup: {
        google: providerConfigured("google"),
        microsoft: providerConfigured("microsoft"),
        openai: providerConfigured("openai"),
        // Valeurs à déclarer chez les fournisseurs (non secrètes).
        redirectUris: { google: `${apiPublicUrl()}/api/oauth/google/callback`, microsoft: `${apiPublicUrl()}/api/oauth/microsoft/callback` },
        webhooks: {
          gmailPubSub: Boolean(config().GOOGLE_PUBSUB_TOPIC),
          httpsPublicUrl: apiPublicUrl().startsWith("https://"),
        },
      },
    };
  });

  app.get("/api/connections", async (req) => {
    const u = actorOf(req);
    const rows = await db().select().from(schema.connections).where(eq(schema.connections.userId, u.userId)).orderBy(desc(schema.connections.createdAt));
    return { connections: rows.filter((r) => r.status !== "revoked").map(toConnectionDTO) };
  });

  app.post("/api/connections/:provider/authorize", async (req) => {
    const u = actorOf(req);
    const provider = z.enum(["google", "microsoft"]).parse((req.params as { provider: string }).provider);
    const body = z.object({ capabilities: z.array(z.enum(CAPABILITIES)).min(1), connectionId: z.string().uuid().optional() }).parse(req.body);
    return { url: await startOAuth(u, provider, body.capabilities, body.connectionId) };
  });

  app.get("/api/oauth/:provider/callback", async (req, reply) => {
    const provider = z.enum(["google", "microsoft"]).parse((req.params as { provider: string }).provider);
    const q = req.query as { code?: string; state?: string; error?: string; error_description?: string };
    const back = new URL("/connections", config().APP_BASE_URL);
    if (q.error || !q.code || !q.state) {
      back.searchParams.set("error", q.error_description ?? q.error ?? "Autorisation annulée");
      return reply.redirect(back.toString());
    }
    try {
      const { connection } = await completeOAuth(provider, q.code, q.state);
      back.searchParams.set("connected", connection.id);
    } catch (e) {
      back.searchParams.set("error", (e as Error).message);
    }
    return reply.redirect(back.toString());
  });

  app.post("/api/connections/demo", async (req) => {
    const u = actorOf(req);
    const conn = await createDemoConnection(u);
    return { connection: toConnectionDTO(conn) };
  });

  app.post("/api/connections/:id/sync", async (req) => {
    const u = actorOf(req);
    const conn = await getOwnedConnection(u, (req.params as { id: string }).id);
    await enqueue(JOBS.syncConnection, { connectionId: conn.id });
    return { queued: true };
  });

  app.post("/api/connections/:id/sync-now", async (req) => {
    const u = actorOf(req);
    const conn = await getOwnedConnection(u, (req.params as { id: string }).id);
    await syncConnection(conn.id);
    const [fresh] = await db().select().from(schema.connections).where(eq(schema.connections.id, conn.id));
    return { connection: toConnectionDTO(fresh) };
  });

  app.delete("/api/connections/:id", async (req) => {
    await disconnect(actorOf(req), (req.params as { id: string }).id);
    return { ok: true };
  });
}
