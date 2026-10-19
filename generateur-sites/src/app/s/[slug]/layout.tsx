import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings-store";
import { getTenant } from "@/lib/tenant-store";
import { applyProducts } from "@/lib/settings";
import { copyOf, paletteCss, publicTenant, PALETTES } from "@/lib/tenant";
import { SettingsProvider } from "@/components/SettingsProvider";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Preloader } from "@/components/Preloader";
import { CartDrawer, FloatingCart } from "@/components/cart/CartDrawer";
import { CartHydrator } from "@/components/cart/CartHydrator";
import { FlyLayer } from "@/components/cart/FlyToCart";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) return {};
  const settings = await getSettings(slug, tenant.products);
  const copy = copyOf(publicTenant(tenant), applyProducts(settings, tenant.products));
  const base = `/s/${slug}`;
  return {
    title: { default: `${tenant.name} · ${tenant.tagline} à ${copy.citiesText}`, template: `%s · ${tenant.name}` },
    description: copy.siteDescription,
    // Démonstration : pas d'indexation tant que le site n'a pas son propre domaine
    robots: { index: false, follow: false },
    manifest: `${base}/manifest.webmanifest`,
    icons: { icon: `${base}/icon.png`, apple: `${base}/icon.png` },
    openGraph: { type: "website", locale: "fr_FR", siteName: tenant.name, title: tenant.name, description: copy.siteDescription },
  };
}

export async function generateViewport({ params }: Params): Promise<Viewport> {
  const { slug } = await params;
  const tenant = await getTenant(slug);
  return { themeColor: (PALETTES[tenant?.palette ?? "ble"] ?? PALETTES.ble).vars.torref };
}

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) notFound();
  const settings = await getSettings(slug, tenant.products);
  const pub = publicTenant(tenant);

  return (
    <>
      <style>{paletteCss(tenant.palette)}</style>
      <noscript>
        <style>{`#preloader{display:none!important}`}</style>
      </noscript>
      <a
        href="#contenu"
        className="sr-only z-[200] rounded-full bg-cafe px-4 py-2 text-creme focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Aller au contenu
      </a>
      <SettingsProvider tenant={pub} settings={settings}>
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
      </SettingsProvider>
    </>
  );
}
