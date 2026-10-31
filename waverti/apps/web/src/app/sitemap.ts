import type { MetadataRoute } from "next";
import { seoPages } from "@/lib/seo-content";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const staticPaths = ["", "/tarifs", "/entreprises", "/telecharger", "/assistance", "/robot", "/fonctionnement"];
  const legal = ["/legal/conditions-generales", "/legal/confidentialite", "/legal/cookies", "/legal/mentions-legales"];
  return [
    ...staticPaths.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.8 })),
    ...Object.keys(seoPages).map((slug) => ({ url: `${base}/${slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...legal.map((p) => ({ url: `${base}${p}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
