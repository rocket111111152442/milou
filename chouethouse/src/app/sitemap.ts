import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getPosts } from "@/lib/store";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url;
  const pages = [
    { p: "", prio: 1 },
    { p: "/ateliers-enfants", prio: 0.9 },
    { p: "/restaurant-brunch", prio: 0.9 },
    { p: "/anniversaires", prio: 0.8 },
    { p: "/evenements", prio: 0.8 },
    { p: "/blog", prio: 0.7 },
    { p: "/contact", prio: 0.6 },
    { p: "/mentions-legales", prio: 0.2 },
    { p: "/confidentialite", prio: 0.2 },
  ].map(({ p, prio }) => ({ url: `${base}${p}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: prio }));
  const posts = (await getPosts()).map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt ?? post.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [...pages, ...posts];
}
