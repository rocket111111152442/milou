import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@waverti/database/testing";
import {
  checkPassword,
  confirmTotpEnrollment,
  consumeToken,
  createAccount,
  createSession,
  deleteAccount,
  disableTotp,
  elevateSession,
  issueToken,
  parseEncryptionKey,
  readSession,
  remainingRecoveryCodes,
  setPassword,
  startTotpEnrollment,
  totpCode,
  verifyEmailWithToken,
  verifySecondFactor,
} from "../src";

let t: TestDatabase;
const key = parseEncryptionKey(randomBytes(32).toString("base64"));
const pepper = "x".repeat(48);
const PW = "MotDePasse-Test-2026";
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t?.drop();
});

async function verifiedAccount(email = `u-${randomBytes(4).toString("hex")}@example.test`) {
  const acc = await createAccount(t.db, { email, password: PW, displayName: "Camille" });
  const tok = await issueToken(t.db, acc!.userId, "verify_email");
  await verifyEmailWithToken(t.db, tok);
  return { id: acc!.userId, email };
}

describe("comptes et vérification d'adresse", () => {
  it("crée le compte, son profil, et refuse un doublon (même casse différente)", async () => {
    const acc = await createAccount(t.db, { email: "Nouveau@Example.TEST", password: PW, displayName: "Camille" });
    expect(acc).not.toBeNull();
    const [p] = await t.client<{ email: string; display_name: string }[]>`select email, display_name from profiles where id = ${acc!.userId}`;
    expect(p).toEqual({ email: "nouveau@example.test", display_name: "Camille" });
    expect(await createAccount(t.db, { email: "nouveau@example.test", password: PW })).toBeNull();
    const [u] = await t.client<{ password_hash: string }[]>`select password_hash from users where id = ${acc!.userId}`;
    expect(u!.password_hash).not.toContain(PW);
  });

  it("connexion refusée tant que l'adresse n'est pas vérifiée ; lien à usage unique", async () => {
    const acc = await createAccount(t.db, { email: "verif@example.test", password: PW });
    expect(await checkPassword(t.db, "verif@example.test", PW)).toEqual({ ok: false, reason: "unverified" });
    const old = await issueToken(t.db, acc!.userId, "verify_email");
    const tok = await issueToken(t.db, acc!.userId, "verify_email");
    // Un nouveau lien invalide le précédent.
    expect(await verifyEmailWithToken(t.db, old)).toBeNull();
    expect(await verifyEmailWithToken(t.db, tok)).toBe(acc!.userId);
    expect(await verifyEmailWithToken(t.db, tok)).toBeNull();
    const ok = await checkPassword(t.db, "VERIF@example.test", PW);
    expect(ok.ok).toBe(true);
    expect(await checkPassword(t.db, "verif@example.test", "mauvais")).toEqual({ ok: false, reason: "invalid" });
    expect(await checkPassword(t.db, "inconnu@example.test", PW)).toEqual({ ok: false, reason: "invalid" });
  });

  it("un lien expiré ou d'un autre usage est refusé", async () => {
    const u = await verifiedAccount();
    const tok = await issueToken(t.db, u.id, "reset_password", new Date(Date.now() - 2 * 3_600_000));
    expect(await consumeToken(t.db, tok, "reset_password")).toBeNull();
    const tok2 = await issueToken(t.db, u.id, "reset_password");
    expect(await consumeToken(t.db, tok2, "verify_email")).toBeNull();
    expect(await consumeToken(t.db, "pas-un-jeton", "reset_password")).toBeNull();
  });
});

