import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SmoothScroll } from "@/components/SmoothScroll";
import { ScrollProgress } from "@/components/motion";
import { SITE } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": ["CafeOrCoffeeShop", "Restaurant"],
  "@id": `${SITE.url}/#business`,
  name: SITE.fullName,
  alternateName: "Chouet'House",
  description:
    "Coffee shop, salon de thé et restaurant familial à La Seyne-sur-Mer : brunchs, cookies maison, ateliers parents-enfants, anniversaires et stages pendant les vacances scolaires.",
  url: SITE.url,
  telephone: "+33 9 56 60 77 74",
  email: SITE.email,
  image: [`${SITE.url}/images/table-brunch.webp`, `${SITE.url}/images/pancakes.webp`],
  logo: `${SITE.url}/images/logo.webp`,
  priceRange: SITE.priceRange,
  servesCuisine: ["Brunch", "Salon de thé", "Pâtisserie maison"],
  acceptsReservations: true,
  address: {
    "@type": "PostalAddress",
    streetAddress: "2496 Avenue Pierre Auguste Renoir",
    postalCode: SITE.postalCode,
    addressLocality: SITE.city,
    addressRegion: "Provence-Alpes-Côte d'Azur",
    addressCountry: "FR",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "09:00",
      closes: "18:00",
    },
  ],
  amenityFeature: [
    { "@type": "LocationFeatureSpecification", name: "Accessible en fauteuil roulant", value: true },
    { "@type": "LocationFeatureSpecification", name: "Espace enfants", value: true },
    { "@type": "LocationFeatureSpecification", name: "Vente à emporter", value: true },
    { "@type": "LocationFeatureSpecification", name: "Livraison", value: true },
  ],
  sameAs: [SITE.instagram, SITE.facebook],
  areaServed: ["La Seyne-sur-Mer", "Toulon", "Six-Fours-les-Plages", "Sanary-sur-Mer", "Saint-Mandrier-sur-Mer", "Ollioules"],
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Aller au contenu
      </a>
      <ScrollProgress />
      <SmoothScroll />
      <Header />
      <main id="contenu" className="overflow-x-clip">{children}</main>
      <Footer />
    </>
  );
}
