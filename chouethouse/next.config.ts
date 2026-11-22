import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { formats: ["image/avif", "image/webp"] },
  // Anciennes URLs Wix -> nouvelles pages (301) pour conserver le référencement
  async redirects() {
    return [
      { source: "/book-online", destination: "/ateliers-enfants", permanent: true },
      { source: "/service-page/:slug*", destination: "/ateliers-enfants", permanent: true },
      { source: "/booking-calendar/:slug*", destination: "/ateliers-enfants", permanent: true },
      { source: "/reservations", destination: "/restaurant-brunch", permanent: true },
      { source: "/contact-10", destination: "/anniversaires", permanent: true },
      { source: "/event-list", destination: "/evenements", permanent: true },
      { source: "/experiences", destination: "/evenements", permanent: true },
      { source: "/general-6", destination: "/confidentialite", permanent: true },
      { source: "/franch-terms-conditions", destination: "/mentions-legales", permanent: true },
      { source: "/accessibility-statement", destination: "/mentions-legales", permanent: true },
    ];
  },
};

export default nextConfig;
