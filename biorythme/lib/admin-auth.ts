import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "bio_admin";

function expectedToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHash("sha256").update(`${pw}:biorythme-admin`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export const isAdminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

export async function isAdmin(): Promise<boolean> {
  const expected = expectedToken();
  if (!expected) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  return Boolean(token && safeEqual(token, expected));
}

export async function assertAdmin() {
  if (!(await isAdmin())) throw new Error("Non autorisé");
}

export async function signIn(password: string): Promise<boolean> {
  const pw = process.env.ADMIN_PASSWORD;
  const expected = expectedToken();
  if (!pw || !expected || !safeEqual(password, pw)) return false;
  (await cookies()).set(COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}
