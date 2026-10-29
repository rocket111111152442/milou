import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (siteConfig.launchStatus === "preview") {
    // Prévisualisation : pas d'indexation tant que le service n'est pas lancé.
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/auth"] }],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
