import type { MetadataRoute } from "next";
import { env } from "@/config/env";
import { href, type RouteKey } from "@/i18n/config";
import { getInventory } from "@/lib/catalog/service";
import { indexable } from "@/lib/seo/metadata";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexable()) return []; // previews and demo data are never submitted
  const abs = (p: string) => `${env.siteUrl}${p}`;
  const pages: RouteKey[] = ["home", "catalog", "sale", "rent", "about", "team", "services", "sell", "contact", "privacy"];
  const entries: MetadataRoute.Sitemap = pages.map((r) => ({
    url: abs(href("es", r)),
    changeFrequency: r === "catalog" || r === "sale" || r === "rent" ? "daily" : "monthly",
    priority: r === "home" ? 1 : r === "privacy" ? 0.2 : 0.8,
    alternates: { languages: { es: abs(href("es", r)), en: abs(href("en", r)) } },
  }));
  try {
    for (const l of await getInventory()) {
      entries.push({
        url: abs(href("es", "listing", l.slug)),
        lastModified: l.createdAt ? new Date(l.createdAt) : undefined,
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: { languages: { es: abs(href("es", "listing", l.slug)), en: abs(href("en", "listing", l.slug)) } },
      });
    }
  } catch {
    /* catalogue unavailable: static pages only */
  }
  return entries;
}
