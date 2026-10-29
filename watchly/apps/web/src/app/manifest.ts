import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Watchly",
    short_name: "Watchly",
    description: "Assistant de surveillance d'Internet.",
    start_url: "/app",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#111118",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
