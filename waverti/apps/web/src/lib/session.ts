import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createSession, deleteSession, elevateSession, parseEncryptionKey, readSession, type ActiveSession } from "@waverti/auth";
import { getDb, isDatabaseConfigured } from "./db";
import { ipKey } from "./request";

/**
 * Sessions auto-hébergées : jeton aléatoire de 256 bits dans un cookie httpOnly (SameSite=Lax,
 * Secure et préfixe __Host- en production) ; seule son empreinte est stockée en base.
 */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-waverti_session" : "waverti_session";

export function isAuthConfigured(): boolean {
  return isDatabaseConfigured();
}

function cookieOptions(expires: Date) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", expires };
}

async function meta() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0").slice(0, 64);
  return { ipHash: ipKey(ip), userAgent: h.get("user-agent") };
}

/** Session courante (mise en cache pour la durée de la requête). */
export const getActiveSession = cache(async (): Promise<ActiveSession | null> => {
  const store = await cookies();
  if (!isAuthConfigured()) return null;
  return readSession(getDb(), store.get(SESSION_COOKIE)?.value);
});

/** Ouvre une session (connexion) : niveau 1 (mot de passe) ou 2 (après double authentification). */
export async function startSession(userId: string, aal: 1 | 2): Promise<void> {
  const store = await cookies();
  await deleteSession(getDb(), store.get(SESSION_COOKIE)?.value);
  const s = await createSession(getDb(), userId, aal, await meta());
  store.set(SESSION_COOKIE, s.token, cookieOptions(s.expiresAt));
}

/** Passe la session courante au niveau 2 avec un nouveau jeton (anti-fixation). */
export async function elevateCurrentSession(current: ActiveSession): Promise<void> {
  const store = await cookies();
  const s = await elevateSession(getDb(), current, await meta());
  store.set(SESSION_COOKIE, s.token, cookieOptions(s.expiresAt));
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  await deleteSession(getDb(), store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
}

/** Clé de chiffrement des secrets TOTP (WAVERTI_ENCRYPTION_KEY). */
export function encryptionKey(): Buffer {
  return parseEncryptionKey(process.env.WAVERTI_ENCRYPTION_KEY);
}

/** Poivre des empreintes (codes de récupération). */
export function hashPepper(): string {
  const p = process.env.WAVERTI_HASH_PEPPER;
  if (!p || p.length < 32) throw new Error("WAVERTI_HASH_PEPPER (32 caractères minimum) n'est pas configuré");
  return p;
}
