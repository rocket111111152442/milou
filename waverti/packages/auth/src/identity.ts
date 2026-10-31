/**
 * Identité auto-hébergée (remplace Supabase Auth) : comptes, vérification d'adresse, mots de passe,
 * sessions, double authentification TOTP et codes de récupération. Indépendant du framework web :
 * le site gère les cookies, les e-mails et la limitation de débit autour de ces fonctions.
 */
import { and, authTokens, eq, gt, isNull, mfaRecoveryCodes, sql, userSessions, users, type Database, type Executor } from "@waverti/database";
import { burnPasswordTime, hashPassword, needsRehash, verifyPassword } from "./password";
import { decryptSecret, encryptSecret } from "./secretbox";
import { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from "./recovery";
import { hashOpaqueToken, newOpaqueToken } from "./session-token";
import { generateTotpSecret, otpauthUri, verifyTotp } from "./totp";

export const SESSION_TTL_MS = 30 * 86_400_000;
/** La date d'expiration glissante n'est mise à jour qu'une fois par heure (limite les écritures). */
const SESSION_TOUCH_MS = 3_600_000;
export const TOKEN_TTL_MS: Record<"verify_email" | "reset_password", number> = { verify_email: 24 * 3_600_000, reset_password: 3_600_000 };

export type IdentityUser = typeof users.$inferSelect;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Crée un compte non vérifié. Renvoie null si l'adresse existe déjà : l'appelant répond de la même
 * manière dans les deux cas (pas d'énumération des comptes).
 */
export async function createAccount(db: Database, input: { email: string; password: string; displayName?: string | null }): Promise<{ userId: string } | null> {
  const email = normalizeEmail(input.email);
  const hash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({ email, passwordHash: hash, passwordChangedAt: new Date() })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (!row) return null;
    if (input.displayName) {
      await tx.execute(sql`update profiles set display_name = ${input.displayName.slice(0, 80)} where id = ${row.id}`);
    }
    return { userId: row.id };
  });
}

export async function findUserByEmail(db: Executor, email: string): Promise<IdentityUser | null> {
  const [u] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return u ?? null;
}

/** Jeton à usage unique (lien envoyé par e-mail). Les jetons précédents du même usage sont invalidés. */
export async function issueToken(db: Executor, userId: string, purpose: "verify_email" | "reset_password", now = new Date()): Promise<string> {
  const { token, hash } = newOpaqueToken();
  await db.update(authTokens).set({ usedAt: now }).where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)));
  await db.insert(authTokens).values({ tokenHash: hash, userId, purpose, expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]) });
  return token;
}

/** Consomme un jeton (atomique : un seul usage, même en cas de double clic). Renvoie l'utilisateur ou null. */
export async function consumeToken(db: Executor, token: string, purpose: "verify_email" | "reset_password", now = new Date()): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const rows = await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(and(eq(authTokens.tokenHash, hashOpaqueToken(token)), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt), gt(authTokens.expiresAt, now)))
    .returning({ userId: authTokens.userId });
  return rows[0]?.userId ?? null;
}

export async function verifyEmailWithToken(db: Database, token: string, now = new Date()): Promise<string | null> {
  return db.transaction(async (tx) => {
    const userId = await consumeToken(tx, token, "verify_email", now);
    if (!userId) return null;
    await tx.update(users).set({ emailVerifiedAt: now }).where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)));
    return userId;
  });
}

export type PasswordCheck = { ok: true; user: IdentityUser } | { ok: false; reason: "invalid" | "unverified" };

/** Vérifie e-mail + mot de passe, en temps comparable que le compte existe ou non. */
export async function checkPassword(db: Database, email: string, password: string): Promise<PasswordCheck> {
  const user = await findUserByEmail(db, email);
  if (!user?.passwordHash) {
    await burnPasswordTime(password);
    return { ok: false, reason: "invalid" };
  }
  if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, reason: "invalid" };
  if (!user.emailVerifiedAt) return { ok: false, reason: "unverified" };
  if (needsRehash(user.passwordHash)) {
    await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
  }
  return { ok: true, user };
}

/** Change le mot de passe et ferme toutes les sessions (sauf éventuellement la session courante). */
export async function setPassword(db: Database, userId: string, password: string, keepSessionId?: string): Promise<void> {
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hash, passwordChangedAt: new Date() }).where(eq(users.id, userId));
    await tx.delete(userSessions).where(and(eq(userSessions.userId, userId), keepSessionId ? sql`${userSessions.id} <> ${keepSessionId}` : sql`true`));
    await tx.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, "reset_password"), isNull(authTokens.usedAt)));
  });
}

// ---------------------------------------------------------------------------- sessions

export interface SessionMeta {
  ipHash?: string | null;
  userAgent?: string | null;
}

export async function createSession(db: Executor, userId: string, aal: 1 | 2, meta: SessionMeta = {}, now = new Date()): Promise<{ token: string; id: string; expiresAt: Date }> {
  const { token, hash } = newOpaqueToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(userSessions).values({
    id: hash,
    userId,
    aal,
    expiresAt,
    ipHash: meta.ipHash ?? null,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });
  return { token, id: hash, expiresAt };
}

export interface ActiveSession {
  id: string;
  userId: string;
  aal: 1 | 2;
  expiresAt: Date;
  user: IdentityUser;
}

