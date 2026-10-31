/** Jetons de session et jetons à usage unique (e-mail) : 256 bits aléatoires, seule l'empreinte SHA-256 est stockée. */
import { createHash, randomBytes } from "node:crypto";

export function newOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashOpaqueToken(token) };
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
