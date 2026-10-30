/**
 * Preuve de propriété d'un site, préalable à tout contrôle Business :
 * - DNS : enregistrement TXT contenant le jeton, sur `_waverti.<domaine>` ou sur le domaine ;
 * - fichier : https://<domaine>/.well-known/waverti-verification.txt contenant le jeton.
 */
import { resolveTxt } from "node:dns/promises";
import { and, businessSites, eq, siteVerifications, sql, type Database } from "@waverti/database";
import { decodeBody, FetchError, safeFetch, type SafeFetchOptions } from "../net/safe-fetch";
import { BusinessError, hostInDomain } from "./service";

export type TxtResolver = (name: string) => Promise<string[][]>;

export interface VerifyDeps {
  resolveTxt?: TxtResolver;
  fetchOptions?: SafeFetchOptions;
  /** Tests uniquement : URL de base remplaçant https://<domaine>. */
  fileBaseUrl?: string;
}

export const VERIFICATION_FILE_PATH = "/.well-known/waverti-verification.txt";
const MIN_INTERVAL_MS = 15_000;

export function verificationInstructions(domain: string, token: string) {
  return {
    dns: { host: `_waverti.${domain}`, type: "TXT", value: token },
    file: { url: `https://${domain}${VERIFICATION_FILE_PATH}`, content: token },
  };
}

async function checkDns(domain: string, token: string, resolver: TxtResolver): Promise<{ ok: boolean; detail: string }> {
  for (const name of [`_waverti.${domain}`, domain]) {
    try {
      const records = await resolver(name);
      if (records.some((chunks) => chunks.join("").trim() === token)) return { ok: true, detail: `TXT trouvé sur ${name}` };
    } catch {
      // NXDOMAIN / pas d'enregistrement : on essaie le nom suivant.
    }
  }
  return { ok: false, detail: `Aucun enregistrement TXT « ${token} » sur _waverti.${domain} ni sur ${domain}.` };
}

async function checkFile(domain: string, token: string, deps: VerifyDeps): Promise<{ ok: boolean; detail: string }> {
  const url = `${deps.fileBaseUrl ?? `https://${domain}`}${VERIFICATION_FILE_PATH}`;
  try {
    const res = await safeFetch(url, { ...deps.fetchOptions, timeoutMs: 10_000, maxBytes: 4096, accept: "text/plain,*/*;q=0.1" });
    const finalHost = new URL(res.finalUrl).hostname;
    if (!deps.fileBaseUrl && !hostInDomain(finalHost, domain)) {
      return { ok: false, detail: "Le fichier redirige vers un autre domaine." };
    }
    if (res.status !== 200) return { ok: false, detail: `Fichier introuvable (HTTP ${res.status}).` };
    const body = decodeBody(res.body, res.contentType).trim();
    return body.split(/\r?\n/).some((l) => l.trim() === token)
      ? { ok: true, detail: "Fichier de vérification trouvé" }
      : { ok: false, detail: "Le fichier ne contient pas le jeton attendu." };
  } catch (err) {
    return { ok: false, detail: err instanceof FetchError ? err.message : "Fichier inaccessible." };
  }
}

export async function verifySite(
  db: Database,
  userId: string,
  siteId: string,
  method: "dns" | "file",
  deps: VerifyDeps = {},
  now = new Date(),
): Promise<{ verified: boolean; detail: string }> {
  const [site] = await db
    .select()
    .from(businessSites)
    .where(and(eq(businessSites.id, siteId), eq(businessSites.userId, userId)))
    .limit(1);
  if (!site) throw new BusinessError("not_found", "Site introuvable.");
  if (site.status === "verified") return { verified: true, detail: "Site déjà vérifié." };
  if (site.lastVerificationAttemptAt && now.getTime() - site.lastVerificationAttemptAt.getTime() < MIN_INTERVAL_MS) {
    throw new BusinessError("too_soon", "Patientez quelques secondes avant un nouvel essai.");
  }
  await db.update(businessSites).set({ lastVerificationAttemptAt: now }).where(eq(businessSites.id, siteId));

  const result =
    method === "dns"
      ? await checkDns(site.domain, site.verificationToken, deps.resolveTxt ?? resolveTxt)
      : await checkFile(site.domain, site.verificationToken, deps);

  await db.insert(siteVerifications).values({ siteId, userId, method, success: result.ok, detail: result.detail.slice(0, 500) });
  if (result.ok) {
    await db
      .update(businessSites)
      .set({ status: "verified", verificationMethod: method, verifiedAt: now, nextTlsCheckAt: now })
      .where(and(eq(businessSites.id, siteId), sql`${businessSites.status} = 'pending_verification'`));
  }
  return { verified: result.ok, detail: result.detail };
}