/** Session valide correspondant au jeton du cookie (expiration glissante de 30 jours). */
export async function readSession(db: Executor, token: string | null | undefined, now = new Date()): Promise<ActiveSession | null> {
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const id = hashOpaqueToken(token);
  const [row] = await db
    .select({ s: userSessions, u: users })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(and(eq(userSessions.id, id), gt(userSessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  let expiresAt = row.s.expiresAt;
  if (now.getTime() - row.s.lastSeenAt.getTime() > SESSION_TOUCH_MS) {
    expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await db.update(userSessions).set({ lastSeenAt: now, expiresAt }).where(eq(userSessions.id, id));
  }
  return { id, userId: row.s.userId, aal: row.s.aal === 2 ? 2 : 1, expiresAt, user: row.u };
}

export async function deleteSession(db: Executor, token: string | null | undefined): Promise<void> {
  if (!token) return;
  await db.delete(userSessions).where(eq(userSessions.id, hashOpaqueToken(token)));
}

/**
 * Élève une session au niveau 2 (double authentification validée) en émettant un NOUVEAU jeton
 * (l'ancien est supprimé : protection contre la fixation de session).
 */
export async function elevateSession(db: Database, current: ActiveSession, meta: SessionMeta = {}): Promise<{ token: string; expiresAt: Date }> {
  return db.transaction(async (tx) => {
    await tx.delete(userSessions).where(eq(userSessions.id, current.id));
    const s = await createSession(tx, current.userId, 2, meta);
    return { token: s.token, expiresAt: s.expiresAt };
  });
}

export async function purgeExpiredSessions(db: Executor, now = new Date()): Promise<void> {
  await db.execute(sql`delete from user_sessions where expires_at < ${now.toISOString()}::timestamptz`);
  await db.execute(sql`delete from auth_tokens where expires_at < ${now.toISOString()}::timestamptz - interval '7 days'`);
}

// ---------------------------------------------------------------------------- double authentification

/** Étape 1 : secret TOTP en attente (chiffré), affiché sous forme de QR code. */
export async function startTotpEnrollment(db: Executor, user: Pick<IdentityUser, "id" | "email">, key: Buffer, issuer = "Waverti"): Promise<{ secret: string; uri: string }> {
  const secret = generateTotpSecret();
  await db.update(users).set({ totpPendingEnc: encryptSecret(secret, key, `totp:${user.id}`) }).where(eq(users.id, user.id));
  return { secret, uri: otpauthUri(issuer, user.email, secret) };
}

/** Étape 2 : premier code valide → activation et 10 codes de récupération (affichés une seule fois). */
export async function confirmTotpEnrollment(db: Database, userId: string, code: string, key: Buffer, pepper: string, now = Date.now()): Promise<string[] | null> {
  return db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).for("update").limit(1);
    if (!u?.totpPendingEnc) return null;
    const secret = decryptSecret(u.totpPendingEnc, key, `totp:${userId}`);
    const step = verifyTotp(secret, code, { now });
    if (step === null) return null;
    await tx
      .update(users)
      .set({ totpSecretEnc: u.totpPendingEnc, totpPendingEnc: null, totpEnabledAt: new Date(now), totpLastStep: step })
      .where(eq(users.id, userId));
    return replaceRecoveryCodes(tx, userId, pepper);
  });
}

async function replaceRecoveryCodes(db: Executor, userId: string, pepper: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
  await db.insert(mfaRecoveryCodes).values(codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c, pepper) })));
  return codes;
}

export async function regenerateRecoveryCodes(db: Database, userId: string, pepper: string): Promise<string[]> {
  return db.transaction((tx) => replaceRecoveryCodes(tx, userId, pepper));
}

export async function remainingRecoveryCodes(db: Executor, userId: string): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`select count(*)::int as n from mfa_recovery_codes where user_id = ${userId} and used_at is null`);
  return r?.n ?? 0;
}

/**
 * Vérifie le second facteur : code TOTP (anti-rejeu) ou code de récupération (consommé).
 * Renvoie la méthode utilisée, ou null.
 */
export async function verifySecondFactor(
  db: Database,
  userId: string,
  code: string,
  key: Buffer,
  pepper: string,
  now = Date.now(),
): Promise<"totp" | "recovery" | null> {
  return db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).for("update").limit(1);
    if (!u?.totpSecretEnc || !u.totpEnabledAt) return null;
    if (/^\s*\d{3}\s?\d{3}\s*$/.test(code)) {
      const secret = decryptSecret(u.totpSecretEnc, key, `totp:${userId}`);
      const step = verifyTotp(secret, code, { now, lastUsedStep: u.totpLastStep });
      if (step === null) return null;
      await tx.update(users).set({ totpLastStep: step }).where(eq(users.id, userId));
      return "totp";
    }
    if (!normalizeRecoveryCode(code)) return null;
    const used = await tx
      .update(mfaRecoveryCodes)
      .set({ usedAt: new Date(now) })
      .where(and(eq(mfaRecoveryCodes.userId, userId), eq(mfaRecoveryCodes.codeHash, hashRecoveryCode(code, pepper)), isNull(mfaRecoveryCodes.usedAt)))
      .returning({ id: mfaRecoveryCodes.id });
    return used.length ? "recovery" : null;
  });
}

export async function disableTotp(db: Database, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(users).set({ totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null }).where(eq(users.id, userId));
    await tx.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
  });
}

/** Suppression définitive d'un compte (droit à l'effacement) : cascade sur toutes ses données. */
export async function deleteAccount(db: Executor, userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}
