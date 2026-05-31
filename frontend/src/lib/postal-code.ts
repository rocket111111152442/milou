import { normalizePostalCode } from '@/lib/email';

export { normalizePostalCode };

/** Code postal français à 5 chiffres (ex. 75001) */
export function isValidPostalCode(value: unknown) {
  const normalized = normalizePostalCode(value);
  return /^\d{5}$/.test(normalized);
}

export function userNeedsPostalCode(postalCode: unknown) {
  return !isValidPostalCode(postalCode);
}
