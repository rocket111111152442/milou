import "server-only";
import { unstable_cache } from "next/cache";
import { and, desc, desktopReleases, eq } from "@waverti/database";
import { getDb, isDatabaseConfigured } from "./db";

export type { PublicRelease } from "./release-parse";
import type { PublicRelease } from "./release-parse";
import { githubReleasesEnabled, loadGithubReleases } from "./github-releases";

/**
 * Seules les versions explicitement publiées sont proposées au téléchargement (base : is_published ; GitHub : version
 * publiée avec marqueur de tests et sommes de contrôle). Aucun bouton actif n'est affiché sans fichier réel testé.
 */
export const getPublishedReleases = unstable_cache(
  async (): Promise<PublicRelease[]> => {
    const fromGithub = async (): Promise<PublicRelease[]> => (githubReleasesEnabled() ? loadGithubReleases() : []);
    if (!isDatabaseConfigured()) return fromGithub();
    try {
      const rows = await getDb()
        .select()
        .from(desktopReleases)
        .where(and(eq(desktopReleases.isPublished, true)))
        .orderBy(desc(desktopReleases.publishedAt));
      // Les versions enregistrées en base (publication manuelle) priment ; sinon on lit les versions publiques GitHub.
      if (!rows.length) return fromGithub();
      return rows.map((r) => ({
        version: r.version,
        platform: r.platform,
        arch: r.arch,
        packageType: r.packageType,
        url: r.url,
        sha256: r.sha256,
        sizeBytes: r.sizeBytes,
        codeSigned: r.codeSigned,
        testedOn: r.testedOn,
        publishedAt: r.publishedAt?.toISOString() ?? null,
      }));
    } catch (err) {
      console.error("releases: lecture impossible", (err as Error).message);
      return fromGithub();
    }
  },
  ["desktop-releases"],
  { revalidate: 600, tags: ["releases"] },
);
