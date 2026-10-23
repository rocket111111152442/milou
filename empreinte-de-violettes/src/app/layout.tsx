import type { Metadata, Viewport } from "next";
import { Cinzel, Cormorant_Garamond, Jost } from "next/font/google";
import { getSettings } from "@/lib/catalog";
import { siteUrl } from "@/lib/orders";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const caps = Cinzel({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-caps", display: "swap" });
const sans = Jost({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-sans", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: s.seo.title, template: `%s — ${s.shopName}` },
    description: s.seo.description,
    applicationName: s.shopName,
    openGraph: { type: "website", locale: "fr_FR", siteName: s.shopName, title: s.seo.title, description: s.seo.description },
    twitter: { card: "summary_large_image", title: s.seo.title, description: s.seo.description },
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0E0912",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${caps.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(sessionStorage.getItem('ev-intro'))document.documentElement.dataset.intro='seen'}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
