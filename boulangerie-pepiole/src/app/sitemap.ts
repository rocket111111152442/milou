import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/carte", "/mentions-legales"].map((path) => ({
    url: `${SITE.url}${path}`,
    changeFrequency: path === "/carte" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
