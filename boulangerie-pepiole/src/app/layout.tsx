import type { Metadata, Viewport } from "next";
import { Fraunces, Great_Vibes, Manrope } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";
import { SHOPS } from "@/lib/shops";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Preloader } from "@/components/Preloader";
import { CartDrawer, FloatingCart } from "@/components/cart/CartDrawer";
import { CartHydrator } from "@/components/cart/CartHydrator";
import { FlyLayer } from "@/components/cart/FlyToCart";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--nf-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});
const script = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--nf-script", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--nf-manrope", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} · Boulangerie artisanale à Sanary-sur-Mer et Six-Fours`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "boulangerie Sanary-sur-Mer",
    "boulangerie artisanale",
    "Pétrin de Pépiole",
    "pain au levain",
    "baguette tradition",
    "pâtisserie Sanary",
    "boulangerie ouverte dimanche Sanary",
    "boulangerie Six-Fours-les-Plages",
    "Maison Sernesi",
    "gare Ollioules Sanary",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE.name,
    title: `${SITE.name} · Artisan boulanger à Sanary-sur-Mer et Six-Fours`,
    description: SITE.description,
    images: [{ url: "/images/hero-croissants.jpg", width: 2000, height: 1333, alt: "Croissants dorés saupoudrés de farine" }],
  },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#24160d",
};

const dayCodes = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#maison`,
      name: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/icon.svg`,
      sameAs: [SITE.instagram.url],
    },
    ...SHOPS.map((shop) => ({
      "@type": "Bakery",
      "@id": `${SITE.url}/#${shop.id}`,
      name: `${shop.name} – ${shop.city}`,
      parentOrganization: { "@id": `${SITE.url}/#maison` },
      url: `${SITE.url}/#boutiques`,
      telephone: shop.phone.href.replace("tel:", ""),
      image: `${SITE.url}${shop.image}`,
      priceRange: "€",
      servesCuisine: "Boulangerie, pâtisserie française",
      address: {
        "@type": "PostalAddress",
        streetAddress: shop.address.street,
        postalCode: shop.address.postalCode,
        addressLocality: shop.address.city,
        addressRegion: "Provence-Alpes-Côte d'Azur",
        addressCountry: "FR",
      },
      geo: { "@type": "GeoCoordinates", latitude: shop.geo.lat, longitude: shop.geo.lng },
      openingHoursSpecification: Object.entries(shop.hours).flatMap(([d, ranges]) =>
        ranges.map(([opens, closes]) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: `https://schema.org/${dayCodes[Number(d)]}`,
          opens,
          closes,
        })),
      ),
    })),
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${script.variable} ${manrope.variable}`}>
      <body className="min-h-dvh">
        <noscript>
          <style>{`#preloader{display:none!important}`}</style>
        </noscript>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <a
          href="#contenu"
          className="sr-only z-[200] rounded-full bg-cafe px-4 py-2 text-creme focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Aller au contenu
        </a>
        <SmoothScroll>
          <Preloader />
          <CartHydrator />
          <Header />
          <main id="contenu">{children}</main>
          <Footer />
          <FloatingCart />
          <CartDrawer />
          <FlyLayer />
        </SmoothScroll>
      </body>
    </html>
  );
}
