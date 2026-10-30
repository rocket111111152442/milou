import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Jeton aléatoire encodé en base64url (256 bits par défaut). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Empreinte SHA-256 hexadécimale d'un jeton (les jetons ne sont jamais stockés en clair). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Empreinte HMAC avec un « poivre » serveur (WAVERTI_HASH_PEPPER) : utilisée pour les données
 * personnelles qu'il faut pouvoir comparer sans les conserver (e-mail anti-abus d'essai, empreinte de carte).
 */
export function pepperedHash(value: string, pepper: string | undefined = process.env.WAVERTI_HASH_PEPPER): string {
  if (!pepper || pepper.length < 32) {
    throw new Error("WAVERTI_HASH_PEPPER (32 caractères minimum) est requis pour les empreintes anti-abus");
  }
  return createHmac("sha256", pepper).update(value, "utf8").digest("hex");
}

/** Normalise une adresse e-mail pour la détection d'essais multiples (casse, alias +, points Gmail). */
export function normalizeEmailForAbuse(email: string): string {
  const [localRaw, domainRaw] = email.trim().toLowerCase().split("@");
  if (!localRaw || !domainRaw) return email.trim().toLowerCase();
  let local = localRaw.split("+")[0] ?? localRaw;
  const domain = domainRaw === "googlemail.com" ? "gmail.com" : domainRaw;
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I

/** Code court lisible pour lier l'application desktop (format XXXX-XXXX). */
export function generateUserCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += USER_CODE_ALPHABET[bytes[i]! % USER_CODE_ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}

export function normalizeUserCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length !== 8) return null;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}
