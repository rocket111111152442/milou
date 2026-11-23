import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fstatic from "@fastify/static";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { config } from "./config.js";
import { AppError } from "./lib/audit.js";
import { resolveSession, SESSION_COOKIE, type SessionUser } from "./auth/service.js";
import { ProviderError } from "./connectors/types.js";
import { authRoutes } from "./routes/auth.js";
import { profileRoutes } from "./routes/profile.js";
import { connectionRoutes } from "./routes/connections.js";
import { dataRoutes } from "./routes/data.js";
import { actionRoutes } from "./routes/actions.js";
import { assistantRoutes } from "./routes/assistant.js";
import { accountRoutes } from "./routes/account.js";
import { webhookRoutes } from "./routes/webhooks.js";

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

export function actorOf(req: FastifyRequest): SessionUser {
  if (!req.user) throw new AppError(401, "unauthenticated", "Connexion requise");
  return req.user;
}

export async function buildApp(): Promise<FastifyInstance> {
  const c = config();
  const app = Fastify({
    logger: c.NODE_ENV === "test" ? false : { level: "info", redact: ["req.headers.authorization", "req.headers.cookie"] },
    trustProxy: true,
    bodyLimit: 512 * 1024,
  });

  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.openai.com"],
        mediaSrc: ["'self'", "blob:"],
        imgSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute", allowList: () => c.NODE_ENV === "test" });

  app.decorateRequest("user", null);
  app.addHook("onRequest", async (req) => {
    req.user = await resolveSession(req.cookies[SESSION_COOKIE]);
  });

  // Protection CSRF : les requêtes modifiantes authentifiées par cookie doivent venir de l'application.
  app.addHook("preHandler", async (req) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
    if (req.url.startsWith("/api/webhooks/") || req.url.startsWith("/api/oauth/")) return;
    const origin = req.headers.origin ?? (req.headers.referer ? new URL(req.headers.referer).origin : null);
    const allowed = new Set([new URL(c.APP_BASE_URL).origin, ...(c.API_PUBLIC_URL ? [new URL(c.API_PUBLIC_URL).origin] : [])]);
    if (c.NODE_ENV !== "test" && (!origin || !allowed.has(origin))) throw new AppError(403, "bad_origin", "Origine de la requête non autorisée");
  });

  app.setErrorHandler((err: unknown, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: err.code, message: err.message });
    if (err instanceof ZodError) return reply.status(400).send({ error: "validation", message: err.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ") });
    if (err instanceof ProviderError) return reply.status(502).send({ error: `provider_${err.kind}`, message: err.message });
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ error: "request", message: e.message });
    req.log.error(err);
    return reply.status(500).send({ error: "internal", message: "Erreur interne" });
  });

  app.get("/api/health", async () => ({ ok: true }));
  await app.register(authRoutes);
  await app.register(profileRoutes);
  await app.register(connectionRoutes);
  await app.register(dataRoutes);
  await app.register(actionRoutes);
  await app.register(assistantRoutes);
  await app.register(accountRoutes);
  await app.register(webhookRoutes);

  // En production, le serveur sert aussi l'interface compilée (web/dist).
  const here = dirname(fileURLToPath(import.meta.url));
  const webDist = [resolve(here, "../../web/dist"), resolve(here, "../web/dist")].find((p) => existsSync(p));
  if (webDist) {
    await app.register(fstatic, { root: webDist, prefix: "/", wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.status(404).send({ error: "not_found", message: "Route inconnue" });
      return reply.sendFile("index.html");
    });
  }
  return app;
}
