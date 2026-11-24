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
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card transition-shadow duration-200 hover:shadow-lift focus-within:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-navy-50">
        {l.image ? (
          <AeImage src={l.image} alt={l.title} fill sizes="(min-width:1280px) 400px, (min-width:768px) 45vw, 100vw" priority={priority} className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-soft">{lang === "es" ? "Sin foto" : "No photo"}</div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {opLabel && <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy shadow-sm">{opLabel}</span>}
          {l.exclusive === true && <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white shadow-sm">{t.common.exclusive}</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-soft">
          {[categoryLabel(l, lang), l.condition.label && l.condition.code !== 9 ? l.condition.label : null].filter(Boolean).join(" · ")}
        </p>
        <H className="mt-1.5 line-clamp-2 font-display text-[19px] font-semibold leading-snug text-navy">
          <Link href={href(lang, "listing", l.slug)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {l.title}
          </Link>
        </H>
        {locationLabel(l) && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
            <IconPin size={16} className="shrink-0 text-brand" /> <span className="truncate">{locationLabel(l)}</span>
          </p>
        )}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          {l.bedrooms ? <li className="flex items-center gap-1.5"><IconBed size={17} /> {l.bedrooms} <span className="sr-only">{t.common.bedrooms(l.bedrooms)}</span><span aria-hidden>{t.common.bedShort}</span></li> : null}
          {l.bathrooms ? <li className="flex items-center gap-1.5"><IconBath size={17} /> {l.bathrooms} <span aria-hidden>{t.common.bathShort}</span></li> : null}
          {area ? <li className="flex items-center gap-1.5"><IconArea size={17} /> {formatArea(area, lang)}</li> : null}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
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
    <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white" aria-hidden>
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-5 w-4/5 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
        <div className="skeleton h-5 w-1/3 rounded" />
      </div>
    </div>
  );
}
