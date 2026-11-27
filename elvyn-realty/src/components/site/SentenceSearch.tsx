"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { href, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import type { FacetOption } from "./HeroSearch";

/** Search written as a sentence: "I want to buy a villa in Cabrera up to US$ …". */
export function SentenceSearch({ lang, types, cities }: { lang: Lang; types: FacetOption[]; cities: FacetOption[] }) {
  const t = getDict(lang).search;
  const router = useRouter();
  const [op, setOp] = useState<"venta" | "alquiler">("venta");
  const [tipo, setTipo] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [max, setMax] = useState("");
  const es = lang === "es";

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

  const sel = "[field-sizing:content] cursor-pointer appearance-none rounded-none border-0 border-b-2 border-brand/50 bg-transparent px-1 pb-0.5 font-display font-semibold italic text-brand-600 transition-colors hover:border-brand focus:border-brand focus:outline-none focus:ring-0";
  return (
    <form onSubmit={submit} role="search" aria-label={t.submit} className="relative rounded-[2rem] bg-white p-5 shadow-[0_30px_70px_-35px_rgba(16,38,50,.45)] ring-1 ring-navy-100 sm:p-7">
      <p className="text-xl leading-[2.2] text-navy sm:text-2xl sm:leading-[2.1]">
        {es ? "Quiero " : "I want to "}
        <label className="sr-only" htmlFor="ss-op">{t.operation}</label>
        <select id="ss-op" className={sel} value={op} onChange={(e) => setOp(e.target.value as "venta" | "alquiler")}>
          <option value="venta">{es ? "comprar" : "buy"}</option>
          <option value="alquiler">{es ? "alquilar" : "rent"}</option>
        </select>{" "}
        <label className="sr-only" htmlFor="ss-type">{t.type}</label>
        <select id="ss-type" className={`${sel} max-w-[12ch] sm:max-w-none`} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">{es ? "una propiedad" : "a property"}</option>
          {types.map((o) => <option key={o.value} value={o.value}>{o.label.toLowerCase()}</option>)}
        </select>{" "}
        {es ? "en " : "in "}
        <label className="sr-only" htmlFor="ss-city">{t.city}</label>
        <select id="ss-city" className={`${sel} max-w-[14ch] sm:max-w-none`} value={ciudad} onChange={(e) => setCiudad(e.target.value)}>
          <option value="">{es ? "todo el país" : "the whole country"}</option>
          {cities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>{" "}
        {es ? "hasta " : "up to "}
        <span className="whitespace-nowrap font-display font-semibold italic text-brand-600">
          US$
          <label className="sr-only" htmlFor="ss-max">{t.budget} (USD)</label>
          <input id="ss-max" inputMode="numeric" placeholder={es ? "sin límite" : "no limit"} value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ""))} className="ml-1 w-[9ch] min-w-[5ch] border-0 supports-[field-sizing:content]:w-auto [field-sizing:content] border-b-2 border-brand/50 bg-transparent px-1 pb-0.5 font-display font-semibold italic text-brand-600 placeholder:text-brand/45 focus:border-brand focus:outline-none focus:ring-0 sm:w-[11ch]" />
        </span>
      </p>
      <button type="submit" className="btn-primary group mt-5 h-14 w-full text-base sm:absolute sm:-right-5 sm:bottom-1/2 sm:mt-0 sm:h-16 sm:w-16 sm:translate-y-1/2 sm:rounded-full sm:p-0" aria-label={t.submit}>
        <span className="sm:sr-only">{t.submit}</span>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-transform duration-300 group-hover:translate-x-1"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </form>
  );
}
