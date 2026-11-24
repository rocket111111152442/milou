import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { href, isLang, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { site } from "@/config/site";
import { getFacets, getHighlights, getInventory, CatalogUnavailable } from "@/lib/catalog/service";
import type { ListingSummary, Facets } from "@/lib/catalog/types";
import { pageMetadata } from "@/lib/seo/metadata";
import { HeroSearch } from "@/components/site/HeroSearch";
import { ListingCard } from "@/components/site/ListingCard";
import { AeImage } from "@/components/site/AeImage";
import { IconArrowRight, IconBuilding, IconGlobe, IconHome, IconKey, IconPhone, IconShield, IconTag, IconWhatsApp, IconChat, IconCheck } from "@/components/site/Icons";
import heroImg from "../../../../public/img/hero.jpg";
import elvynImg from "../../../../public/img/elvyn-profile.jpg";

export const revalidate = 600; // highlights and counts follow the catalogue cache (10 min)

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : "es";
  const t = getDict(l);
  return pageMetadata({ lang: l, route: "home", title: t.meta.homeTitle, description: t.meta.homeDescription, absoluteTitle: true });
}

async function loadHome() {
  try {
    const [highlights, facets, inventory] = await Promise.all([getHighlights(6), getFacets(), getInventory()]);
    return { highlights, facets, inventory, error: false };
  } catch (e) {
    if (e instanceof CatalogUnavailable) return { highlights: null, facets: null, inventory: [] as ListingSummary[], error: true };
    throw e;
  }
}

