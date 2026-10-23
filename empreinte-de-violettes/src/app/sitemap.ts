import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/catalog";
import { siteUrl } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const pages = ["", "/boutique", "/atelier", "/mariage", "/deuil", "/la-maison", "/livraison", "/contact", "/faq", "/mentions-legales", "/cgv", "/confidentialite"];
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...categories.map((c) => ({ url: `${base}/boutique?categorie=${c.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((p) => ({ url: `${base}/boutique/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
