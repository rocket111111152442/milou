import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { createSession, destroySession, login, loginSchema, register, registerSchema, SESSION_COOKIE } from "../auth/service.js";
import { actorOf } from "../app.js";
import { createDemoConnection } from "../connectors/demo/seed.js";
import { getProfile } from "../lib/profile.js";

export async function authRoutes(app: FastifyInstance) {
  const cookieOpts = () => ({
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config().NODE_ENV === "production",
    path: "/",
    maxAge: config().SESSION_TTL_DAYS * 86400,
  });

  app.post("/api/auth/register", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const { user, org } = await register(input);
    const token = await createSession(user.id, org.id);
    if (input.withDemo) await createDemoConnection({ userId: user.id, orgId: org.id });
    reply.setCookie(SESSION_COOKIE, token, cookieOpts());
    return { userId: user.id, orgId: org.id };
  });

  app.post("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { user, orgId } = await login(loginSchema.parse(req.body));
    reply.setCookie(SESSION_COOKIE, await createSession(user.id, orgId), cookieOpts());
    return { userId: user.id };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    await destroySession(req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (req) => {
    const u = actorOf(req);
    const p = await getProfile(u.userId);
    return {
      user: { id: u.userId, email: u.email, displayName: u.displayName, role: u.role, orgId: u.orgId },
      onboardingCompleted: Boolean(p.onboardingCompletedAt),
      assistantName: p.assistantName,
      engine: config().OPENAI_API_KEY ? "openai" : "demo",
      voiceAvailable: Boolean(config().OPENAI_API_KEY),
    };
  });
}
