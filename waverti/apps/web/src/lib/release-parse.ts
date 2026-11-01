/**
 * Lecture des versions publiées de l'application desktop depuis les « releases » GitHub (dépôt public).
 * Fonctions pures (aucun accès réseau) : testées sans serveur.
 *
 * Règle : un installateur n'est proposé au téléchargement que si
 *  - sa version GitHub est PUBLIÉE (ni brouillon) et son tag est « waverti-desktop-vX.Y.Z » ;
 *  - la note de version porte le marqueur écrit par le workflow, qui liste les installateurs réellement testés en CI ;
 *  - son empreinte SHA-256 figure dans SHA256SUMS.txt.
 * Les adresses de téléchargement sont reconstruites (jamais reprises telles quelles de l'API).
 */

export interface PublicRelease {
  version: string;
  platform: "windows" | "macos" | "linux";
  arch: string;
  packageType: string;
  url: string;
  sha256: string;
  sizeBytes: number | null;
  codeSigned: boolean;
  testedOn: string | null;
  publishedAt: string | null;
}

export interface GithubAsset {
  name: string;
  size?: number;
}

export interface GithubRelease {
  tag_name: string;
  draft: boolean;
  prerelease?: boolean;
  published_at: string | null;
  body: string | null;
  assets: GithubAsset[];
}

export const TAG_PREFIX = "waverti-desktop-v";
export const CHECKSUMS_NAME = "SHA256SUMS.txt";

const SAFE_NAME = /^[A-Za-z0-9._()+-]{1,200}$/;
const SAFE_REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const MARKER = /<!--\s*waverti-release\s+(\{[\s\S]*?\})\s*-->/;

export interface ReleaseMarker {
  /** clé d'installateur (« windows:nsis », « linux:deb »…) → description du test réalisé */
  tested: Record<string, string>;
  testedSha?: string;
}

export function parseReleaseMarker(body: string | null | undefined): ReleaseMarker | null {
  const m = MARKER.exec(body ?? "");
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]!) as { tested?: unknown; testedSha?: unknown };
    if (!parsed.tested || typeof parsed.tested !== "object") return null;
    const tested: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.tested as Record<string, unknown>)) if (typeof v === "string" && v.trim()) tested[k] = v.trim().slice(0, 300);
    return { tested, testedSha: typeof parsed.testedSha === "string" && /^[0-9a-f]{7,64}$/.test(parsed.testedSha) ? parsed.testedSha : undefined };
  } catch {
    return null;
  }
}

/** Contenu de SHA256SUMS.txt (« <sha256>  <fichier> », format de `sha256sum`). Les lignes invalides sont ignorées. */
export function parseChecksums(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(line);
    if (m) out.set(m[2]!.replace(/^\.\//, ""), m[1]!.toLowerCase());
  }
  return out;
}

export interface AssetKind {
  key: string;
  platform: PublicRelease["platform"];
  arch: "x86_64" | "aarch64";
  packageType: "nsis" | "msi" | "deb" | "appimage" | "rpm" | "dmg";
}

/** Reconnaît un installateur par son nom de fichier (noms produits par Tauri) et sa version. */
export function classifyAsset(name: string, version: string): AssetKind | null {
  const v = version.replace(/[.]/g, "\\.");
  const rules: Array<[RegExp, AssetKind]> = [
    [new RegExp(`^Waverti_${v}_x64-setup\\.exe$`), { key: "windows:nsis", platform: "windows", arch: "x86_64", packageType: "nsis" }],
    [new RegExp(`^Waverti_${v}_x64_[A-Za-z-]+\\.msi$`), { key: "windows:msi", platform: "windows", arch: "x86_64", packageType: "msi" }],
    [new RegExp(`^Waverti_${v}_amd64\\.deb$`), { key: "linux:deb", platform: "linux", arch: "x86_64", packageType: "deb" }],
    [new RegExp(`^Waverti_${v}_amd64\\.AppImage$`), { key: "linux:appimage", platform: "linux", arch: "x86_64", packageType: "appimage" }],
    [new RegExp(`^Waverti-${v}-\\d+\\.x86_64\\.rpm$`), { key: "linux:rpm", platform: "linux", arch: "x86_64", packageType: "rpm" }],
    [new RegExp(`^Waverti_${v}_aarch64\\.dmg$`), { key: "macos:dmg:aarch64", platform: "macos", arch: "aarch64", packageType: "dmg" }],
    [new RegExp(`^Waverti_${v}_x64\\.dmg$`), { key: "macos:dmg:x86_64", platform: "macos", arch: "x86_64", packageType: "dmg" }],
  ];
  for (const [re, kind] of rules) if (re.test(name)) return kind;
  return null;
}

const semver = (v: string): number[] => v.split(".").map((n) => Number(n));
function compareVersions(a: string, b: string): number {
  const x = semver(a);
  const y = semver(b);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

export function versionOfTag(tag: string): string | null {
  if (!tag.startsWith(TAG_PREFIX)) return null;
  const v = tag.slice(TAG_PREFIX.length);
  return /^\d+\.\d+\.\d+$/.test(v) ? v : null;
}

/** La version publiée la plus récente (hors brouillons, tags étrangers). */
export function latestPublished(releases: GithubRelease[]): { release: GithubRelease; version: string } | null {
  const candidates = releases
    .filter((r) => !r.draft && Boolean(r.published_at))
    .map((r) => ({ release: r, version: versionOfTag(r.tag_name) }))
    .filter((x): x is { release: GithubRelease; version: string } => x.version !== null);
  candidates.sort((a, b) => compareVersions(b.version, a.version));
  return candidates[0] ?? null;
}

const ORDER = ["windows:nsis", "windows:msi", "macos:dmg:aarch64", "macos:dmg:x86_64", "linux:deb", "linux:appimage", "linux:rpm"];

/**
 * Installateurs proposables d'une version : publiés, testés (marqueur), au contrôle d'intégrité connu.
 * Retourne [] si une condition manque : jamais de lien « par défaut ».
 */
export function releasesFromGithub(release: GithubRelease, version: string, checksums: Map<string, string>, repo: string): PublicRelease[] {
  if (!SAFE_REPO.test(repo)) return [];
  const marker = parseReleaseMarker(release.body);
  if (!marker) return [];
  const out: Array<PublicRelease & { _key: string }> = [];
  for (const asset of release.assets) {
    if (!SAFE_NAME.test(asset.name)) continue;
    const kind = classifyAsset(asset.name, version);
    if (!kind) continue;
    const testedOn = marker.tested[kind.key];
    const sha256 = checksums.get(asset.name);
    if (!testedOn || !sha256) continue;
    out.push({
      _key: kind.key,
      version,
      platform: kind.platform,
      arch: kind.arch,
      packageType: kind.packageType,
      url: `https://github.com/${repo}/releases/download/${TAG_PREFIX}${version}/${encodeURIComponent(asset.name)}`,
      sha256,
      sizeBytes: typeof asset.size === "number" && asset.size > 0 ? asset.size : null,
      // Aucun certificat de signature n'est utilisé : le site l'indique toujours.
      codeSigned: false,
      testedOn,
      publishedAt: release.published_at,
    });
  }
  out.sort((a, b) => ORDER.indexOf(a._key) - ORDER.indexOf(b._key));
  return out.map(({ _key, ...r }) => (void _key, r));
}

export function isSafeRepo(repo: string): boolean {
  return SAFE_REPO.test(repo);
}
