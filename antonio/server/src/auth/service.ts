import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { config } from "../config.js";
import { db, schema } from "../db/client.js";
import { hashPassword, randomToken, sha256, verifyPassword } from "../lib/crypto.js";
import { AppError, audit } from "../lib/audit.js";
import { PLAN_IDS } from "@antonio/shared";

export const registerSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(10, "10 caractères minimum").max(200),
  displayName: z.string().min(1).max(100),
  organizationName: z.string().max(120).optional(),
  withDemo: z.boolean().default(false),
  requestedPlan: z.enum(PLAN_IDS).optional(),
});

export const loginSchema = z.object({ email: z.string().email().transform((s) => s.toLowerCase().trim()), password: z.string().min(1) });

export interface SessionUser {
  userId: string;
  orgId: string;
  email: string;
  displayName: string;
  role: string;
}

export async function register(input: z.infer<typeof registerSchema>) {
  const existing = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, input.email));
  if (existing.length) throw new AppError(409, "email_taken", "Un compte existe déjà avec cette adresse.");
  const passwordHash = await hashPassword(input.password);
  return db().transaction(async (tx) => {
    const [org] = await tx
      .insert(schema.organizations)
      .values({ name: input.organizationName?.trim() || `Espace de ${input.displayName}` })
      .returning();
    const [user] = await tx.insert(schema.users).values({ email: input.email, passwordHash, displayName: input.displayName }).returning();
    await tx.insert(schema.memberships).values({ orgId: org.id, userId: user.id, role: "owner" });
    await tx.insert(schema.profiles).values({ userId: user.id, orgId: org.id, firstName: input.displayName.split(" ")[0], onboardingStep: "welcome" });
    await tx.insert(schema.subscriptions).values({ userId: user.id, requestedPlan: input.requestedPlan ?? "essentiel" });
    return { user, org };
  });
}

export async function login(input: z.infer<typeof loginSchema>) {
  const [user] = await db().select().from(schema.users).where(eq(schema.users.email, input.email));
  // Comparaison effectuée même si l'utilisateur n'existe pas (temps constant approximatif).
  const ok = await verifyPassword(input.password, user?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
  if (!user || !ok || user.deletedAt) throw new AppError(401, "invalid_credentials", "Adresse ou mot de passe incorrect.");
  const [m] = await db().select().from(schema.memberships).where(eq(schema.memberships.userId, user.id));
  return { user, orgId: m.orgId };
}

export async function createSession(userId: string, orgId: string) {
  const token = randomToken(32);
  await db()
    .insert(schema.sessions)
    .values({ tokenHash: sha256(token), userId, orgId, expiresAt: new Date(Date.now() + config().SESSION_TTL_DAYS * 86400_000) });
  await audit("auth.login", { userId, orgId });
  return token;
}

export async function resolveSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const rows = await db()
    .select({
      userId: schema.sessions.userId,
      orgId: schema.sessions.orgId,
      email: schema.users.email,
      displayName: schema.users.displayName,
      deletedAt: schema.users.deletedAt,
      role: schema.memberships.role,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .innerJoin(schema.memberships, and(eq(schema.memberships.userId, schema.sessions.userId), eq(schema.memberships.orgId, schema.sessions.orgId)))
    .where(and(eq(schema.sessions.tokenHash, sha256(token)), gt(schema.sessions.expiresAt, new Date())));
  const r = rows[0];
  if (!r || r.deletedAt) return null;
  return { userId: r.userId, orgId: r.orgId, email: r.email, displayName: r.displayName, role: r.role };
}

export async function destroySession(token: string | undefined) {
  if (token) await db().delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
}

export const SESSION_COOKIE = "antonio_session";
