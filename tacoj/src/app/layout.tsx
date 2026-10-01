import type { Metadata, Viewport } from "next";
import { Anton, DM_Sans, Caveat_Brush } from "next/font/google";
import { brand, locations } from "@/data/site";
import "./globals.css";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const hand = Caveat_Brush({ weight: "400", subsets: ["latin"], variable: "--font-hand", display: "swap" });

const description =
  "Bold Mexican street food with a local twist — beachfront in Liwa, San Felipe and late nights in Subic Bay (SBMA). Find your branch, today's hours and the menu.";

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.fullName} | Bold Mexican street food in Zambales`,
  description,
  openGraph: { title: `${brand.name} · ${brand.fullName}`, description, type: "website", locale: "en_PH" },
  twitter: { card: "summary_large_image", title: `${brand.name} · ${brand.fullName}`, description },
};

export const viewport: Viewport = { themeColor: "#1B1614", width: "device-width", initialScale: 1 };

const dayCode = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": locations.map((l) => ({
    "@type": "Restaurant",
    name: l.name,
    servesCuisine: "Mexican-inspired street food",
    telephone: l.phones[0]?.tel,
    address: { "@type": "PostalAddress", streetAddress: l.address[0], addressLocality: l.address[1], addressRegion: "Zambales", addressCountry: "PH" },
    sameAs: [brand.instagramUrl],
    openingHoursSpecification: l.hours.map((r) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: r.days.map((d) => dayCode[d]),
      opens: r.open,
      closes: r.close,
    })),
  })),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${hand.variable}`}>
      <body>
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  );
}
