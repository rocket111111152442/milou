/** Lecture stricte des montants : une valeur ambiguë est « inconnue », jamais devinée. */

const MAX_CENTS = 1_000_000_000;

/**
 * Montant en centimes, en arithmétique entière (aucun flottant).
 * Accepte « 1299 », « 1299.00 », « 1 299,00 », « 1.299,00 », « 1,299.00 » ; refuse tout ce qui est ambigu
 * (« 1.299 », « 1,299 » : milliers ou décimales ?), les plus de deux décimales significatives et le texte superflu.
 */
export function parseDecimalToCents(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return null;
    const c = raw * 100;
    return Math.abs(c - Math.round(c)) < 1e-6 && c < MAX_CENTS ? Math.round(c) : null;
  }
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[   \s]/g, "").replace(/(EUR|USD|GBP|CHF|CAD|TTC|HT|€|£|\$)/gi, "");
  s = s.replace(/[,.]-$/, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let intPart: string;
  let decPart = "";
  if (lastComma > -1 && lastDot > -1) {
    const dec = Math.max(lastComma, lastDot);
    const thousands = lastComma > lastDot ? "." : ",";
    intPart = s.slice(0, dec).split(thousands).join("");
    decPart = s.slice(dec + 1);
    if (/[.,]/.test(intPart)) return null;
  } else if (lastComma > -1 || lastDot > -1) {
    const sep = lastComma > -1 ? "," : ".";
    const count = s.split(sep).length - 1;
    const after = s.length - s.lastIndexOf(sep) - 1;
    if (count > 1) {
      // Plusieurs séparateurs identiques : groupes de milliers (« 1.299.000 »).
      if (!s.split(sep).slice(1).every((g) => g.length === 3)) return null;
      intPart = s.split(sep).join("");
    } else if (after === 3) {
      return null; // « 1.299 » / « 1,299 » : ambigu
    } else if (after >= 1 && after <= 2) {
      intPart = s.slice(0, s.lastIndexOf(sep));
      decPart = s.slice(s.lastIndexOf(sep) + 1);
    } else {
      return null;
    }
  } else {
    intPart = s;
  }
  if (!/^\d+$/.test(intPart) || (decPart && !/^\d{1,2}$/.test(decPart))) return null;
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0") || "0");
  return Number.isSafeInteger(cents) && cents < MAX_CENTS ? cents : null;
}

/** Devise ISO 4217 en trois lettres. « $ » seul est ambigu (USD, CAD, AUD…) : jamais interprété. */
export function normalizeCurrency(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (/^[A-Za-z]{3}$/.test(t)) return t.toUpperCase();
  if (t === "€") return "EUR";
  if (t === "£") return "GBP";
  return null;
}
