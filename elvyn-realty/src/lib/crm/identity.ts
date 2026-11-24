/** Contact identity normalisation used for de-duplication. Names are never used to merge. */
export function normalizeEmail(v: string | null | undefined): string | null {
  const e = (v ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200 ? e : null;
}

/**
 * Phone → E.164-like "+<digits>". Dominican numbers written without country code
 * (809/829/849 + 7 digits) get +1. Returns null when it cannot be a phone number.
 */
export function normalizePhone(v: string | null | undefined): string | null {
  const raw = (v ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);
  if (!raw.startsWith("+") && !raw.startsWith("00") && digits.length === 10 && /^(809|829|849)/.test(digits)) digits = "1" + digits;
  if (digits.length < 8 || digits.length > 15) return null;
  return "+" + digits;
}
