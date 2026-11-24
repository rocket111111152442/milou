import type { Metadata } from "next";
import Image from "next/image";
import { isLang, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { crmStorageConfigured } from "@/config/env";
import { pageMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/site/PageHero";
import { LeadForm } from "@/components/site/LeadForm";
import { IconCheck } from "@/components/site/Icons";

type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang).sell;
  return pageMetadata({ lang, route: "sell", title: t.title, description: t.subtitle });
}

export default async function Sell({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang);
  const s = t.sell;
  return (
    <>
      <PageHero eyebrow={t.nav.sell} title={s.title} subtitle={s.subtitle} />
      <section className="container grid gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="max-w-[65ch] text-lg leading-relaxed text-ink">{s.intro}</p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {s.pillars.map((p, i) => (
              <li key={p.title} className="rounded-2xl border border-navy-100 p-6">
                <span className="font-display text-3xl font-semibold text-brand">0{i + 1}</span>
                <h2 className="mt-2 font-semibold text-navy">{p.title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{p.text}</p>
              </li>
            ))}
          </ul>
          <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-2xl">
            <Image src="/img/hero-mobile.jpg" alt="" fill sizes="(min-width:1024px) 640px, 100vw" className="object-cover" />
          </div>
          <h2 className="mt-12 font-display text-2xl font-semibold">{s.docsTitle}</h2>
          <ul className="mt-4 space-y-2.5">
            {s.docs.map((d) => <li key={d} className="flex gap-2.5"><IconCheck size={18} className="mt-0.5 shrink-0 text-brand-600" /> {d}</li>)}
          </ul>
          <p className="mt-3 text-sm text-ink-muted">{s.docsNote}</p>
          <h2 className="mt-12 font-display text-2xl font-semibold">{t.services.processSell}</h2>
          <ol className="mt-4 space-y-3">
            {t.services.sellSteps.map((x, i) => (
              <li key={x} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{i + 1}</span><span className="pt-0.5">{x}</span></li>
            ))}
          </ol>
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
            <h2 className="font-display text-2xl font-semibold">{s.formTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t.forms.sellerTitle}</p>
            <div className="mt-5"><LeadForm lang={lang} variant="sell" formEnabled={crmStorageConfigured()} defaultIntent="sell" /></div>
          </div>
        </div>
      </section>
    </>
  );
}
