import "server-only";
import { CHECKSUMS_NAME, isSafeRepo, latestPublished, parseChecksums, releasesFromGithub, TAG_PREFIX, type GithubRelease, type PublicRelease } from "./release-parse";

/** Dépôt public contenant les versions de l'application (modifiable par WAVERTI_RELEASES_REPO). */
export const DEFAULT_RELEASES_REPO = "rocket111111152442/milou";

/** Actif sur Vercel (Preview et Production) ou si WAVERTI_RELEASES_REPO est défini ; inactif en local et en CI de test. */
export function githubReleasesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.WAVERTI_RELEASES_REPO) || env.VERCEL === "1";
}

const MAX_JSON_BYTES = 1_000_000;
const MAX_SUMS_BYTES = 64 * 1024;

async function readCapped(res: Response, max: number): Promise<string | null> {
  const text = await res.text();
  return text.length > max ? null : text;
}

/**
 * Lit les versions publiques du dépôt (API GitHub sans authentification, délai court). Toute erreur → liste vide :
 * la page affiche alors « bientôt disponible », jamais un lien incertain.
 */
export async function loadGithubReleases(opts: { repo?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<PublicRelease[]> {
  const repo = opts.repo ?? process.env.WAVERTI_RELEASES_REPO ?? DEFAULT_RELEASES_REPO;
  if (!isSafeRepo(repo)) return [];
  const f = opts.fetchImpl ?? fetch;
  const timeout = opts.timeoutMs ?? 5000;
  try {
    const res = await f(`https://api.github.com/repos/${repo}/releases?per_page=20`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "waverti-site" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return [];
    const json = await readCapped(res, MAX_JSON_BYTES);
    if (!json) return [];
    const releases = JSON.parse(json) as GithubRelease[];
    if (!Array.isArray(releases)) return [];
    const latest = latestPublished(releases);
    if (!latest || !latest.release.assets.some((a) => a.name === CHECKSUMS_NAME)) return [];
    const sumsRes = await f(`https://github.com/${repo}/releases/download/${TAG_PREFIX}${latest.version}/${CHECKSUMS_NAME}`, {
      headers: { "user-agent": "waverti-site" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!sumsRes.ok) return [];
    const sums = await readCapped(sumsRes, MAX_SUMS_BYTES);
    if (!sums) return [];
    return releasesFromGithub(latest.release, latest.version, parseChecksums(sums), repo);
  } catch (err) {
    console.error("releases: lecture GitHub impossible", (err as Error).message);
    return [];
  }
}
