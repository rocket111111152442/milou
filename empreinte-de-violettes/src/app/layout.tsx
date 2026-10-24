import type { Metadata, Viewport } from "next";
import { Fraunces, Jost, Newsreader } from "next/font/google";
import { getSettings } from "@/lib/catalog";
import { siteUrl } from "@/lib/orders";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz", "SOFT"], variable: "--font-display", display: "swap" });
const text = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-text", display: "swap" });
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
  themeColor: "#dccbd8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${text.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(sessionStorage.getItem('ev-intro'))document.documentElement.dataset.intro='seen'}catch(e){}",
          }}
        />
      </head>
      <body className="h-paper font-text">{children}</body>
    </html>
  );
}
