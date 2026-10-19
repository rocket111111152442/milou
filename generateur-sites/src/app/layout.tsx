import type { Metadata, Viewport } from "next";
import { Fraunces, Great_Vibes, Manrope } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--nf-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});
const script = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--nf-script", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--nf-manrope", display: "swap" });

// Les sites générés sont des démonstrations : jamais indexés par les moteurs de recherche.
export const metadata: Metadata = {
  title: "Studio · générateur de sites",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#24160d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${script.variable} ${manrope.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
