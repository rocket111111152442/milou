"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { href, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { LeadForm } from "../LeadForm";
import { IconCalendar, IconChat, IconChevronLeft, IconMail } from "../Icons";

export function openAssistant(detail: { message?: string } = {}) {
  window.dispatchEvent(new CustomEvent("ea:open-chat", { detail }));
}

export function AskAssistantButton({ lang, className = "btn-outline w-full" }: { lang: Lang; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => openAssistant()}>
      <IconChat size={18} /> {getDict(lang).listing.askAssistant}
    </button>
  );
}

/** Information / visit request forms on the listing page. Reachable from the sidebar buttons via #solicitud. */
export function ListingRequest({ lang, property, formEnabled }: { lang: Lang; property: { slug: string; ref: string | null; title: string }; formEnabled: boolean }) {
  const t = getDict(lang);
  const [tab, setTab] = useState<"info" | "visit">("info");
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === "#solicitar-visita") setTab("visit");
      if (window.location.hash === "#solicitar-informacion") setTab("info");
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return (
    <section id="solicitud" aria-labelledby="request-title" className="relative scroll-mt-24 rounded-2xl border border-navy-100 bg-white p-5 shadow-card sm:p-7">
      <span id="solicitar-informacion" className="absolute -top-24" aria-hidden />
      <span id="solicitar-visita" className="absolute -top-24" aria-hidden />
      <h2 id="request-title" className="font-display text-2xl font-semibold">{t.listing.contactTitle}</h2>
      <div role="tablist" aria-label={t.listing.contactTitle} className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-navy-50 p-1">
        {(["info", "visit"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            onClick={() => setTab(k)}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg text-sm font-semibold text-navy-700 aria-selected:bg-white aria-selected:text-navy aria-selected:shadow-sm"
          >
            {k === "info" ? <IconMail size={17} /> : <IconCalendar size={17} />}
            {k === "info" ? t.listing.requestInfo : t.listing.requestVisit}
          </button>
        ))}
      </div>
      <div className="mt-5" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        <LeadForm key={tab} lang={lang} variant={tab === "info" ? "property" : "visit"} property={property} formEnabled={formEnabled} />
      </div>
    </section>
  );
}

export function BackToResults({ lang, fallback }: { lang: Lang; fallback: string }) {
  const [fromCatalog, setFromCatalog] = useState(false);
  useEffect(() => {
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      setFromCatalog(Boolean(ref && ref.origin === window.location.origin && /\/(propiedades|venta|alquiler|properties|for-sale|for-rent)(\/|$|\?)/.test(ref.pathname + ref.search)));
    } catch {
      /* ignore */
    }
  }, []);
  const label = getDict(lang).listing.backToResults;
  if (fromCatalog)
    return (
      <button type="button" onClick={() => window.history.back()} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-navy-700 hover:text-brand-600">
        <IconChevronLeft size={18} /> {label}
      </button>
    );
  return (
    <Link href={fallback || href(lang, "catalog")} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-navy-700 hover:text-brand-600">
      <IconChevronLeft size={18} /> {label}
    </Link>
  );
}
