import Link from "next/link";
import { href, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { site } from "@/config/site";
import { DEFAULT_FILTERS } from "@/lib/catalog/filters";
import { getFacets, searchListings, CatalogUnavailable } from "@/lib/catalog/service";
import type { Facets, SearchFilters, SearchResult } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/catalog/format";
import { ListingCard } from "../ListingCard";
import { IconChevronLeft, IconChevronRight, IconClose, IconWhatsApp } from "../Icons";
import { FiltersPanel } from "./FiltersPanel";
import { SortSelect } from "./SortSelect";
import { catalogUrl } from "./url";

export async function CatalogView({ lang, filters, title, intro }: { lang: Lang; filters: SearchFilters; title: string; intro: string }) {
  const t = getDict(lang);
  let result: SearchResult | null = null;
  let facets: Facets | null = null;
  let failed = false;
  try {
    [result, facets] = await Promise.all([searchListings(filters), getFacets()]);
  } catch (e) {
    if (!(e instanceof CatalogUnavailable)) throw e;
    failed = true;
  }
  const types = (facets?.categories ?? []).map((c) => ({ value: String(c.id), label: (lang === "en" ? c.nameEn : null) || c.name, count: c.count }));
  const cities = (facets?.cities ?? []).map((c) => ({ value: c.name, label: c.name, count: c.count }));

  // Active filters, each removable individually
  const chips: { label: string; url: string }[] = [];
  const without = (p: Partial<SearchFilters>) => catalogUrl(lang, { ...filters, ...p, page: 1 });
  const typeName = (id: number) => types.find((x) => x.value === String(id))?.label ?? `#${id}`;
  filters.categories.forEach((c) => chips.push({ label: typeName(c), url: without({ categories: filters.categories.filter((x) => x !== c) }) }));
  if (filters.city) chips.push({ label: filters.city, url: without({ city: null }) });
  if (filters.q) chips.push({ label: `“${filters.q}”`, url: without({ q: null }) });
  if (filters.priceMin) chips.push({ label: `≥ ${formatMoney({ amount: filters.priceMin, currency: filters.currency }, lang)}`, url: without({ priceMin: null }) });
  if (filters.priceMax) chips.push({ label: `≤ ${formatMoney({ amount: filters.priceMax, currency: filters.currency }, lang)}`, url: without({ priceMax: null }) });
  if (filters.bedroomsMin) chips.push({ label: `${t.search.bedrooms}: ${filters.bedroomsMin}+`, url: without({ bedroomsMin: null }) });
  if (filters.bathroomsMin) chips.push({ label: `${t.search.bathrooms}: ${filters.bathroomsMin}+`, url: without({ bathroomsMin: null }) });
  if (filters.parkingMin) chips.push({ label: `${t.search.parking}: ${filters.parkingMin}+`, url: without({ parkingMin: null }) });
  if (filters.condition) chips.push({ label: filters.condition === "ready" ? t.search.ready : t.search.construction, url: without({ condition: null }) });

  const resetUrl = catalogUrl(lang, { ...DEFAULT_FILTERS, operation: filters.operation });

  return (
    <div className="container py-8 sm:py-12">
      <header className="max-w-3xl">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-ink-muted">{intro}</p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]">
        <FiltersPanel lang={lang} filters={filters} types={types} cities={cities} resultCount={result?.count ?? null} />

        <section aria-labelledby="results-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-heading" className="text-base font-semibold text-navy" aria-live="polite">
              {result ? t.search.results(result.count) : " "}
            </h2>
            {result && result.count > 1 && <SortSelect lang={lang} filters={filters} />}
          </div>

          {chips.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={lang === "es" ? "Filtros activos" : "Active filters"}>
              {chips.map((c) => (
                <li key={c.label}>
                  <Link href={c.url} scroll={false} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-navy-50 py-1 pl-3 pr-2 text-sm font-medium text-navy-700 hover:bg-navy-100" aria-label={t.search.removeFilter(c.label)}>
                    {c.label} <IconClose size={14} />
                  </Link>
                </li>
              ))}
              <li><Link href={resetUrl} scroll={false} className="inline-flex min-h-[36px] items-center px-2 text-sm font-medium text-brand-600 hover:underline">{t.search.reset}</Link></li>
            </ul>
          )}

          {failed ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950" role="alert">
              <h3 className="font-semibold">{t.search.errorTitle}</h3>
              <p className="mt-1 text-sm">{t.search.errorText}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={catalogUrl(lang, filters)} className="btn-dark">{t.common.retry}</Link>
                <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp"><IconWhatsApp size={18} /> WhatsApp</a>
              </div>
            </div>
          ) : result && result.count === 0 ? (
            <div className="mt-6 rounded-2xl border border-navy-100 bg-sand p-8 text-center">
              <h3 className="font-display text-2xl font-semibold">{t.search.emptyTitle}</h3>
              <p className="mx-auto mt-2 max-w-lg text-ink-muted">{t.search.emptyText}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href={resetUrl} className="btn-dark">{t.search.reset}</Link>
                <Link href={href(lang, "contact")} className="btn-outline">{t.nav.contact}</Link>
              </div>
            </div>
          ) : result ? (
            <>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {result.results.map((l, i) => (
                  <li key={l.uid}><ListingCard l={l} lang={lang} preferred={filters.operation} priority={i < 2} /></li>
                ))}
              </ul>
              {result.totalPages > 1 && <Pagination lang={lang} filters={filters} page={result.page} total={result.totalPages} />}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Pagination({ lang, filters, page, total }: { lang: Lang; filters: SearchFilters; page: number; total: number }) {
  const t = getDict(lang).search;
  const pages = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const list = [...pages].sort((a, b) => a - b);
  const url = (p: number) => catalogUrl(lang, { ...filters, page: p });
  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label={t.pageOf(page, total)}>
      {page > 1 ? (
        <Link href={url(page - 1)} rel="prev" className="btn-outline px-3"><IconChevronLeft size={18} /> <span className="hidden sm:inline">{t.prev}</span></Link>
      ) : null}
      {list.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && list[i - 1] !== p - 1 && <span className="px-1 text-ink-soft" aria-hidden>…</span>}
          <Link href={url(p)} aria-current={p === page ? "page" : undefined} className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-full border border-navy-200 px-3 text-sm font-semibold text-navy hover:bg-navy-50 aria-[current=page]:border-navy aria-[current=page]:bg-navy aria-[current=page]:text-white">
            {p}
          </Link>
        </span>
      ))}
      {page < total ? (
        <Link href={url(page + 1)} rel="next" className="btn-outline px-3"><span className="hidden sm:inline">{t.next}</span> <IconChevronRight size={18} /></Link>
      ) : null}
    </nav>
  );
}
