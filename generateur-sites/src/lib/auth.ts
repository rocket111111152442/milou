import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Deux niveaux d'accès :
//  - le Studio (générateur), protégé par ADMIN_PASSWORD ;
//  - l'espace boutiques de chaque site généré, protégé par le mot de passe propre à ce site.

export const STUDIO_COOKIE = "pp_studio";
export const SITE_COOKIE = "pp_admin";

function secret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("hex");

export function studioConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkStudioPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && safeEqual(password, expected!);
}

export const studioToken = () => (studioConfigured() ? sign("studio-v1") : null);

export async function isStudio() {
  const token = studioToken();
  const value = (await cookies()).get(STUDIO_COOKIE)?.value;
  return Boolean(token && value && safeEqual(value, token));
}

// --- Mots de passe des sites -------------------------------------------------------------------

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return safeEqual(scryptSync(password, salt, 32).toString("hex"), hash);
}

/** Mot de passe lisible à communiquer au commerçant (sans caractères ambigus). */
export function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export const siteToken = (slug: string, passwordHash: string) => sign(`site:${slug}:${passwordHash}`);

export async function isSiteAdmin(slug: string, passwordHash: string) {
  const value = (await cookies()).get(SITE_COOKIE)?.value;
  return Boolean(value && safeEqual(value, siteToken(slug, passwordHash)));
}
