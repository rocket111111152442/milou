"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import type { SearchFilters } from "@/lib/catalog/types";
import { DEFAULT_FILTERS } from "@/lib/catalog/filters";
import { catalogUrl } from "./url";
import { IconClose, IconFilter } from "../Icons";

export interface FacetOpt { value: string; label: string; count?: number }

interface Props { lang: Lang; filters: SearchFilters; types: FacetOpt[]; cities: FacetOpt[]; resultCount: number | null }

function FilterFields({ lang, f, set, types, cities, idPrefix }: { lang: Lang; f: SearchFilters; set: (p: Partial<SearchFilters>) => void; types: FacetOpt[]; cities: FacetOpt[]; idPrefix: string }) {
  const t = getDict(lang).search;
  const id = (s: string) => `${idPrefix}-${s}`;
  const num = (v: string) => (v ? Number(v.replace(/[^\d]/g, "")) || null : null);
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="field-label">{t.operation}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-navy-50 p-1">
          {([[null, t.any], ["sale", t.buy], ["rent", t.rent]] as const).map(([v, label]) => (
            <label key={label} className="relative">
              <input type="radio" name={id("op")} className="peer sr-only" checked={f.operation === v} onChange={() => set({ operation: v })} />
              <span className="flex min-h-[40px] cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-navy-700 peer-checked:bg-white peer-checked:text-navy peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={id("type")} className="field-label">{t.type}</label>
        <select id={id("type")} className="field" value={f.categories[0] ? String(f.categories[0]) : ""} onChange={(e) => set({ categories: e.target.value ? [Number(e.target.value)] : [] })}>
          <option value="">{t.anyType}</option>
          {types.map((o) => <option key={o.value} value={o.value}>{o.label}{o.count ? ` (${o.count})` : ""}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={id("city")} className="field-label">{t.city}</label>
        <select id={id("city")} className="field" value={f.city ?? ""} onChange={(e) => set({ city: e.target.value || null })}>
          <option value="">{t.anyCity}</option>
          {cities.map((o) => <option key={o.value} value={o.value}>{o.label}{o.count ? ` (${o.count})` : ""}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={id("q")} className="field-label">{t.keyword}</label>
        <input id={id("q")} className="field" placeholder={t.keywordPh} defaultValue={f.q ?? ""} onBlur={(e) => set({ q: e.target.value.trim() || null })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); set({ q: (e.target as HTMLInputElement).value.trim() || null }); } }} />
      </div>
      <fieldset>
        <legend className="field-label">{t.budgetMin} / {t.budgetMax}</legend>
        <div className="grid grid-cols-[88px_1fr_1fr] gap-2">
          <label className="sr-only" htmlFor={id("cur")}>{t.currency}</label>
          <select id={id("cur")} className="field px-2" value={f.currency} onChange={(e) => set({ currency: e.target.value as "USD" | "DOP" })}>
            <option value="USD">USD</option>
            <option value="DOP">DOP</option>
          </select>
          <label className="sr-only" htmlFor={id("pmin")}>{t.budgetMin}</label>
          <input id={id("pmin")} className="field" inputMode="numeric" placeholder="Min" defaultValue={f.priceMin ?? ""} onBlur={(e) => set({ priceMin: num(e.target.value) })} />
          <label className="sr-only" htmlFor={id("pmax")}>{t.budgetMax}</label>
          <input id={id("pmax")} className="field" inputMode="numeric" placeholder="Max" defaultValue={f.priceMax ?? ""} onBlur={(e) => set({ priceMax: num(e.target.value) })} />
        </div>
        {!f.operation && (f.priceMin || f.priceMax) ? <p className="mt-1.5 text-xs text-ink-soft">{t.priceNeedsOp}</p> : null}
      </fieldset>
      {([["bedroomsMin", t.bedrooms], ["bathroomsMin", t.bathrooms], ["parkingMin", t.parking]] as const).map(([key, label]) => (
        <fieldset key={key}>
          <legend className="field-label">{label}</legend>
          <div className="flex gap-1.5">
            {[null, 1, 2, 3, 4].map((n) => (
              <label key={String(n)} className="relative flex-1">
                <input type="radio" name={id(key)} className="peer sr-only" checked={(f[key] ?? null) === n} onChange={() => set({ [key]: n } as Partial<SearchFilters>)} />
                <span className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-navy-200 text-sm font-medium text-navy-700 peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                  {n === null ? t.any : t.min(n)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div>
        <label htmlFor={id("cond")} className="field-label">{t.condition}</label>
        <select id={id("cond")} className="field" value={f.condition ?? ""} onChange={(e) => set({ condition: (e.target.value || null) as SearchFilters["condition"] })}>
          <option value="">{t.conditionAny}</option>
          <option value="ready">{t.ready}</option>
          <option value="construction">{t.construction}</option>
        </select>
      </div>
    </div>
  );
}

export function FiltersPanel({ lang, filters, types, cities, resultCount }: Props) {
  const t = getDict(lang).search;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setDraft(filters), [filters]);

  const go = (f: SearchFilters) => start(() => router.push(catalogUrl(lang, { ...f, page: 1 }), { scroll: false }));
  const applyNow = (p: Partial<SearchFilters>) => go({ ...filters, ...p });
  const activeCount = [filters.categories.length > 0, filters.city, filters.q, filters.priceMin || filters.priceMax, filters.bedroomsMin, filters.bathroomsMin, filters.parkingMin, filters.condition].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button,select,input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        openerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Desktop: changes apply immediately */}
      <aside className="hidden lg:block" aria-label={t.filters}>
        <div className="sticky top-24 rounded-2xl border border-navy-100 bg-white p-5" aria-busy={pending}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy">{t.filters}</h2>
            {activeCount > 0 && (
              <button type="button" className="text-sm font-medium text-brand-600 underline-offset-2 hover:underline" onClick={() => go({ ...DEFAULT_FILTERS, operation: filters.operation })}>{t.reset}</button>
            )}
          </div>
          <FilterFields lang={lang} f={filters} set={applyNow} types={types} cities={cities} idPrefix="d" />
        </div>
      </aside>

      {/* Mobile: drawer with explicit apply */}
      <div className="lg:hidden">
        <button ref={openerRef} type="button" className="btn-outline w-full" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <IconFilter size={18} /> {t.filters}{activeCount ? ` (${activeCount})` : ""}
        </button>
        {open && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="filters-title">
            <button className="absolute inset-0 bg-navy-900/50" tabIndex={-1} aria-label={getDict(lang).nav.close} onClick={() => setOpen(false)} />
            <div ref={dialogRef} className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-3xl bg-white shadow-lift animate-fade-up">
              <div className="flex items-center justify-between border-b border-navy-100 px-5 py-3">
                <h2 id="filters-title" className="text-lg font-semibold text-navy">{t.filters}</h2>
                <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-navy-50" onClick={() => { setOpen(false); openerRef.current?.focus(); }}>
                  <IconClose size={22} /><span className="sr-only">{getDict(lang).nav.close}</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <FilterFields lang={lang} f={draft} set={(p) => setDraft((d) => ({ ...d, ...p }))} types={types} cities={cities} idPrefix="m" />
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-3 border-t border-navy-100 p-4">
                <button type="button" className="btn-ghost" onClick={() => setDraft({ ...DEFAULT_FILTERS })}>{t.reset}</button>
                <button type="button" className="btn-primary" onClick={() => { setOpen(false); go(draft); }}>
                  {t.apply}{resultCount !== null && JSON.stringify(draft) === JSON.stringify(filters) ? ` · ${t.results(resultCount)}` : ""}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