function cityImage(inv: ListingSummary[], city: string) {
  return inv.find((l) => l.location.city === city && l.image)?.image ?? null;
}

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang);
  const { highlights, facets, inventory, error } = await loadHome();
  const typeOptions = (facets?.categories ?? []).map((c) => ({ value: String(c.id), label: (lang === "en" ? c.nameEn : null) || c.name }));
  const cityOptions = (facets?.cities ?? []).map((c) => ({ value: c.name, label: c.name }));
  const quick = [
    { href: href(lang, "sale"), Icon: IconHome, ...t.home.quick.buy },
    { href: href(lang, "rent"), Icon: IconKey, ...t.home.quick.rent },
    { href: href(lang, "sale", undefined, "estado=construccion"), Icon: IconBuilding, ...t.home.quick.projects },
    { href: href(lang, "sell"), Icon: IconTag, ...t.home.quick.sell },
  ];
  const serviceIcons = [IconHome, IconBuilding, IconTag, IconGlobe, IconKey, IconShield];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy">
        <Image src={heroImg} alt={t.home.heroAlt} fill priority placeholder="blur" sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-900/70 via-navy-900/45 to-navy-900/80" />
        <div className="container pb-10 pt-16 sm:pb-14 sm:pt-24 lg:pb-20 lg:pt-32">
          <p className="eyebrow text-brand-200">{t.home.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl font-display text-[2.15rem] font-semibold leading-[1.08] text-white sm:text-5xl lg:text-[3.6rem]">{t.home.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">{t.home.subtitle}</p>
          <div className="mt-8 max-w-5xl lg:mt-10">
            <h2 className="sr-only">{t.home.searchTitle}</h2>
            <HeroSearch lang={lang} types={typeOptions} cities={cityOptions} />
          </div>
        </div>
      </section>

      {/* Quick access */}
      <section className="border-b border-navy-100 bg-sand" aria-labelledby="quick-title">
        <div className="container py-10 sm:py-12">
          <h2 id="quick-title" className="sr-only">{t.home.quickTitle}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {quick.map(({ href: h, Icon, title, text }) => (
              <li key={title}>
                <Link href={h} className="group flex h-full flex-col rounded-2xl border border-navy-100 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card motion-reduce:hover:translate-y-0 sm:p-5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon size={22} /></span>
                  <span className="mt-3 flex items-center gap-1.5 font-semibold text-navy">{title}<IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /></span>
                  <span className="mt-1 text-sm leading-snug text-ink-muted">{text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Selection */}
      <section className="container py-16 sm:py-20" aria-labelledby="featured-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="featured-title" className="font-display text-3xl font-semibold sm:text-4xl">
              {highlights?.basis === "featured" ? t.home.featuredTitle : t.home.recentTitle}
            </h2>
            <p className="mt-2 text-ink-muted">{t.home.featuredSubtitle}</p>
          </div>
          <Link href={href(lang, "catalog")} className="btn-outline">{t.common.seeAll} <IconArrowRight size={16} /></Link>
        </div>
        {error ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950" role="status">
            <p className="font-semibold">{t.search.errorTitle}</p>
            <p className="mt-1 text-sm">{t.search.errorText}</p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {highlights?.items.map((l, i) => (
              <li key={l.uid}><ListingCard l={l} lang={lang} priority={i < 3} /></li>
            ))}
          </ul>
        )}
      </section>

      {/* Zones and types */}
      {facets && facets.cities.length > 0 && <Zones lang={lang} facets={facets} inventory={inventory} />}

      {/* About */}
      <section className="container grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16" aria-labelledby="about-title">
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-brand-50" aria-hidden />
          <Image src={elvynImg} alt="Elvyn Arnaud" placeholder="blur" sizes="(min-width:1024px) 420px, 90vw" className="rounded-[1.5rem] object-cover" />
        </div>
        <div>
          <p className="eyebrow">{t.home.aboutEyebrow}</p>
          <h2 id="about-title" className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">{t.home.aboutTitle}</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">{t.home.aboutText}</p>
          <blockquote className="mt-6 border-l-4 border-brand pl-5 font-display text-xl italic text-navy">“{site.quote[lang]}”</blockquote>
          <ul className="mt-7 grid gap-3 sm:grid-cols-3">
            {t.home.trust.map((x) => (
              <li key={x.title} className="rounded-xl bg-navy-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy"><IconCheck size={16} className="text-brand-600" /> {x.title}</p>
                <p className="mt-1 text-sm leading-snug text-ink-muted">{x.text}</p>
              </li>
            ))}
          </ul>
          <Link href={href(lang, "about")} className="btn-dark mt-8">{t.home.aboutCta} <IconArrowRight size={16} /></Link>
        </div>
      </section>

      {/* Services */}
      <section className="bg-navy py-16 text-white sm:py-20" aria-labelledby="services-title">
        <div className="container">
          <p className="eyebrow text-brand-200">{t.home.servicesEyebrow}</p>
          <h2 id="services-title" className="mt-3 max-w-2xl font-display text-3xl font-semibold text-white sm:text-4xl">{t.home.servicesTitle}</h2>
          <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {t.services.list.map((s, i) => {
              const Icon = serviceIcons[i % serviceIcons.length];
              return (
                <li key={s.title} className="flex gap-4">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-200"><Icon size={22} /></span>
                  <div>
                    <h3 className="font-semibold text-white">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-navy-100">{s.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href={href(lang, "services")} className="btn bg-white text-navy hover:bg-brand-50">{t.nav.services} <IconArrowRight size={16} /></Link>
            {inventory.length > 0 && <p className="text-sm text-navy-200">{t.home.catalogCount(inventory.length)}</p>}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16 sm:py-20" aria-labelledby="cta-title">
        <div className="relative overflow-hidden rounded-3xl bg-brand-50 px-6 py-10 sm:px-12 sm:py-14">
          <div className="max-w-2xl">
            <h2 id="cta-title" className="font-display text-3xl font-semibold sm:text-4xl">{t.home.ctaTitle}</h2>
            <p className="mt-3 text-lg text-ink-muted">{t.home.ctaText}</p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp"><IconWhatsApp size={18} /> WhatsApp</a>
            <a href={`tel:${site.phone.e164}`} className="btn-dark"><IconPhone size={18} /> {site.phone.display}</a>
            <Link href={href(lang, "contact")} className="btn-outline"><IconChat size={18} /> {t.nav.contact}</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Zones({ lang, facets, inventory }: { lang: Lang; facets: Facets; inventory: ListingSummary[] }) {
  const t = getDict(lang);
  const cities = facets.cities.slice(0, 4);
  const cats = facets.categories.slice(0, 6);
  return (
    <section className="bg-sand py-16 sm:py-20" aria-labelledby="zones-title">
      <div className="container">
        <h2 id="zones-title" className="font-display text-3xl font-semibold sm:text-4xl">{t.home.zonesTitle}</h2>
        <p className="mt-2 max-w-2xl text-ink-muted">{t.home.zonesSubtitle}</p>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {cities.map((c) => {
            const img = cityImage(inventory, c.name);
            return (
              <li key={c.name}>
                <Link href={href(lang, "catalog", undefined, `ciudad=${encodeURIComponent(c.name)}`)} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-navy sm:aspect-[3/4]">
                  {img && <AeImage src={img} alt="" fill sizes="(min-width:1024px) 300px, 50vw" ratio={1.33} className="object-cover opacity-90 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />}
                  <span className="absolute inset-0 bg-gradient-to-t from-navy-900/85 via-navy-900/20 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                    <span className="block font-display text-xl font-semibold text-white sm:text-2xl">{c.name}</span>
                    <span className="mt-1 block text-sm text-white/85">{t.home.listings(c.count)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <ul className="mt-6 flex flex-wrap gap-2.5">
          {cats.map((c) => (
            <li key={c.id}>
              <Link href={href(lang, "catalog", undefined, `tipo=${c.id}`)} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-navy-200 bg-white px-4 text-sm font-medium text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white">
                {(lang === "en" ? c.nameEn : null) || c.name} <span className="text-ink-soft group-hover:text-white">({c.count})</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
