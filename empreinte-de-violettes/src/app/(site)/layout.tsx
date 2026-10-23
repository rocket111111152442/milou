import { cookies } from "next/headers";
import { Cursor } from "@/components/motion/Cursor";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { AnnouncementBar } from "@/components/site/AnnouncementBar";
import { CartDrawer } from "@/components/site/CartDrawer";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { Intro } from "@/components/site/Intro";
import { VioletMark } from "@/components/site/Logo";
import { ADMIN_COOKIE, verifySession } from "@/lib/auth";
import { getCategories, getContent, getDelivery, getSettings } from "@/lib/catalog";
import { siteUrl } from "@/lib/orders";
import { IMG } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, delivery] = await Promise.all([getSettings(), getCategories(), getDelivery(), getContent()]);
  const isAdmin = await verifySession((await cookies()).get(ADMIN_COOKIE)?.value);

  if (settings.maintenance.enabled && !isAdmin) {
    return (
      <main className="fern-night flex min-h-screen flex-col items-center justify-center bg-noir px-6 text-center">
        <VioletMark className="h-16 w-16 text-gold" />
        <p className="eyebrow mt-8 text-gold">Empreinte de Violettes</p>
        <h1 className="mt-4 max-w-2xl font-display text-5xl font-light">{settings.maintenance.message}</h1>
        <p className="mt-6 text-ivory/60">
          {settings.address}, {settings.postcode} {settings.city} · {settings.phone}
        </p>
      </main>
    );
  }

  const cats = categories.filter((c) => c.showInMenu).map((c) => ({ href: `/boutique?categorie=${c.slug}`, label: c.name }));
  const tuesday = settings.hours.find((h) => h.day === 2);
  const menu = {
    links: [
      { href: "/boutique", label: "La boutique", image: IMG.darkBouquet },
      { href: "/atelier", label: "L'atelier", image: IMG.handsFern },
      { href: "/mariage", label: "Mariages", image: IMG.brideDark },
      { href: "/deuil", label: "Deuil & hommage", image: IMG.whiteRoseDark },
      { href: "/boutique?categorie=plantes", label: "Plantes rares", image: IMG.monsteraDark },
      { href: "/la-maison", label: "La Maison", image: IMG.shopFront },
      { href: "/livraison", label: "Livraison", image: IMG.kraftBouquet },
      { href: "/contact", label: "Contact", image: IMG.roseGarden },
    ],
    categories: cats,
    phone: settings.phone,
    address: `${settings.address}, ${settings.postcode} ${settings.city}`,
    instagram: settings.instagram,
    facebook: settings.facebook,
    hoursLine: tuesday && !tuesday.closed ? `Mar.–sam. ${tuesday.ranges.map((r) => `${r.from}–${r.to}`).join(" / ")} · dim. matin` : "",
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
      <Cursor />
      <Intro enabled={settings.intro.enabled} oncePerSession={settings.intro.oncePerSession} />
      {settings.announcement.active && <AnnouncementBar text={settings.announcement.text} link={settings.announcement.link} />}
      <Header menu={menu} hasAnnouncement={settings.announcement.active} />
      <main className="grain relative">{children}</main>
      <Footer settings={settings} categories={cats} />
      <CartDrawer freeFrom={mainZone?.freeFrom ?? null} freeZone={mainZone?.name ?? ""} />
    </SmoothScroll>
  );
}
