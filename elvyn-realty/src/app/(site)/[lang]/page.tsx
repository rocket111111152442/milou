import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { href, isLang, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { site } from "@/config/site";
import { getFacets, getHighlights, getInventory, CatalogUnavailable } from "@/lib/catalog/service";
import type { ListingSummary, Facets } from "@/lib/catalog/types";
import { pageMetadata } from "@/lib/seo/metadata";
import { SentenceSearch } from "@/components/site/SentenceSearch";
import { Carousel } from "@/components/site/Carousel";
import { SpinBadge } from "@/components/site/SpinBadge";
import { priceLabel } from "@/lib/catalog/format";
import { ListingCard } from "@/components/site/ListingCard";
import { AeImage } from "@/components/site/AeImage";
import { CountUp } from "@/components/site/Motion";
import { Words } from "@/components/site/Words";
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
    const [highlights, facets, inventory] = await Promise.all([getHighlights(10), getFacets(), getInventory()]);
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

  const stats = [
    { n: inventory.length, label: lang === "es" ? "propiedades publicadas" : "listed properties" },
    { n: facets?.cities.length ?? 0, label: lang === "es" ? "ciudades y zonas" : "towns and areas" },
    { n: facets?.categories.length ?? 0, label: lang === "es" ? "tipos de propiedad" : "property types" },
  ].filter((x) => x.n > 0);
  // Arch photo: the most valuable published sale listing with a photo (usually the most striking one).
  const heroListing = [...inventory].filter((l) => l.image && l.usd.sale).sort((a, b) => (b.usd.sale ?? 0) - (a.usd.sale ?? 0))[0] ?? highlights?.items.find((l) => l.image) ?? null;
  const heroPrice = heroListing ? priceLabel(heroListing, lang) : null;
  // Main tourist destinations of the Dominican Republic, then the towns of the catalogue.
  const TOURIST = ["Punta Cana", "Santo Domingo", "Puerto Plata", "Las Terrenas", "Samaná", "Sosúa", "Cabarete", "La Romana", "Bávaro", "Cap Cana", "Bayahíbe", "Juan Dolio", "Las Galeras", "Jarabacoa", "Constanza", "Cabrera", "Río San Juan"];
  const ticker = [...new Set([...TOURIST, ...(facets?.cities.map((c) => c.name) ?? [])])];

  return (
    <>
      {/* Hero: editorial split — giant type on the left, arched photo of a real listing on the right */}
      <section className="relative isolate -mt-[88px] overflow-hidden bg-sand pt-[88px] sm:-mt-[96px] sm:pt-[96px]">
        <div aria-hidden className="pointer-events-none absolute -left-24 top-32 -z-10 h-[26rem] w-[26rem] animate-blob bg-brand-100 motion-reduce:animate-none" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(#10263212_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="container grid items-center gap-12 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1.12fr_.88fr] lg:gap-10 lg:pb-24 lg:pt-16">
          <div>
            <p className="inline-flex animate-pop-in items-center gap-2 rounded-full bg-navy px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white sm:text-xs sm:tracking-[0.2em]">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-brand" /></span>
              {site.address.locality} · {lang === "es" ? "Costa norte" : "North coast"}
            </p>
            <h1 className="mt-7 font-display text-[3rem] font-semibold leading-[.95] tracking-[-0.03em] text-navy sm:text-7xl lg:text-[6.2rem]">
              <Words text={t.home.title} delay={120} step={60} accentLast={2} accentClass="italic text-brand" />
            </h1>
            <p className="mt-7 max-w-xl animate-fade-up text-lg leading-relaxed text-ink-muted [animation-delay:650ms]">{t.home.subtitle}</p>
            <div className="mt-9 max-w-2xl animate-pop-in pr-0 [animation-delay:850ms] sm:pr-6">
              <h2 className="sr-only">{t.home.searchTitle}</h2>
              <SentenceSearch lang={lang} types={typeOptions} cities={cityOptions} />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[30rem] animate-pop-in [animation-delay:300ms] lg:max-w-none">
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-full rounded-b-[2.5rem] bg-navy shadow-[0_50px_90px_-40px_rgba(16,38,50,.6)]">
              {heroListing?.image ? (
                <div className="absolute inset-0 animate-kenburns motion-reduce:animate-none">
                  <AeImage src={heroListing.image} alt={heroListing.title} fill priority sizes="(min-width:1024px) 520px, 90vw" ratio={1.25} className="object-cover" />
                </div>
              ) : (
                <Image src={heroImg} alt={t.home.heroAlt} fill priority placeholder="blur" sizes="(min-width:1024px) 520px, 90vw" className="object-cover" />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-navy-900/70 via-transparent to-transparent" />
            </div>
            <SpinBadge text={lang === "es" ? "CABRERA · RÍO SAN JUAN · COSTA NORTE · " : "CABRERA · RÍO SAN JUAN · NORTH COAST · "} className="absolute -left-4 bottom-24 sm:-left-12" />
            {heroListing && (
              <Link href={href(lang, "listing", heroListing.slug)} className="group absolute -right-2 bottom-8 w-[15.5rem] animate-float rounded-3xl bg-white/95 p-4 shadow-lift backdrop-blur transition-transform hover:scale-[1.03] motion-reduce:animate-none sm:-right-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">{lang === "es" ? "En el catálogo" : "In the catalogue"}</p>
                <p className="mt-1 line-clamp-2 font-display text-[15px] font-semibold leading-snug text-navy group-hover:text-brand-700">{heroListing.title}</p>
                {heroPrice && <p className="mt-2 text-lg font-bold text-navy">{heroPrice.prefix ? <span className="mr-1 text-xs font-medium text-ink-muted">{heroPrice.prefix}</span> : null}{heroPrice.main}{heroPrice.suffix ? <span className="text-xs font-medium text-ink-muted">{heroPrice.suffix}</span> : null}</p>}
              </Link>
            )}
            {stats[0] && (
              <div className="absolute -top-4 right-6 rounded-2xl bg-brand px-5 py-3 text-white shadow-lift sm:right-10">
                <p className="font-display text-3xl font-semibold leading-none"><CountUp to={stats[0].n} /></p>
                <p className="mt-1 text-xs font-medium text-white/90">{stats[0].label}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Moving strip of towns and types */}
      {ticker.length > 0 && (
        <div className="overflow-hidden border-y border-brand-600/30 bg-brand py-4 text-white" aria-hidden>
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display text-2xl italic motion-reduce:animate-none sm:text-3xl">
            {[...ticker, ...ticker].map((x, i) => (
              <span key={i} className="flex items-center gap-10">{x}<span className="text-base not-italic text-white/60">✦</span></span>
            ))}
          </div>
        </div>
      )}

      {/* Quick access + counters */}
      <section id="descubrir" className="relative bg-sand" aria-labelledby="quick-title">
        <div className="container py-16 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div data-reveal="left">
              <p className="eyebrow">{lang === "es" ? "Empieza aquí" : "Start here"}</p>
              <h2 id="quick-title" className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">{t.home.quickTitle}</h2>
              {stats.length > 0 && (
                <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-navy-200/70 pt-8">
                  {stats.map((x) => (
                    <div key={x.label}>
                      <dt className="sr-only">{x.label}</dt>
                      <dd className="font-display text-4xl font-semibold text-navy sm:text-5xl"><CountUp to={x.n} /></dd>
                      <dd className="mt-1 text-sm leading-snug text-ink-muted">{x.label}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:gap-5">
              {quick.map(({ href: h, Icon, title, text }, i) => (
                <li key={title} data-reveal style={{ ["--d" as string]: `${i * 110}ms` }}>
                  <Link href={h} className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-navy-100 bg-white p-5 transition-all duration-500 hover:-translate-y-1.5 hover:border-transparent hover:shadow-lift sm:p-7">
                    <span aria-hidden className="absolute inset-0 -z-0 origin-bottom scale-y-0 bg-navy transition-transform duration-500 ease-out group-hover:scale-y-100" />
                    <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-all duration-500 group-hover:rotate-[-8deg] group-hover:scale-110 group-hover:bg-brand group-hover:text-white"><Icon size={24} /></span>
                    <span className="relative mt-5 flex items-center gap-1.5 font-display text-xl font-semibold text-navy transition-colors duration-500 group-hover:text-white">{title}<IconArrowRight size={18} className="transition-transform duration-500 group-hover:translate-x-1.5" /></span>
                    <span className="relative mt-1.5 text-sm leading-snug text-ink-muted transition-colors duration-500 group-hover:text-navy-100">{text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Selection: horizontal carousel */}
      <section className="overflow-hidden py-20 sm:py-28" aria-labelledby="featured-title">
        <div className="container">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end" data-reveal>
            <div className="max-w-3xl">
              <p className="eyebrow">{lang === "es" ? "Selección" : "Selection"}</p>
              <h2 id="featured-title" className="mt-3 font-display text-5xl font-semibold leading-[.95] tracking-[-0.02em] sm:text-7xl">
                {highlights?.basis === "featured" ? t.home.featuredTitle : t.home.recentTitle}
              </h2>
              <p className="mt-5 text-lg text-ink-muted">{t.home.featuredSubtitle}</p>
            </div>
            <Link href={href(lang, "catalog")} className="link-underline w-fit pb-1 text-base font-semibold text-navy">{t.common.seeAll} →</Link>
          </div>
          {error ? (
            <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950" role="status">
              <p className="font-semibold">{t.search.errorTitle}</p>
              <p className="mt-1 text-sm">{t.search.errorText}</p>
            </div>
          ) : (
            <div className="mt-8" data-reveal="right">
              <Carousel label={highlights?.basis === "featured" ? t.home.featuredTitle : t.home.recentTitle} prevLabel={lang === "es" ? "Anteriores" : "Previous"} nextLabel={lang === "es" ? "Siguientes" : "Next"}>
                {highlights?.items.map((l, i) => (
                  <li key={l.uid} className="w-[82vw] shrink-0 snap-start sm:w-[360px]">
                    <ListingCard l={l} lang={lang} priority={i < 2} />
                  </li>
                ))}
              </Carousel>
            </div>
          )}
        </div>
      </section>

      {/* Zones and types */}
      {facets && facets.cities.length > 0 && <Zones lang={lang} facets={facets} inventory={inventory} />}

      {/* About */}
      <section className="relative overflow-hidden py-20 sm:py-28" aria-labelledby="about-title">
        <div className="container grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          <div className="relative mx-auto w-full max-w-md" data-reveal="zoom">
            <div aria-hidden className="absolute -inset-6 -z-10 animate-spin-slow rounded-full border-2 border-dashed border-brand/40 motion-reduce:animate-none" />
            <div aria-hidden className="absolute -bottom-8 -left-8 -z-10 h-40 w-40 animate-blob bg-brand/20 motion-reduce:animate-none" />
            <div className="overflow-hidden rounded-[2.5rem] shadow-lift">
              <Image src={elvynImg} alt="Elvyn Arnaud" placeholder="blur" sizes="(min-width:1024px) 440px, 90vw" className="object-cover transition-transform duration-[1.5s] hover:scale-105" />
            </div>
            <div className="absolute -right-4 bottom-8 animate-float rounded-2xl bg-white px-5 py-4 shadow-lift motion-reduce:animate-none sm:-right-10">
              <p className="font-display text-lg font-semibold text-navy">Elvyn Arnaud</p>
              <p className="text-xs uppercase tracking-wider text-brand-600">{lang === "es" ? "Corredor inmobiliario" : "Real estate broker"}</p>
            </div>
          </div>
          <div>
            <p className="eyebrow" data-reveal>{t.home.aboutEyebrow}</p>
            <h2 id="about-title" className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl" data-reveal style={{ ["--d" as string]: "80ms" }}>{t.home.aboutTitle}</h2>
            <p className="mt-6 text-lg leading-relaxed text-ink-muted" data-reveal style={{ ["--d" as string]: "160ms" }}>{t.home.aboutText}</p>
            <blockquote className="relative mt-8 rounded-3xl bg-navy p-7 font-display text-xl italic leading-relaxed text-white sm:text-2xl" data-reveal style={{ ["--d" as string]: "240ms" }}>
              <span aria-hidden className="absolute -top-6 left-6 font-display text-7xl leading-none text-brand">“</span>
              {site.quote[lang]}
            </blockquote>
            <ul className="mt-8 grid gap-3 sm:grid-cols-3">
              {t.home.trust.map((x, i) => (
                <li key={x.title} data-reveal style={{ ["--d" as string]: `${300 + i * 100}ms` }} className="rounded-2xl border border-navy-100 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-card">
                  <p className="flex items-center gap-2 text-sm font-semibold text-navy"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white"><IconCheck size={14} /></span> {x.title}</p>
                  <p className="mt-2 text-sm leading-snug text-ink-muted">{x.text}</p>
                </li>
              ))}
            </ul>
            <Link href={href(lang, "about")} className="btn-primary group mt-9" data-reveal style={{ ["--d" as string]: "500ms" }}>{t.home.aboutCta} <IconArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="grain relative overflow-hidden bg-navy-900 py-20 text-white sm:py-28" aria-labelledby="services-title">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] animate-blob bg-brand/20 blur-3xl motion-reduce:animate-none" />
        <div className="container relative">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
            <div data-reveal>
              <p className="eyebrow text-brand-200">{t.home.servicesEyebrow}</p>
              <h2 id="services-title" className="mt-3 font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">{t.home.servicesTitle}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-4 lg:justify-end" data-reveal style={{ ["--d" as string]: "120ms" }}>
              {inventory.length > 0 && <p className="text-sm text-navy-200">{t.home.catalogCount(inventory.length)}</p>}
              <Link href={href(lang, "services")} className="btn-glass group">{t.nav.services} <IconArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></Link>
            </div>
          </div>
          <ul className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {t.services.list.map((s, i) => {
              const Icon = serviceIcons[i % serviceIcons.length];
              return (
                <li key={s.title} data-reveal style={{ ["--d" as string]: `${(i % 3) * 100}ms` }} className="group relative bg-navy-900 p-7 transition-colors duration-500 hover:bg-navy-800 sm:p-8">
                  <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-brand transition-transform duration-500 group-hover:scale-x-100" />
                  <div className="flex items-start justify-between">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-brand-200 transition-all duration-500 group-hover:scale-110 group-hover:bg-brand group-hover:text-white"><Icon size={24} /></span>
                    <span className="font-display text-4xl font-semibold text-white/10 transition-colors duration-500 group-hover:text-brand/60">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy-100">{s.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20 sm:py-28" aria-labelledby="cta-title">
        <div data-reveal="zoom" className="relative isolate overflow-hidden rounded-[2.5rem] bg-[linear-gradient(120deg,#EB6500,#C75400,#A04300,#EB6500)] bg-[length:300%_300%] px-6 py-14 text-white animate-gradient-pan motion-reduce:animate-none sm:px-14 sm:py-20">
          <div aria-hidden className="absolute -right-20 -top-20 -z-10 h-80 w-80 animate-blob bg-white/15 motion-reduce:animate-none" />
          <div aria-hidden className="absolute -bottom-24 left-1/3 -z-10 h-72 w-72 animate-blob bg-navy/25 [animation-delay:-8s] motion-reduce:animate-none" />
          <div className="max-w-2xl">
            <h2 id="cta-title" className="font-display text-4xl font-semibold leading-tight text-white sm:text-6xl">{t.home.ctaTitle}</h2>
            <p className="mt-4 text-lg text-white/90">{t.home.ctaText}</p>
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn bg-white text-navy hover:-translate-y-0.5 hover:shadow-lift"><IconWhatsApp size={18} className="text-[#1F8F4E]" /> WhatsApp</a>
            <a href={`tel:${site.phone.e164}`} className="btn-dark"><IconPhone size={18} /> {site.phone.display}</a>
            <Link href={href(lang, "contact")} className="btn-glass"><IconChat size={18} /> {t.nav.contact}</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Zones({ lang, facets, inventory }: { lang: Lang; facets: Facets; inventory: ListingSummary[] }) {
  const t = getDict(lang);
  const cities = facets.cities.slice(0, 5);
  const cats = facets.categories.slice(0, 8);
  const span = ["lg:col-span-2 lg:row-span-2", "", "", "", ""];
  return (
    <section className="bg-sand py-20 sm:py-28" aria-labelledby="zones-title">
      <div className="container">
        <div className="max-w-2xl" data-reveal>
          <p className="eyebrow">{lang === "es" ? "Zonas" : "Areas"}</p>
          <h2 id="zones-title" className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">{t.home.zonesTitle}</h2>
          <p className="mt-4 text-lg text-ink-muted">{t.home.zonesSubtitle}</p>
        </div>
        <ul className="mt-12 grid auto-rows-[200px] grid-cols-2 gap-3 sm:auto-rows-[240px] sm:gap-5 lg:grid-cols-4">
          {cities.map((c, i) => {
            const img = cityImage(inventory, c.name);
            return (
              <li key={c.name} data-reveal="zoom" style={{ ["--d" as string]: `${i * 90}ms` }} className={`${span[i] ?? ""} ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                <Link href={href(lang, "catalog", undefined, `ciudad=${encodeURIComponent(c.name)}`)} className="group relative block h-full overflow-hidden rounded-3xl bg-navy">
                  {img && <AeImage src={img} alt="" fill sizes={i === 0 ? "(min-width:1024px) 640px, 100vw" : "(min-width:1024px) 320px, 50vw"} ratio={1.33} className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110 motion-reduce:transition-none" />}
                  <span className="absolute inset-0 bg-gradient-to-t from-navy-900/90 via-navy-900/25 to-transparent transition-opacity duration-500 group-hover:opacity-80" />
                  <span className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                    <span className={`block font-display font-semibold text-white ${i === 0 ? "text-3xl sm:text-5xl" : "text-xl sm:text-2xl"}`}>{c.name}</span>
                    <span className="mt-2 inline-flex items-center gap-2 text-sm text-white/85">
                      {t.home.listings(c.count)}
                      <span className="inline-flex h-7 w-7 -translate-x-2 items-center justify-center rounded-full bg-brand text-white opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100"><IconArrowRight size={14} /></span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <ul className="mt-8 flex flex-wrap gap-2.5" data-reveal>
          {cats.map((c) => (
            <li key={c.id}>
              <Link href={href(lang, "catalog", undefined, `tipo=${c.id}`)} className="group inline-flex min-h-[44px] items-center gap-2 rounded-full border border-navy-200 bg-white px-5 text-sm font-medium text-navy transition-all duration-300 hover:-translate-y-0.5 hover:border-navy hover:bg-navy hover:text-white">
                {(lang === "en" ? c.nameEn : null) || c.name} <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs text-ink-muted transition-colors group-hover:bg-white/15 group-hover:text-white">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
