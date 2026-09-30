import type { Metadata, Viewport } from "next";
import "@fontsource/anton";
import "@fontsource-variable/inter-tight";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Biorythme — Clubs de sport à Six-Fours & Sanary", template: "%s · Biorythme" },
  description:
    "Biorythme, vos clubs de fitness à Six-Fours-les-Plages et Sanary-sur-Mer. Cours collectifs, musculation, cardio. Réservez votre cours en ligne en temps réel.",
};

export const viewport: Viewport = { themeColor: "#0a0a0a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="grain min-h-dvh">{children}</body>
    </html>
  );
}
