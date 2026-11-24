import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { env, crmStorageConfigured } from "@/config/env";
import { site, whatsappLink } from "@/config/site";
import { href, isLang, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { getListing, CatalogUnavailable } from "@/lib/catalog/service";
import type { ListingDetail } from "@/lib/catalog/types";
import { categoryLabel, formatArea, formatMoney, priceLabel } from "@/lib/catalog/format";
import { aeImageUrl } from "@/lib/catalog/images";
import { youtubeId } from "@/lib/sanitize";
import { pageMetadata } from "@/lib/seo/metadata";
import { Gallery } from "@/components/site/listing/Gallery";
import { VideoEmbed } from "@/components/site/listing/VideoEmbed";
import { Expandable } from "@/components/site/listing/Expandable";
import { AskAssistantButton, BackToResults, ListingRequest } from "@/components/site/listing/ListingActions";
import { ChatPageContextSetter } from "@/components/site/chat/PageContext";
import { ListingCard } from "@/components/site/ListingCard";
import { MobileActionBar } from "@/components/site/listing/MobileActionBar";
import { JsonLd } from "@/components/site/JsonLd";
import { IconArea, IconBath, IconBed, IconCalendar, IconCar, IconCheck, IconMail, IconPhone, IconPin, IconWhatsApp } from "@/components/site/Icons";

type Props = { params: Promise<{ lang: string; slug: string }> };

async function load(slug: string): Promise<ListingDetail | null | "error"> {
  try {
    return await getListing(slug);
  } catch (e) {
    if (e instanceof CatalogUnavailable) return "error";
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw, slug } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const d = await load(slug);
  if (!d || d === "error") return { title: getDict(lang).listing.unavailableTitle, robots: { index: false, follow: true } };
  const price = priceLabel(d, lang);
  const desc = (d.shortDescription ?? d.descriptionText).replace(/\s+/g, " ").slice(0, 155);
  return pageMetadata({
    lang,
    route: "listing",
    rest: d.slug,
    title: `${d.title}${price ? ` · ${[price.prefix, price.main].filter(Boolean).join(" ")}` : ""}`,
    description: desc,
    image: aeImageUrl(d.images[0], 1200, 630),
  });
}

export default async function ListingPage({ params }: Props) {
  const { lang: raw, slug } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang);
  const d = await load(slug);
  if (d === "error") {
    return (
      <div className="container py-20 text-center" role="alert">
        <h1 className="font-display text-3xl font-semibold">{t.search.errorTitle}</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-muted">{t.search.errorText}</p>
        <a href={whatsappLink()} className="btn-whatsapp mt-6" target="_blank" rel="noopener noreferrer"><IconWhatsApp size={18} /> WhatsApp</a>
      </div>
    );
  }
  if (!d) notFound();

  const url = `${env.siteUrl}${href(lang, "listing", d.slug)}`;
  const price = priceLabel(d, lang);
  const agent = d.agents[0] ?? null;
  const contactPhone = agent?.phone ?? site.phone.e164;
  const waNumber = (agent?.phone ?? site.whatsapp).replace(/\D/g, "");
  const waMsg = t.listing.waMessage(d.title, d.ref, url, agent?.name.split(" ")[0] ?? "Elvyn");
  const ytId = youtubeId(d.videoUrl) ?? youtubeId(d.virtualTourUrl);
  const videoUrl = d.videoUrl ?? d.virtualTourUrl;
  const opLabel = d.isProject ? t.common.project : d.operations.map((o) => (o === "sale" ? t.common.sale : o === "rent" ? t.common.rent : t.common.rental)).join(" · ");
  const area = d.area;
  const available = d.units.filter((u) => u.status === "available").length;
  const related = d.related.filter((r) => r.image && r.slug !== d.slug).slice(0, 3);
  const backHref = href(lang, d.operations.includes("rent") && !d.operations.includes("sale") ? "rent" : "sale");

  const features: [string, string][] = [];
  const add = (k: string, v: string | number | null | undefined) => {
    if (v !== null && v !== undefined && v !== "") features.push([k, String(v)]);
  };
  add(t.listing.type, categoryLabel(d, lang));
  add(t.listing.operation, opLabel);
  add(t.listing.condition, d.condition.label);
  if (d.bedrooms) add(t.search.bedrooms, d.bedrooms);
  if (d.bathrooms) add(t.search.bathrooms, d.bathrooms);
  if (d.halfBathrooms) add(lang === "es" ? "Medios baños" : "Half baths", d.halfBathrooms);
  if (d.parking) add(t.search.parking, d.parking);
  if (d.area) add(`${lang === "es" ? "Área" : "Area"} (${t.common.built})`, formatArea(d.area, lang));
  if (d.landArea) add(`${lang === "es" ? "Área" : "Area"} (${t.common.land})`, formatArea(d.landArea, lang));
  if (d.terraceArea) add(t.listing.terrace, formatArea(d.terraceArea, lang));
  add(t.listing.floor, d.floorLevel);
  add(t.listing.totalFloors, d.totalFloors);
  add(t.listing.yearBuilt, d.yearBuilt);
  if (d.deliveryDate) add(t.listing.delivery, new Intl.DateTimeFormat(lang === "es" ? "es-DO" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(d.deliveryDate)));
  if (d.prices.maintenance) add(t.listing.maintenance, formatMoney(d.prices.maintenance, lang));
  if (d.prices.furnishedRent) add(t.listing.furnishedRent, formatMoney(d.prices.furnishedRent, lang));
  if (d.prices.furnishedSale) add(t.listing.furnishedSale, formatMoney(d.prices.furnishedSale, lang));
  if (d.ref) add(t.common.ref, d.ref);

  const ld = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: d.title,
    url,
    image: d.images.slice(0, 6).map((i) => aeImageUrl(i, 1200, 900)),
    datePosted: d.createdAt ?? undefined,
    description: (d.shortDescription ?? d.descriptionText).slice(0, 300),
    ...(d.price.sale || d.price.projectFrom
      ? { offers: { "@type": "Offer", price: (d.price.sale ?? d.price.projectFrom)!.amount, priceCurrency: (d.price.sale ?? d.price.projectFrom)!.currency, availability: "https://schema.org/InStock", seller: { "@type": "RealEstateAgent", name: site.name } } }
      : {}),
    contentLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: d.location.city ?? undefined, addressRegion: d.location.province ?? undefined, addressCountry: "DO" } },
  };

  return (
    <>
      <ChatPageContextSetter type="listing" slug={d.slug} title={d.title} />
      <div className="container pb-16 pt-4 sm:pt-6">
        <BackToResults lang={lang} fallback={backHref} />
        <div className="mt-3"><Gallery images={d.images} title={d.title} lang={lang} /></div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-12">
          <div className="min-w-0">
            <header>
              <div className="flex flex-wrap items-center gap-2">
                {opLabel && <span className="chip">{opLabel}</span>}
                {categoryLabel(d, lang) && <span className="chip">{categoryLabel(d, lang)}</span>}
                {d.exclusive === true && <span className="chip bg-brand text-white">{t.common.exclusive}</span>}
                {d.ref && <span className="text-sm text-ink-soft">{t.common.ref} {d.ref}</span>}
              </div>
              <h1 className="mt-3 font-display text-[1.9rem] font-semibold leading-tight sm:text-4xl">{d.title}</h1>
              {(d.location.sector || d.location.city) && (
                <p className="mt-2 flex items-center gap-1.5 text-ink-muted"><IconPin size={18} className="text-brand" /> {[d.location.sector, d.location.city, d.location.province].filter(Boolean).join(", ")}</p>
              )}
              <p className="mt-4 text-3xl font-semibold text-navy">
                {price ? (
                  <>
                    {price.prefix && <span className="mr-1.5 text-lg font-medium text-ink-muted">{price.prefix}</span>}
                    {price.main}
                    {price.suffix && <span className="text-lg font-medium text-ink-muted">{price.suffix}</span>}
                  </>
                ) : (
                  <span className="text-xl text-ink-muted">{t.common.priceOnRequest}</span>
                )}
              </p>
              {d.price.sale && d.price.rent && <p className="mt-1 text-ink-muted">{t.common.rent}: {formatMoney(d.price.rent, lang)}{lang === "es" ? "/mes" : "/month"}</p>}
              <p className="mt-1 text-sm text-ink-soft">{t.listing.availabilityNote}</p>
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-ink">
                {d.bedrooms ? <li className="flex items-center gap-2"><IconBed size={20} className="text-navy-400" /> {t.common.bedrooms(d.bedrooms)}</li> : null}
                {d.bathrooms ? <li className="flex items-center gap-2"><IconBath size={20} className="text-navy-400" /> {t.common.bathrooms(d.bathrooms)}</li> : null}
                {d.parking ? <li className="flex items-center gap-2"><IconCar size={20} className="text-navy-400" /> {t.common.parking(d.parking)}</li> : null}
                {area ? <li className="flex items-center gap-2"><IconArea size={20} className="text-navy-400" /> {formatArea(area, lang)} {t.common.built}</li> : null}
                {d.landArea ? <li className="flex items-center gap-2"><IconArea size={20} className="text-navy-400" /> {formatArea(d.landArea, lang)} {t.common.land}</li> : null}
              </ul>
            </header>

            {d.descriptionHtml && (
              <section className="mt-10" aria-labelledby="desc-title">
                <h2 id="desc-title" className="font-display text-2xl font-semibold">{t.listing.description}</h2>
                {lang === "en" && <p className="mt-2 text-sm italic text-ink-soft">{t.listing.originalLanguage}</p>}
                <div className="mt-4">
                  <Expandable more={lang === "es" ? "Leer más" : "Read more"} less={lang === "es" ? "Leer menos" : "Read less"}>
                    <div className="prose-listing max-w-[70ch] text-[16px] text-ink" lang="es" dangerouslySetInnerHTML={{ __html: d.descriptionHtml }} />
                  </Expandable>
                </div>
              </section>
            )}

            {features.length > 0 && (
              <section className="mt-10" aria-labelledby="feat-title">
                <h2 id="feat-title" className="font-display text-2xl font-semibold">{t.listing.features}</h2>
                <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
                  {features.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-navy-100 py-3 text-[15px]">
                      <dt className="text-ink-muted">{k}</dt>
                      <dd className="text-right font-medium text-navy">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {d.amenities.length > 0 && (
              <section className="mt-10" aria-labelledby="amen-title">
                <h2 id="amen-title" className="font-display text-2xl font-semibold">{t.listing.amenities}</h2>
                <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {d.amenities.map((a) => (
                    <li key={a} className="flex items-start gap-2.5 text-[15px]"><IconCheck size={18} className="mt-0.5 shrink-0 text-brand-600" /> <span lang="es">{a}</span></li>
                  ))}
                </ul>
              </section>
            )}

            {d.units.length > 0 && (
              <section className="mt-10" aria-labelledby="units-title">
                <h2 id="units-title" className="font-display text-2xl font-semibold">{t.listing.units}</h2>
                <p className="mt-1 text-sm text-ink-muted">{t.listing.unitsAvailable(available, d.units.length)}</p>
                <div className="mt-4 overflow-x-auto rounded-xl border border-navy-100">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-navy-50 text-navy-700">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">{t.listing.unit}</th>
                        <th scope="col" className="px-4 py-3 font-semibold">{lang === "es" ? "Área" : "Area"}</th>
                        <th scope="col" className="px-4 py-3 font-semibold">{t.search.bedrooms}</th>
                        <th scope="col" className="px-4 py-3 font-semibold">{lang === "es" ? "Precio" : "Price"}</th>
                        <th scope="col" className="px-4 py-3 font-semibold">{t.listing.condition}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.units.slice(0, 60).map((u, i) => (
                        <tr key={`${u.ref ?? i}`} className="border-t border-navy-100">
                          <td className="px-4 py-2.5">{u.model ?? (u.ref ? `${t.common.ref} ${u.ref}` : i + 1)}</td>
                          <td className="px-4 py-2.5">{u.area ? formatArea(u.area, lang) : "—"}</td>
                          <td className="px-4 py-2.5">{u.bedrooms ?? "—"}</td>
                          <td className="px-4 py-2.5 font-medium">{u.price && u.status !== "sold" ? formatMoney(u.price, lang) : "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.status === "available" ? "bg-emerald-50 text-emerald-800" : u.status === "reserved" ? "bg-amber-50 text-amber-900" : "bg-navy-50 text-navy-600"}`}>
                              {t.listing.unitStatus[u.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {videoUrl && (
              <section className="mt-10" aria-labelledby="video-title">
                <h2 id="video-title" className="font-display text-2xl font-semibold">{d.videoUrl ? t.listing.video : t.listing.virtualTour}</h2>
                <div className="mt-4"><VideoEmbed id={ytId} url={videoUrl} title={d.title} label={t.listing.openVideo} /></div>
              </section>
            )}

            <section className="mt-10" aria-labelledby="loc-title">
              <h2 id="loc-title" className="font-display text-2xl font-semibold">{t.listing.location}</h2>
              <p className="mt-3 flex items-start gap-2 text-ink"><IconPin size={20} className="mt-0.5 shrink-0 text-brand" /> {[d.location.sector, d.location.city, d.location.province, "República Dominicana"].filter(Boolean).join(", ")}</p>
              {d.coordinates ? (
                <a className="btn-outline mt-4" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${d.coordinates.lat},${d.coordinates.lng}`}>Google Maps</a>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">{t.listing.locationHidden}</p>
              )}
            </section>

            <div className="mt-12">
              <ListingRequest lang={lang} property={{ slug: d.slug, ref: d.ref, title: d.title }} formEnabled={crmStorageConfigured()} />
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start" aria-label={t.listing.contactTitle}>
            <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
              {agent && (
                <div className="flex items-center gap-3">
                  {agent.avatar ? (
                    <Image src={aeImageUrl(agent.avatar, 160, 160) ?? agent.avatar} alt={agent.name} width={56} height={56} className="h-14 w-14 rounded-full object-cover" unoptimized />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-50 font-semibold text-navy">{agent.name.slice(0, 1)}</span>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-ink-soft">{t.listing.contactAgent}</p>
                    <p className="font-semibold text-navy">{agent.name}</p>
                  </div>
                </div>
              )}
              {d.agencyOwned === false && <p className="mt-3 rounded-lg bg-navy-50 p-2.5 text-xs text-ink-muted">{t.listing.shared}</p>}
              <div className="mt-5 grid gap-2.5">
                <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp w-full"><IconWhatsApp size={18} /> {t.listing.askWhatsapp}</a>
                <a href={`tel:${contactPhone}`} className="btn-dark w-full"><IconPhone size={18} /> {t.listing.call}</a>
                <a href="#solicitar-informacion" className="btn-outline w-full"><IconMail size={18} /> {t.listing.requestInfo}</a>
                <a href="#solicitar-visita" className="btn-outline w-full"><IconCalendar size={18} /> {t.listing.requestVisit}</a>
                <AskAssistantButton lang={lang} className="btn-ghost w-full" />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-ink-soft">{t.listing.availabilityNote}</p>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-16" aria-labelledby="similar-title">
            <h2 id="similar-title" className="font-display text-2xl font-semibold sm:text-3xl">{t.listing.similar}</h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => <li key={r.uid}><ListingCard l={r} lang={lang} /></li>)}
            </ul>
          </section>
        )}
      </div>
      <MobileActionBar wa={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`} tel={`tel:${contactPhone}`} labels={{ whatsapp: "WhatsApp", call: t.listing.call, visit: lang === "es" ? "Visita" : "Visit" }} />
      <div className="h-16 lg:hidden" aria-hidden />
      <JsonLd data={ld} />
    </>
  );
}
