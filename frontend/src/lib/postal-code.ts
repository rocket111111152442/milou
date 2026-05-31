/** Code postal normalisé (utilisable côté client et serveur). */
export function normalizePostalCode(value: unknown) {
  return String(value || '').replace(/\s+/g, '').trim().toUpperCase();
}

/** Code postal français à 5 chiffres (ex. 75001) */
export function isValidPostalCode(value: unknown) {
  const normalized = normalizePostalCode(value);
  return /^\d{5}$/.test(normalized);
}

export function userNeedsPostalCode(postalCode: unknown) {
  return !isValidPostalCode(postalCode);
}
