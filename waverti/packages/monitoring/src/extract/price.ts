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

/** Prix trouvés dans un texte libre, avec devise explicite avant ou après la valeur. */
export function findPricesInText(text: string, limit = 10): Array<{ value: number; currency: string; index: number }> {
  const out: Array<{ value: number; currency: string; index: number }> = [];
  const re = /(?:([$£€]|EUR|USD|GBP|CHF)\s*)?(\d(?:[\d   .,]*\d)?)\s*([$£€]|EUR|USD|GBP|CHF)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < limit) {
    const rawCurrency = m[1] ?? m[3];
    if (!rawCurrency) continue;
    const v = parsePrice(m[2]);
    if (v !== null && v > 0) {
      const key = rawCurrency.toUpperCase();
      const currency = key === "€" ? "EUR" : key === "$" ? "USD" : key === "£" ? "GBP" : key;
      out.push({ value: v, currency, index: m.index });
    }
  }
  return out;
}

/**
 * Sélectionne les prix visibles d'une offre de voyage en privilégiant le bloc
 * « prix à partir de / par personne » et en ignorant les excursions placées
 * plus loin dans le descriptif. Les candidats bruts restent disponibles pour
 * la provenance et le diagnostic.
 */
export function findTravelPriceCandidates(text: string, limit = 20) {
  const all = findPricesInText(text, limit);
  const marker = /(?:prix\s+(?:à|a)\s+partir|par\s+personne|\/\s*pers\.?|prix\s+du\s+séjour)/i.exec(text);
  const excursion = /\b(?:excursions?|options?)\b/i.exec(text);
  const cutoff = marker?.index ?? excursion?.index ?? text.length;
  const beforeOffer = all.filter((candidate) => candidate.index < cutoff);
  const pool = beforeOffer.length ? beforeOffer : all;
  const primary = (marker ? pool[pool.length - 1] : pool[0]) ?? null;
  return { all, primary };
}
