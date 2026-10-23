// Session d'administration : cookie signé HMAC-SHA256 (compatible Edge/middleware).

export const ADMIN_COOKIE = "ev_admin";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

export const DEFAULT_ADMIN_PASSWORD = "violettes";

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

export function usingDefaultPassword() {
  return !process.env.ADMIN_PASSWORD;
}

function secret() {
  return process.env.AUTH_SECRET || `ev-secret::${adminPassword()}`;
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function createSession() {
  const payload = b64url(enc.encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + MAX_AGE })));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySession(token: string | undefined | null) {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (!safeEqual(sig, await hmac(payload))) return false;
  try {
    const { exp } = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return typeof exp === "number" && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function checkPassword(input: string) {
  // comparaison à temps constant via HMAC des deux valeurs
  const [a, b] = await Promise.all([hmac(`pw:${input}`), hmac(`pw:${adminPassword()}`)]);
  return safeEqual(a, b);
}

export const sessionCookie = (value: string) => ({
  name: ADMIN_COOKIE,
  value,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
});
