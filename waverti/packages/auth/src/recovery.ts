/**
 * Codes de récupération de la double authentification : 10 codes à usage unique, 50 bits d'entropie
 * chacun (10 caractères base32, présentés « XXXXX-XXXXX »). Seule une empreinte HMAC poivrée est stockée.
 */
import { createHmac, randomBytes } from "node:crypto";
import { base32Encode } from "./totp";

export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(7)).slice(0, 10);
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function normalizeRecoveryCode(input: string): string | null {
  const c = input.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z2-7]{10}$/.test(c) ? c : null;
}

export function hashRecoveryCode(code: string, pepper: string): string {
  const n = normalizeRecoveryCode(code);
  if (!n) throw new Error("invalid recovery code");
  return createHmac("sha256", pepper).update(`recovery:${n}`).digest("hex");
}
