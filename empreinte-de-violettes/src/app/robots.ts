import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/commande", "/suivi"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
