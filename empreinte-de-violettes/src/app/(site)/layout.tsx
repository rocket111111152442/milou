import { cookies } from "next/headers";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { Bag } from "@/components/herbier/Bag";
import { Colophon } from "@/components/herbier/Colophon";
import { Label } from "@/components/herbier/Label";
import { Masthead, type MenuData } from "@/components/herbier/Masthead";
import { ADMIN_COOKIE, verifySession } from "@/lib/auth";
import { getCategories, getContent, getDelivery, getSettings } from "@/lib/catalog";
import { hhmm } from "@/lib/format";
import { siteUrl } from "@/lib/orders";
import { IMG } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, delivery] = await Promise.all([getSettings(), getCategories(), getDelivery(), getContent()]);
  const isAdmin = await verifySession((await cookies()).get(ADMIN_COOKIE)?.value);

  if (settings.maintenance.enabled && !isAdmin) {
    return (
      <main className="h-paper flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Label size="md" />
        <h1 className="mt-12 max-w-2xl font-display text-[clamp(2rem,4vw,3.4rem)] italic leading-tight">{settings.maintenance.message}</h1>
        <p className="body-text mt-6">
          {settings.address}, {settings.postcode} {settings.city} · {settings.phone}
        </p>
      </main>
    );
  }

  const cats = categories.filter((c) => c.showInMenu).map((c) => ({ href: `/boutique?categorie=${c.slug}`, label: c.name }));
  const tuesday = settings.hours.find((h) => h.day === 2);
  const menu: MenuData = {
    links: [
      { href: "/boutique", label: "La boutique", note: "bouquets, plantes, séchées", plate: "bouquet-ancien" },
      { href: "/atelier", label: "L'atelier", note: "composer tige par tige", plate: "renoncule" },
      { href: "/mariage", label: "Mariages", note: "sur rendez-vous", plate: "lys" },
      { href: "/deuil", label: "Deuil & hommage", note: "livré aux funérariums", plate: "anemone-lys" },
      { href: "/la-maison", label: "La Maison", note: "depuis 2022", plate: "violette" },
      { href: "/livraison", label: "Livraison & retrait", note: "Six-Fours et alentours", plate: "eucalyptus" },
      { href: "/contact", label: "Nous écrire", note: settings.phone, plate: "pensee" },
      { href: "/faq", label: "Questions fréquentes", note: "bon à savoir", plate: "fougere" },
    ],
    categories: cats,
    phone: settings.phone,
    address: `${settings.address}, ${settings.postcode} ${settings.city}`,
    instagram: settings.instagram,
    facebook: settings.facebook,
    hoursLine: tuesday && !tuesday.closed ? `Du mardi au samedi, ${tuesday.ranges.map((r) => `${hhmm(r.from)}–${hhmm(r.to)}`).join(" et ")} · dimanche matin` : "",
    announcement: settings.announcement.active ? { text: settings.announcement.text, link: settings.announcement.link } : null,
  };
  const mainZone = delivery.zones.find((z) => z.active && z.freeFrom != null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Florist",
    name: settings.shopName,
    description: settings.seo.description,
    url: siteUrl(),
    telephone: settings.phone,
    image: IMG.darkBouquet,
    priceRange: "€€",
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address,
      postalCode: settings.postcode,
      addressLocality: settings.city,
      addressCountry: "FR",
    },
    geo: { "@type": "GeoCoordinates", latitude: settings.lat, longitude: settings.lng },
    sameAs: [settings.instagram, settings.facebook],
    aggregateRating: { "@type": "AggregateRating", ratingValue: settings.googleRating, reviewCount: settings.googleReviews },
    openingHoursSpecification: settings.hours
      .filter((h) => !h.closed)
      .flatMap((h) =>
        h.ranges.map((r) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][h.day],
          opens: r.from,
          closes: r.to,
        })),
      ),
    areaServed: delivery.zones.flatMap((z) => z.cities),
  };

  return (
    <SmoothScroll>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-paper focus:px-4 focus:py-2">
        Aller au contenu
      </a>
      <Masthead menu={menu} />
      <main id="contenu" className="relative">
        {children}
      </main>
      <Colophon settings={settings} categories={cats} />
      <Bag freeFrom={mainZone?.freeFrom ?? null} freeZone={mainZone?.name ?? ""} />
    </SmoothScroll>
  );
}
