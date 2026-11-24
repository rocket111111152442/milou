import type { MetadataRoute } from "next";
import { env } from "@/config/env";
import { indexable } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  if (!indexable()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