describe("sessions", () => {
  it("session valide, expirée, supprimée ; jamais stockée en clair", async () => {
    const u = await verifiedAccount();
    const s = await createSession(t.db, u.id, 1, { userAgent: "test" });
    const read = await readSession(t.db, s.token);
    expect(read).toMatchObject({ userId: u.id, aal: 1 });
    const [row] = await t.client<{ id: string }[]>`select id from user_sessions where user_id = ${u.id}`;
    expect(row!.id).not.toBe(s.token);
    expect(await readSession(t.db, s.token, new Date(Date.now() + 31 * 86_400_000))).toBeNull();
    expect(await readSession(t.db, "inventé")).toBeNull();
  });

  it("changer le mot de passe ferme les autres sessions et les liens de réinitialisation", async () => {
    const u = await verifiedAccount();
    const a = await createSession(t.db, u.id, 1);
    const b = await createSession(t.db, u.id, 1);
    const reset = await issueToken(t.db, u.id, "reset_password");
    await setPassword(t.db, u.id, "Nouveau-Mot-2026", a.id);
    expect(await readSession(t.db, a.token)).not.toBeNull();
    expect(await readSession(t.db, b.token)).toBeNull();
    expect(await consumeToken(t.db, reset, "reset_password")).toBeNull();
    expect((await checkPassword(t.db, u.email, "Nouveau-Mot-2026")).ok).toBe(true);
    expect((await checkPassword(t.db, u.email, PW)).ok).toBe(false);
  });
});

describe("double authentification", () => {
  it("activation par un premier code, codes de récupération à usage unique, anti-rejeu, élévation de session", async () => {
    const u = await verifiedAccount();
    const { secret, uri } = await startTotpEnrollment(t.db, u, key);
    expect(uri).toContain("otpauth://totp/Waverti");
    const [pending] = await t.client<{ totp_pending_enc: string }[]>`select totp_pending_enc from users where id = ${u.id}`;
    expect(pending!.totp_pending_enc).not.toContain(secret);
    expect(await confirmTotpEnrollment(t.db, u.id, "000000", key, pepper)).toBeNull();
    const now = Date.now();
    const step = Math.floor(now / 30_000);
    const codes = await confirmTotpEnrollment(t.db, u.id, totpCode(secret, step), key, pepper, now);
    expect(codes).toHaveLength(10);
    // Le même code ne peut pas resservir (anti-rejeu).
    expect(await verifySecondFactor(t.db, u.id, totpCode(secret, step), key, pepper, now)).toBeNull();
    expect(await verifySecondFactor(t.db, u.id, totpCode(secret, step + 1), key, pepper, now + 30_000)).toBe("totp");
    // Code de récupération : une seule fois.
    expect(await verifySecondFactor(t.db, u.id, codes![0]!.toLowerCase(), key, pepper)).toBe("recovery");
    expect(await verifySecondFactor(t.db, u.id, codes![0]!, key, pepper)).toBeNull();
    expect(await remainingRecoveryCodes(t.db, u.id)).toBe(9);
    // Élévation : nouveau jeton, l'ancien n'ouvre plus rien.
    const s1 = await createSession(t.db, u.id, 1);
    const cur = (await readSession(t.db, s1.token))!;
    const s2 = await elevateSession(t.db, cur);
    expect(await readSession(t.db, s1.token)).toBeNull();
    expect((await readSession(t.db, s2.token))!.aal).toBe(2);
    await disableTotp(t.db, u.id);
    expect(await remainingRecoveryCodes(t.db, u.id)).toBe(0);
    expect(await verifySecondFactor(t.db, u.id, totpCode(secret, step + 2), key, pepper, now + 60_000)).toBeNull();
  });
});

describe("suppression du compte", () => {
  it("efface l'identité, le profil, les sessions et les jetons", async () => {
    const u = await verifiedAccount();
    await createSession(t.db, u.id, 1);
    await issueToken(t.db, u.id, "reset_password");
    await deleteAccount(t.db, u.id);
    for (const table of ["users", "profiles"]) {
      expect(await t.client.unsafe(`select 1 from ${table} where id = $1`, [u.id])).toHaveLength(0);
    }
    for (const table of ["user_sessions", "auth_tokens", "mfa_recovery_codes"]) {
      expect(await t.client.unsafe(`select 1 from ${table} where user_id = $1`, [u.id])).toHaveLength(0);
    }
  });
});
