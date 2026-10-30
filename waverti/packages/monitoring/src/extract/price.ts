/**
 * Lecture de prix au format français ou international.
 * "1 299,99 €" -> 1299.99 ; "1.299,99" -> 1299.99 ; "1,299.99" -> 1299.99 ; "1299,-" -> 1299
 */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : null;
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[   \s]/g, "").replace(/[€$£]|EUR|USD|GBP|TTC|HT/gi, "");
  s = s.replace(/,-$/, "").replace(/\.-$/, "");
  const m = /\d[\d.,']*/.exec(s);
  if (!m) return null;
  s = m[0].replace(/'/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Le dernier séparateur est le séparateur décimal.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 && s.indexOf(",") === lastComma && s.length > 4 ? s.replace(",", "") : s.replace(/,/g, ".");
    if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\.(?=.*\.)/g, "");
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    if ((s.match(/\./g) ?? []).length > 1 || decimals === 3) s = s.replace(/\./g, "");
  }
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return null;
  return Math.round(n * 100) / 100;
}

const CURRENCY_SYMBOLS: Record<string, string> = { "€": "EUR", $: "USD", "£": "GBP", CHF: "CHF" };

export function detectCurrency(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const iso = /\b(EUR|USD|GBP|CHF|CAD)\b/i.exec(raw)?.[1];
  if (iso) return iso.toUpperCase();
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) if (raw.includes(sym)) return code;
  return null;
}

/** Prix trouvés dans un texte libre (« 749,99 € », « € 12.50 »). */
export function findPricesInText(text: string, limit = 10): Array<{ value: number; currency: string; index: number }> {
  const out: Array<{ value: number; currency: string; index: number }> = [];
  const re = /(\d{1,3}(?:[   .]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?(€|EUR)|(€)\s?(\d{1,3}(?:[   .,]\d{3})*(?:[.,]\d{1,2})?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < limit) {
    const v = parsePrice(m[1] ?? m[4] ?? "");
    if (v !== null && v > 0) out.push({ value: v, currency: "EUR", index: m.index });
  }
  return out;
}
