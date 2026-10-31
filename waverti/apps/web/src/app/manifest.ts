import type { MetadataRoute } from "next";

/** Manifeste de l'application installable (PWA) : iPhone, Android et ordinateur, sans boutique d'applications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Waverti",
    short_name: "Waverti",
    description: "Surveillance de pages web, de prix et de sujets sur Internet. Alertes en temps réel.",
    lang: "fr",
    dir: "ltr",
    start_url: "/app?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    categories: ["productivity", "utilities", "shopping"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Alertes", url: "/app/alertes", icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }] },
      { name: "Mes surveillances", url: "/app/surveillances", icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }] },
      { name: "Nouvelle surveillance", url: "/app/surveillances/nouvelle", icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
