import Link from "next/link";
import { href, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import type { ListingSummary } from "@/lib/catalog/types";
import { categoryLabel, formatArea, locationLabel, priceLabel } from "@/lib/catalog/format";
import { AeImage } from "./AeImage";
import { IconArea, IconBath, IconBed, IconPin } from "./Icons";

/** `compact`: on phones the card is horizontal (photo left, details right) so several fit on one screen. */
export function ListingCard({ l, lang, preferred, priority = false, headingLevel = "h3", compact = false }: { l: ListingSummary; lang: Lang; preferred?: "sale" | "rent" | null; priority?: boolean; headingLevel?: "h2" | "h3"; compact?: boolean }) {
  const c = (phone: string, base: string) => (compact ? phone : base);
  const t = getDict(lang);
  const price = priceLabel(l, lang, preferred);
  const area = l.area ?? l.landArea;
  const H = headingLevel;
  const opLabel = l.isProject ? t.common.project : l.operations.includes("sale") && preferred !== "rent" ? t.common.sale : l.operations.includes("rent") ? t.common.rent : l.operations.includes("rental") ? t.common.rental : null;
  return (
    <article className={`group relative flex h-full overflow-hidden bg-white ${c("flex-row rounded-2xl sm:flex-col sm:rounded-[1.75rem]", "flex-col rounded-[1.75rem]")} shadow-card ring-1 ring-navy-100 transition-all duration-500 ease-out hover:-translate-y-2 hover:shadow-[0_30px_60px_-25px_rgba(16,38,50,.45)] hover:ring-brand/30 focus-within:shadow-lift motion-reduce:hover:translate-y-0`}>
      <div className={`relative overflow-hidden bg-navy-50 ${c("m-1.5 aspect-[4/5] w-[38%] shrink-0 rounded-xl sm:m-2 sm:aspect-[4/3] sm:w-auto sm:rounded-[1.35rem]", "m-2 aspect-[4/3] rounded-[1.35rem]")}`}>
        {l.image ? (
          <AeImage src={l.image} alt={l.title} fill sizes={compact ? "(min-width:1280px) 400px, (min-width:768px) 45vw, (min-width:640px) 100vw, 40vw" : "(min-width:1280px) 400px, (min-width:768px) 45vw, 100vw"} priority={priority} className="object-cover transition-transform duration-[1.1s] ease-out group-hover:scale-110 motion-reduce:transition-none" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-soft">{lang === "es" ? "Sin foto" : "No photo"}</div>
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-navy-900/60 via-transparent to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
        <div className={`absolute flex flex-wrap gap-1.5 ${c("left-1.5 top-1.5 sm:left-3 sm:top-3", "left-3 top-3")}`}>
          {opLabel && <span className={`rounded-full border border-white/30 bg-white/20 font-semibold text-white backdrop-blur-md ${c("px-2 py-0.5 text-[10px] sm:px-3 sm:py-1 sm:text-xs", "px-3 py-1 text-xs")}`}>{opLabel}</span>}
          {l.exclusive === true && <span className={`rounded-full bg-brand font-semibold text-white shadow-sm ${c("hidden px-3 py-1 text-xs sm:inline", "px-3 py-1 text-xs")}`}>{t.common.exclusive}</span>}
        </div>
        <span aria-hidden className="absolute bottom-3 right-3 inline-flex h-10 w-10 translate-y-3 items-center justify-center rounded-full bg-brand text-white opacity-0 shadow-lg transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
        </span>
      </div>
      <div className={`flex min-w-0 flex-1 flex-col ${c("px-2.5 pb-3 pt-2.5 sm:px-5 sm:pb-5 sm:pt-3", "px-4 pb-5 pt-3 sm:px-5")}`}>
        <p className={`font-semibold uppercase text-brand-600 ${c("truncate text-[10px] tracking-[0.1em] sm:text-[11px] sm:tracking-[0.14em]", "text-[11px] tracking-[0.14em]")}`}>
          {[categoryLabel(l, lang), l.condition.label && l.condition.code !== 9 ? l.condition.label : null].filter(Boolean).join(" · ")}
        </p>
        <H className={`mt-1 line-clamp-2 font-display font-semibold leading-snug text-navy transition-colors duration-300 group-hover:text-brand-700 ${c("text-[15px] sm:mt-1.5 sm:text-xl", "text-xl sm:mt-1.5")}`}>
          <Link href={href(lang, "listing", l.slug)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {l.title}
          </Link>
        </H>
        {locationLabel(l) && (
          <p className={`mt-1 flex items-center gap-1 text-ink-muted ${c("text-xs sm:mt-1.5 sm:gap-1.5 sm:text-sm", "text-sm sm:mt-1.5 sm:gap-1.5")}`}>
            <IconPin size={16} className="shrink-0 text-brand" /> <span className="truncate">{locationLabel(l)}</span>
          </p>
        )}
        <ul className={`flex flex-wrap text-navy-700 ${c("mt-2 gap-1 text-xs sm:mt-4 sm:gap-2 sm:text-sm [&>li]:px-2 [&>li]:py-0.5 sm:[&>li]:px-3 sm:[&>li]:py-1", "mt-4 gap-2 text-sm")}`}>
          {l.bedrooms ? <li className="flex items-center gap-1.5 rounded-full bg-sand px-3 py-1"><IconBed size={16} /> {l.bedrooms} <span className="sr-only">{t.common.bedrooms(l.bedrooms)}</span><span aria-hidden>{t.common.bedShort}</span></li> : null}
          {l.bathrooms ? <li className="flex items-center gap-1.5 rounded-full bg-sand px-3 py-1"><IconBath size={16} /> {l.bathrooms} <span aria-hidden>{t.common.bathShort}</span></li> : null}
          {area ? <li className="flex items-center gap-1.5 rounded-full bg-sand px-3 py-1"><IconArea size={16} /> {formatArea(area, lang)}</li> : null}
        </ul>
        <div className={`mt-auto flex items-end justify-between gap-3 border-t border-navy-100 ${c("pt-2 sm:pt-4", "pt-4")}`}>
          <p className={`font-semibold text-navy ${c("text-base sm:text-lg", "text-lg")}`}>
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
          {l.ref && <p className={`text-xs text-ink-soft ${c("hidden sm:block", "")}`}>{t.common.ref} {l.ref}</p>}
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
