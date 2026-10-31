/**
 * Mots de passe : scrypt (node:crypto, aucune dépendance native), sel aléatoire de 16 octets,
 * format auto-descriptif « scrypt$<logN>$<r>$<p>$<sel>$<empreinte> » (base64url) pour pouvoir
 * augmenter les paramètres plus tard (needsRehash).
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const LOG_N = 16; // N = 65 536 → 64 Mo de mémoire par calcul (recommandation OWASP : N ≥ 2^16 avec r = 8)
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password.normalize("NFKC"), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

const opts = (logN: number, r: number, p: number): ScryptOptions => ({ N: 2 ** logN, r, p, maxmem: 2 ** logN * r * 128 * 2 + 1024 * 1024 });

export async function hashPassword(password: string): Promise<string> {
  if (password.length > 256) throw new Error("password too long");
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, opts(LOG_N, R, P));
  return `scrypt$${LOG_N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || password.length > 256) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, logN, r, p, saltB64, keyB64] = parts as [string, string, string, string, string, string];
  const n = Number(logN), rr = Number(r), pp = Number(p);
  if (![n, rr, pp].every((x) => Number.isInteger(x) && x > 0) || n > 20) return false;
  const expected = Buffer.from(keyB64, "base64url");
  const key = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length, opts(n, rr, pp));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function needsRehash(stored: string): boolean {
  return !stored.startsWith(`scrypt$${LOG_N}$${R}$${P}$`);
}

/**
 * Empreinte factice pour égaliser le temps de réponse quand le compte n'existe pas
 * (pas d'énumération des adresses par mesure du temps).
 */
let dummy: Promise<string> | null = null;
export async function burnPasswordTime(password: string): Promise<void> {
  dummy ??= hashPassword("waverti-dummy-password");
  await verifyPassword(password, await dummy);
}
