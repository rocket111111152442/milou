import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { actorOf } from "../app.js";
import { db, schema } from "../db/client.js";
import { audit } from "../lib/audit.js";
import { verifyPassword } from "../lib/crypto.js";
import { AppError } from "../lib/audit.js";
import { disconnect } from "../connectors/service.js";
import { SESSION_COOKIE } from "../auth/service.js";

export async function accountRoutes(app: FastifyInstance) {
  /** Export des données du compte (sans jetons ni secrets). */
  app.get("/api/account/export", async (req, reply) => {
    const u = actorOf(req);
    const by = <T extends { userId: unknown }>(t: T) => eq((t as unknown as typeof schema.messages).userId, u.userId);
    const [profile] = await db().select().from(schema.profiles).where(eq(schema.profiles.userId, u.userId));
    const data = {
      exportedAt: new Date().toISOString(),
      user: { email: u.email, displayName: u.displayName },
      profile,
      autonomy: await db().select().from(schema.autonomy).where(eq(schema.autonomy.userId, u.userId)),
      memories: await db().select().from(schema.memories).where(eq(schema.memories.userId, u.userId)),
      rules: await db().select().from(schema.rules).where(eq(schema.rules.userId, u.userId)),
      templates: await db().select().from(schema.templates).where(eq(schema.templates.userId, u.userId)),
      tasks: await db().select().from(schema.tasks).where(eq(schema.tasks.userId, u.userId)),
      actions: await db().select().from(schema.actions).where(eq(schema.actions.userId, u.userId)),
      connections: (await db().select().from(schema.connections).where(eq(schema.connections.userId, u.userId))).map((c) => ({
        provider: c.provider,
        accountEmail: c.accountEmail,
        status: c.status,
        capabilities: c.capabilities,
        createdAt: c.createdAt,
      })),
      messagesMetadata: await db()
        .select({ subject: schema.messages.subject, from: schema.messages.fromEmail, receivedAt: schema.messages.receivedAt, category: schema.messages.category })
        .from(schema.messages)
        .where(by(schema.messages)),
      briefings: await db().select().from(schema.briefings).where(eq(schema.briefings.userId, u.userId)),
      usage: await db().select().from(schema.usageRecords).where(eq(schema.usageRecords.userId, u.userId)),
    };
    await audit("account.exported", { orgId: u.orgId, userId: u.userId });
    reply.header("Content-Disposition", 'attachment; filename="antonio-export.json"');
    return data;
  });

  /** Suppression du compte : révocation des connexions puis effacement des données. */
  app.delete("/api/account", async (req, reply) => {
    const u = actorOf(req);
    const body = z.object({ password: z.string().min(1) }).parse(req.body);
    const [user] = await db().select().from(schema.users).where(eq(schema.users.id, u.userId));
    if (!(await verifyPassword(body.password, user.passwordHash))) throw new AppError(403, "bad_password", "Mot de passe incorrect");
    const conns = await db().select().from(schema.connections).where(eq(schema.connections.userId, u.userId));
    for (const c of conns) if (c.status !== "revoked") await disconnect(u, c.id).catch(() => undefined);
    await audit("account.deleted", { orgId: u.orgId, meta: { userId: u.userId } });
    const members = await db().select().from(schema.memberships).where(eq(schema.memberships.orgId, u.orgId));
    await db().delete(schema.users).where(eq(schema.users.id, u.userId)); // cascade
    if (members.length <= 1) await db().delete(schema.organizations).where(eq(schema.organizations.id, u.orgId));
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });
}
