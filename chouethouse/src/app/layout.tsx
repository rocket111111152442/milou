import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito, Caveat } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", weight: ["400", "500", "600", "700"], display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", weight: ["500", "700"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Chouet'House – Coffee shop familial, brunch & ateliers enfants à La Seyne-sur-Mer",
    template: "%s | Chouet'House La Seyne-sur-Mer",
  },
  description:
    "Coffee shop, salon de thé et restaurant familial à La Seyne-sur-Mer (Var) : brunchs, cookies maison, ateliers parents-enfants dès 0 an, anniversaires et stages vacances. Ouvert du lundi au samedi, 9 h – 18 h.",
  keywords: [
    "coffee shop La Seyne-sur-Mer",
    "salon de thé La Seyne-sur-Mer",
    "brunch La Seyne-sur-Mer",
    "café familial Toulon",
    "ateliers parents enfants Var",
    "anniversaire enfant La Seyne-sur-Mer",
    "éveil bébé Toulon",
    "anglais enfant La Seyne-sur-Mer",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Chouet'House",
    images: [{ url: "/images/table-brunch.webp", width: 1400, height: 2100, alt: "Brunch chez Chouet'House" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#fff7ee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fredoka.variable} ${nunito.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
