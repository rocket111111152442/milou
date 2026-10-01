import "server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { adminClient } from "./supabase-admin";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const COOKIE = "bio_member";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 jours

export type Member = { id: string; email: string; first_name: string; last_name: string; phone: string };

/* ---------- Mots de passe (scrypt + sel aléatoire) ---------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/* ---------- Session : cookie signé « id.expiration.signature » ---------- */

function secret(): string {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.ADMIN_PASSWORD;
  if (!base) throw new Error("Aucun secret disponible pour signer les sessions.");
  return createHmac("sha256", "biorythme-member-session").update(base).digest("hex");
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export async function startSession(memberId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${memberId}.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

async function sessionMemberId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig) return null;
  let expected: string;
  try {
    expected = sign(`${id}.${exp}`);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return id;
}

/** Membre connecté, ou null. Ne lève jamais d'erreur (base absente, cookie invalide…). */
export async function currentMember(): Promise<Member | null> {
  const id = await sessionMemberId();
  if (!id) return null;
  try {
    const { data } = await adminClient()
      .from("bio_members")
      .select("id, email, first_name, last_name, phone")
      .eq("id", id)
      .maybeSingle();
    return (data as Member) ?? null;
  } catch {
    return null;
  }
}
