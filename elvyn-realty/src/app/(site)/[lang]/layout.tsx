import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@/styles/globals.css";
import { fontDisplay, fontSans } from "@/app/fonts";
import { isLang, LANGS, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { env, catalogMode } from "@/config/env";
import { site } from "@/config/site";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { DemoBanner } from "@/components/site/DemoBanner";
import { ChatWidget } from "@/components/site/chat/ChatWidget";
import { JsonLd } from "@/components/site/JsonLd";
import { indexable } from "@/lib/seo/metadata";
import { assistantAvailable } from "@/lib/ai/agent";

export const viewport: Viewport = { themeColor: "#102632", width: "device-width", initialScale: 1 };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : "es";
  const t = getDict(l);
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: t.meta.homeTitle, template: `%s | ${site.shortName}` },
    description: t.meta.homeDescription,
    applicationName: site.name,
    robots: indexable() ? undefined : { index: false, follow: false },
    formatDetection: { telephone: false },
  };
}

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDict(lang);
  const org = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: site.name,
    legalName: site.legalName,
    url: env.siteUrl,
    logo: `${env.siteUrl}/brand/logo.png`,
    image: `${env.siteUrl}/img/hero.jpg`,
    telephone: site.phone.e164,
    email: site.email,
    address: { "@type": "PostalAddress", streetAddress: site.address.street.es, addressLocality: site.address.locality, addressRegion: site.address.region, addressCountry: site.address.countryCode },
    areaServed: site.areas.map((a) => ({ "@type": "Place", name: a })),
    sameAs: Object.values(site.social).map((s) => s.url),
    knowsLanguage: ["es", "en"],
  };
  return (
    <html lang={lang} className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <a href="#main" className="sr-only z-[60] rounded-full bg-navy px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          {t.nav.skip}
        </a>
        {catalogMode() === "demo" && <DemoBanner lang={lang} />}
        <Header lang={lang} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer lang={lang} />
        <ChatWidget lang={lang} enabled={assistantAvailable().ok} />
        <JsonLd data={org} />
      </body>
    </html>
  );
}
