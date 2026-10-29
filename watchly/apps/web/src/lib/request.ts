import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Adresse IP du client (premier élément de x-forwarded-for, posé par Vercel). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0").slice(0, 64);
}

export function ipFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0").slice(0, 64);
}

/** Empreinte d'IP pour les compteurs de limitation (l'adresse brute n'est pas stockée). */
export function ipKey(ip: string): string {
  const pepper = process.env.WATCHLY_HASH_PEPPER ?? "watchly-dev-pepper";
  return createHash("sha256").update(`${pepper}:${ip}`).digest("hex").slice(0, 32);
}

/** Chemin de redirection interne sûr (pas d'URL absolue ni de « // » : pas de redirection ouverte). */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.length > 300) return fallback;
  return next;
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
