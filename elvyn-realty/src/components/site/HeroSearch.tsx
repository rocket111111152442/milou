"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { href, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { IconSearch } from "./Icons";

export interface FacetOption { value: string; label: string }

export function HeroSearch({ lang, types, cities }: { lang: Lang; types: FacetOption[]; cities: FacetOption[] }) {
  const t = getDict(lang).search;
  const router = useRouter();
  const [op, setOp] = useState<"venta" | "alquiler">("venta");
  const [tipo, setTipo] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [max, setMax] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (tipo) p.set("tipo", tipo);
    if (ciudad) p.set("ciudad", ciudad);
    if (max) {
      p.set("moneda", "USD");
      p.set("precio_max", max);
    }
    router.push(href(lang, op === "venta" ? "sale" : "rent", undefined, p));
  }

  return (
    <form onSubmit={submit} className="rounded-[1.75rem] border border-white/25 bg-white/15 p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,.6)] backdrop-blur-xl sm:p-2.5" role="search" aria-label={t.submit}>
      <div className="rounded-[1.35rem] bg-white p-3 sm:p-4">
      <fieldset>
        <legend className="sr-only">{t.operation}</legend>
        <div className="mb-2.5 inline-flex rounded-full bg-navy-50 p-1 sm:mb-3">
          {(["venta", "alquiler"] as const).map((v) => (
            <label key={v} className="relative">
              <input type="radio" name="op" value={v} checked={op === v} onChange={() => setOp(v)} className="peer sr-only" />
              <span className="inline-flex min-h-[36px] cursor-pointer items-center rounded-full px-4 text-sm sm:min-h-[40px] sm:px-5 font-semibold text-navy-700 transition-all duration-300 peer-checked:bg-navy peer-checked:text-white peer-checked:shadow-md peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                {v === "venta" ? t.buy : t.rent}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <label htmlFor="hs-type" className="field-label text-xs sm:text-sm">{t.type}</label>
          <select id="hs-type" className="field" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">{t.anyType}</option>
            {types.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="hs-city" className="field-label text-xs sm:text-sm">{t.city}</label>
          <select id="hs-city" className="field" value={ciudad} onChange={(e) => setCiudad(e.target.value)}>
            <option value="">{t.anyCity}</option>
            {cities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="hidden sm:block">
          <label htmlFor="hs-max" className="field-label">{t.budget} (USD)</label>
          <input id="hs-max" className="field" inputMode="numeric" placeholder="200000" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ""))} />
        </div>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <button type="submit" className="btn-primary group h-12 w-full px-7 lg:h-[46px] lg:w-auto"><IconSearch size={18} className="transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" /> {t.submit}</button>
        </div>
      </div>
      </div>
    </form>
  );
}
