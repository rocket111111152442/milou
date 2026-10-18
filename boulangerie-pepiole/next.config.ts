import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
  // Envoi des photos de produits depuis /admin
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
