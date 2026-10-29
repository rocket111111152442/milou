import "server-only";
import { unstable_cache } from "next/cache";
import { and, desc, desktopReleases, eq } from "@watchly/database";
import { getDb, isDatabaseConfigured } from "./db";

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

/**
 * Seules les versions explicitement publiées (is_published) sont proposées au téléchargement :
 * aucun bouton actif n'est affiché sans fichier réel testé.
 */
export const getPublishedReleases = unstable_cache(
  async (): Promise<PublicRelease[]> => {
    if (!isDatabaseConfigured()) return [];
    try {
      const rows = await getDb()
        .select()
        .from(desktopReleases)
        .where(and(eq(desktopReleases.isPublished, true)))
        .orderBy(desc(desktopReleases.publishedAt));
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
      return [];
    }
  },
  ["desktop-releases"],
  { revalidate: 600, tags: ["releases"] },
);
