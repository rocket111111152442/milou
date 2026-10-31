/**
 * Chiffrement symétrique des secrets stockés en base (secrets TOTP) : AES-256-GCM, IV aléatoire.
 * Clé : WAVERTI_ENCRYPTION_KEY (32 octets en base64 ou hexadécimal), jamais en base ni dans le code.
 * Format : v1.<iv>.<tag>.<chiffré> (base64url).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function parseEncryptionKey(raw: string | undefined): Buffer {
  if (!raw) throw new Error("WAVERTI_ENCRYPTION_KEY n'est pas configurée");
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("WAVERTI_ENCRYPTION_KEY doit faire 32 octets (base64 ou hexadécimal)");
  return key;
}

export function encryptSecret(plain: string, key: Buffer, aad = "waverti"): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(box: string, key: Buffer, aad = "waverti"): string {
  const [v, iv, tag, ct] = box.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("secret chiffré invalide");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
