/** Utilitaires de normalisation : texte, GTIN, référence fabricant, URL. Purs, sans effet de bord. */

/** Minuscules, sans accents ni ponctuation superflue ; les chiffres, lettres et « . » entre chiffres sont conservés. */
export function normalizeText(input: string): string {
  return input
    .replace(/(\d),(\d)/g, "$1.$2")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9.+'"\s-]/g, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  return normalizeText(input)
    .replace(/[+'"]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
}

/** Clé de contrôle GTIN (modulo 10, pondération 3/1 depuis la droite). */
export function gtinChecksumOk(digits: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return false;
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/** GTIN normalisé sur 14 chiffres (EAN-13 et UPC-A comparables), ou null si invalide. */
export function normalizeGtin(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[\s-]/g, "");
  if (!gtinChecksumOk(digits)) return null;
  return digits.padStart(14, "0");
}

/** Référence fabricant : majuscules, sans espaces ni tirets ; trop courte (< 4) ou purement numérique courte = ignorée. */
export function normalizeMpn(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const v = raw.toUpperCase().replace(/[\s\-_./]/g, "");
  if (v.length < 4) return null;
  if (/^\d{1,5}$/.test(v)) return null;
  return v;
}

const TRACKING_PARAMS = /^(utm_|gclid$|fbclid$|msclkid$|mc_|ref$|ref_$|aff|affiliate|campaign|xtor|sscid$|_ga$|igshid$)/i;
const SECOND_LEVEL = new Set(["co.uk", "com.au", "co.jp", "com.br", "co.nz", "org.uk", "com.mx"]);

/** URL canonique : hôte en minuscules sans « www. », sans fragment ni paramètres de suivi, paramètres triés, sans « / » final. */
export function canonicalizeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k)).sort(([a], [b]) => a.localeCompare(b));
  const search = params.length ? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}` : "";
  const path = u.pathname.replace(/\/+$/, "") || "";
  return `https://${host}${u.port && u.port !== "443" && u.port !== "80" ? `:${u.port}` : ""}${path}${search}`;
}

/** Domaine d'enregistrement approximatif (sans liste publique de suffixes : couvre les cas courants). */
export function registrableDomain(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const last2 = parts.slice(-2).join(".");
  return SECOND_LEVEL.has(last2) ? parts.slice(-3).join(".") : last2;
}
