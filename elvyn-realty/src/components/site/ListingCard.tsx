import Link from "next/link";
import { href, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import type { ListingSummary } from "@/lib/catalog/types";
import { categoryLabel, formatArea, locationLabel, priceLabel } from "@/lib/catalog/format";
import { AeImage } from "./AeImage";
import { IconArea, IconBath, IconBed, IconPin } from "./Icons";

export function ListingCard({ l, lang, preferred, priority = false, headingLevel = "h3" }: { l: ListingSummary; lang: Lang; preferred?: "sale" | "rent" | null; priority?: boolean; headingLevel?: "h2" | "h3" }) {
  const t = getDict(lang);
  const price = priceLabel(l, lang, preferred);
  const area = l.area ?? l.landArea;
  const H = headingLevel;
  const opLabel = l.isProject ? t.common.project : l.operations.includes("sale") && preferred !== "rent" ? t.common.sale : l.operations.includes("rent") ? t.common.rent : l.operations.includes("rental") ? t.common.rental : null;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-card ring-1 ring-navy-100 transition-all duration-500 ease-out hover:-translate-y-2 hover:shadow-[0_30px_60px_-25px_rgba(16,38,50,.45)] hover:ring-brand/30 focus-within:shadow-lift motion-reduce:hover:translate-y-0">
      <div className="relative m-2 aspect-[4/3] overflow-hidden rounded-[1.35rem] bg-navy-50">
        {l.image ? (
          <AeImage src={l.image} alt={l.title} fill sizes="(min-width:1280px) 400px, (min-width:768px) 45vw, 100vw" priority={priority} className="object-cover transition-transform duration-[1.1s] ease-out group-hover:scale-110 motion-reduce:transition-none" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-soft">{lang === "es" ? "Sin foto" : "No photo"}</div>
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-navy-900/60 via-transparent to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {opLabel && <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">{opLabel}</span>}
          {l.exclusive === true && <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow-sm">{t.common.exclusive}</span>}
        </div>
        <span aria-hidden className="absolute bottom-3 right-3 inline-flex h-10 w-10 translate-y-3 items-center justify-center rounded-full bg-brand text-white opacity-0 shadow-lg transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-5 pt-3 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">
          {[categoryLabel(l, lang), l.condition.label && l.condition.code !== 9 ? l.condition.label : null].filter(Boolean).join(" · ")}
        </p>
        <H className="mt-1.5 line-clamp-2 font-display text-xl font-semibold leading-snug text-navy transition-colors duration-300 group-hover:text-brand-700">
          <Link href={href(lang, "listing", l.slug)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {l.title}
          </Link>
        </H>
        {locationLabel(l) && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
            <IconPin size={16} className="shrink-0 text-brand" /> <span className="truncate">{locationLabel(l)}</span>
          </p>
        )}
        <ul className="mt-4 flex flex-wrap gap-2 text-sm text-navy-700">
          {l.bedrooms ? <li className="flex items-center gap-1.5 rounded-full bg-sand px-3 py-1"><IconBed size={16} /> {l.bedrooms} <span className="sr-only">{t.common.bedrooms(l.bedrooms)}</span><span aria-hidden>{t.common.bedShort}</span></li> : null}
          {l.bathrooms ? <li className="flex items-center gap-1.5 rounded-full bg-sand px-3 py-1"><IconBath size={16} /> {l.bathrooms} <span aria-hidden>{t.common.bathShort}</span></li> : null}
          {area ? <li className="flex items-center gap-1.5 rounded-full bg-sand px-3 py-1"><IconArea size={16} /> {formatArea(area, lang)}</li> : null}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-navy-100 pt-4 mt-5">
          <p className="text-lg font-semibold text-navy">
            {price ? (
              <>
                {price.prefix && <span className="mr-1 text-sm font-medium text-ink-muted">{price.prefix}</span>}
                {price.main}
                {price.suffix && <span className="text-sm font-medium text-ink-muted">{price.suffix}</span>}
              </>
            ) : (
              <span className="text-base text-ink-muted">{t.common.priceOnRequest}</span>
            )}
          </p>
          {l.ref && <p className="text-xs text-ink-soft">{t.common.ref} {l.ref}</p>}
        </div>
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-navy-100" aria-hidden>
      <div className="skeleton m-2 aspect-[4/3] rounded-[1.35rem]" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-5 w-4/5 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
        <div className="skeleton h-5 w-1/3 rounded" />
      </div>
    </div>
  );
}
