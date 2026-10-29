import { isPublicAddress } from "./ip-policy";

export const DEFAULT_ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home.arpa", ".corp", ".localdomain"];
const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_ga|igshid|yclid)$/i;

export class InvalidTargetError extends Error {
  constructor(
    public readonly code: "invalid_url" | "unsupported_protocol" | "credentials_in_url" | "blocked_port" | "blocked_host",
    message: string,
  ) {
    super(message);
    this.name = "InvalidTargetError";
  }
}

export interface UrlPolicyOptions {
  allowAnyPort?: boolean;
  /** Tests uniquement : autorise le nom « localhost » (la résolution reste contrôlée par la politique IP). */
  allowLocalhostName?: boolean;
  /** Tests uniquement : autorise les adresses de bouclage. */
  allowLoopback?: boolean;
}

/** Valide une URL fournie par un utilisateur (avant toute résolution DNS). */
export function parseTargetUrl(input: string, opts: UrlPolicyOptions = {}): URL {
  if (typeof input !== "string" || input.length > 2048) throw new InvalidTargetError("invalid_url", "Adresse invalide");
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new InvalidTargetError("invalid_url", "Adresse invalide");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidTargetError("unsupported_protocol", "Seules les adresses http et https sont acceptées");
  }
  if (url.username || url.password) {
    throw new InvalidTargetError("credentials_in_url", "Les identifiants dans l'adresse ne sont pas acceptés");
  }
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!opts.allowAnyPort && !DEFAULT_ALLOWED_PORTS.has(port)) {
    throw new InvalidTargetError("blocked_port", "Port non autorisé (80, 443, 8080 ou 8443 uniquement)");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const isIpLiteral = /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[");
  if (isIpLiteral) {
    const literal = host.replace(/^\[|\]$/g, "");
    if (!isPublicAddress(literal, { allowLoopback: Boolean(opts.allowLoopback) && process.env.NODE_ENV !== "production" })) {
      throw new InvalidTargetError("blocked_host", "Adresse IP privée ou réservée non autorisée");
    }
  } else {
    if (host === "localhost" && !opts.allowLocalhostName) throw new InvalidTargetError("blocked_host", "Adresse locale non autorisée");
    if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) throw new InvalidTargetError("blocked_host", "Nom de domaine interne non autorisé");
    if (!host.includes(".") && host !== "localhost") throw new InvalidTargetError("blocked_host", "Nom de domaine incomplet");
  }
  url.hash = "";
  return url;
}

/** Forme canonique pour la mutualisation (suppression des paramètres de suivi, hôte en minuscules). */
export function canonicalUrl(url: URL): string {
  const u = new URL(url.toString());
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) u.port = "";
  return u.toString();
}
