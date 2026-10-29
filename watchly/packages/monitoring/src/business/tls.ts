/**
 * Vérification quotidienne du certificat HTTPS d'un site vérifié : validité de la chaîne,
 * correspondance du nom, date d'expiration. Connexion uniquement vers une adresse publique.
 */
import { lookup } from "node:dns/promises";
import tls from "node:tls";
import { sql, type Database } from "@watchly/database";
import { isPublicAddress } from "../net/ip-policy";
import { openIncident, resolveIncident } from "./incidents";

export const TLS_WARN_DAYS = 14;
const DAY_MS = 86_400_000;

export interface TlsCheckResult {
  ok: boolean;
  validTo: Date | null;
  issuer: string | null;
  errorCode: string | null;
  error: string | null;
}

const ERROR_LABELS: Record<string, string> = {
  CERT_HAS_EXPIRED: "Le certificat a expiré.",
  DEPTH_ZERO_SELF_SIGNED_CERT: "Certificat auto-signé (non reconnu par les navigateurs).",
  SELF_SIGNED_CERT_IN_CHAIN: "Chaîne de certificats non reconnue.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Chaîne de certificats incomplète.",
  ERR_TLS_CERT_ALTNAME_INVALID: "Le certificat ne correspond pas au nom du site.",
  CERT_NOT_YET_VALID: "Le certificat n'est pas encore valide.",
};

/** Problème de certificat (définitif) par opposition à une erreur réseau passagère. */
export function isCertificateProblem(code: string | null): boolean {
  return Boolean(code && (code in ERROR_LABELS || code.includes("CERT")));
}

export interface TlsOptions {
  port?: number;
  timeoutMs?: number;
  /** Tests uniquement. */
  allowLoopback?: boolean;
  ca?: string | Buffer;
  resolve?: (host: string) => Promise<string[]>;
}

async function defaultResolve(host: string): Promise<string[]> {
  return (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
}

export async function checkTls(host: string, opts: TlsOptions = {}): Promise<TlsCheckResult> {
  let addresses: string[];
  try {
    addresses = await (opts.resolve ?? defaultResolve)(host);
  } catch {
    return { ok: false, validTo: null, issuer: null, errorCode: "dns_error", error: "Nom de domaine introuvable." };
  }
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a, { allowLoopback: Boolean(opts.allowLoopback) && process.env.NODE_ENV !== "production" }))) {
    return { ok: false, validTo: null, issuer: null, errorCode: "blocked_address", error: "Adresse privée ou réservée refusée." };
  }
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: addresses[0],
      port: opts.port ?? 443,
      servername: host,
      rejectUnauthorized: true,
      timeout: opts.timeoutMs ?? 10_000,
      ca: opts.ca,
      ALPNProtocols: ["http/1.1"],
    });
    const done = (r: TlsCheckResult) => {
      socket.destroy();
      resolve(r);
    };
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
      const issuer = cert?.issuer ? [cert.issuer.O, cert.issuer.CN].filter(Boolean).join(" — ") || null : null;
      done({ ok: true, validTo, issuer, errorCode: null, error: null });
    });
    socket.once("timeout", () => done({ ok: false, validTo: null, issuer: null, errorCode: "timeout", error: "Délai dépassé." }));
    socket.once("error", (err: NodeJS.ErrnoException) => {
      const code = err.code ?? "tls_error";
      done({ ok: false, validTo: null, issuer: null, errorCode: code, error: ERROR_LABELS[code] ?? "Connexion HTTPS impossible." });
    });
  });
}

type DueSite = {
  id: string;
  user_id: string;
  name: string;
  domain: string;
  tls_valid_to: Date | null;
};

/** Contrôle des certificats arrivés à échéance (une fois par jour et par site). */
export async function runTlsPass(db: Database, opts: { max: number; tls?: TlsOptions; now?: Date }): Promise<number> {
  const now = opts.now ?? new Date();
  const due = await db.execute<DueSite>(sql`
    with d as (
      select s.id from business_sites s
      join entitlements en on en.user_id = s.user_id and en.business_tls_checks
      join profiles p on p.id = s.user_id and p.suspended_at is null
      where s.status = 'verified' and coalesce(s.next_tls_check_at, now()) <= ${now.toISOString()}::timestamptz
        and (s.tls_lease_expires_at is null or s.tls_lease_expires_at < ${now.toISOString()}::timestamptz)
      order by s.next_tls_check_at nulls first
      limit ${opts.max}
      for update of s skip locked
    )
    update business_sites s set tls_lease_expires_at = ${new Date(now.getTime() + 120_000).toISOString()}::timestamptz
    from d where s.id = d.id
    returning s.id, s.user_id, s.name, s.domain, s.tls_valid_to`);

  for (const site of due) {
    const r = await checkTls(site.domain, opts.tls);
    const daysLeft = r.validTo ? Math.floor((r.validTo.getTime() - now.getTime()) / DAY_MS) : null;
    // Erreur réseau passagère : pas d'incident, nouvel essai dans une heure.
    const transient = !r.ok && !isCertificateProblem(r.errorCode);
    const problem = transient ? null : !r.ok ? r.error : daysLeft !== null && daysLeft < TLS_WARN_DAYS ? `Le certificat expire dans ${Math.max(0, daysLeft)} jour(s).` : null;
    const nextCheck = new Date(now.getTime() + (transient ? 3_600_000 : DAY_MS));
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        update business_sites set tls_valid_to = coalesce(${r.validTo?.toISOString() ?? null}::timestamptz, tls_valid_to),
          tls_issuer = coalesce(${r.issuer}, tls_issuer),
          tls_checked_at = ${now.toISOString()}::timestamptz, tls_error = ${r.ok ? null : r.error},
          next_tls_check_at = ${nextCheck.toISOString()}::timestamptz, tls_lease_expires_at = null
        where id = ${site.id}`);
      if (problem) {
        await openIncident(tx, {
          userId: site.user_id,
          siteId: site.id,
          siteName: site.name,
          kind: "tls",
          title: r.ok ? "Certificat HTTPS bientôt expiré" : "Certificat HTTPS invalide",
          cause: problem,
          startedAt: now,
          lastError: r.error,
          confirmation: "Constaté lors du contrôle quotidien du certificat.",
          now,
        });
      } else if (!transient) {
        await resolveIncident(tx, { userId: site.user_id, siteName: site.name, tlsSiteId: site.id }, "Le certificat HTTPS est de nouveau valide.", now);
      }
    });
  }
  return due.length;
}
