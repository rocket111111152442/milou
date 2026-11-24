import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Files read at runtime with fs (demo catalogue, knowledge base, SQL migrations, PGlite WASM)
  outputFileTracingIncludes: {
    "/**": ["./data/**/*", "./drizzle/**/*", "./node_modules/@electric-sql/pglite/dist/**/*"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "assets.alterestate.com" },
      { protocol: "https", hostname: "d2p0bx8wfdkjkb.cloudfront.net" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  // Redirections from the URLs of the current AlterEstate site (see docs/MIGRACION-URLS.md).
  async redirects() {
    return [
      { source: "/elvyn-arnaud-exprealty", destination: "/nosotros", permanent: true },
      { source: "/agente/elvyn-arnaud", destination: "/nosotros", permanent: true },
      { source: "/agente/:slug", destination: "/agentes", permanent: true },
      { source: "/rent", destination: "/alquiler", permanent: true },
      { source: "/blog", destination: "/", permanent: true },
      { source: "/blog/:path*", destination: "/", permanent: true },
      { source: "/testimonios", destination: "/", permanent: true },
    ];
  },
};

export default config;
