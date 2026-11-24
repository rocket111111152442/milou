import type { Metadata } from "next";
import Link from "next/link";
import { href, isLang, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { pageMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/site/PageHero";
import { JsonLd } from "@/components/site/JsonLd";
import { IconArrowRight, IconCheck } from "@/components/site/Icons";

type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang).services;
  return pageMetadata({ lang, route: "services", title: t.title, description: t.subtitle });
}

function Steps({ title, steps }: { title: string; steps: readonly string[] }) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-6">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3 text-[15px] leading-snug">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
            <span className="pt-0.5 text-ink">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function Services({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang);
  const s = t.services;
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: s.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <>
      <PageHero eyebrow={t.home.servicesEyebrow} title={s.title} subtitle={s.subtitle} />
      <section className="container py-16">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {s.list.map((x) => (
            <li key={x.title} className="rounded-2xl border border-navy-100 p-6">
              <h2 className="font-semibold text-navy">{x.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{x.text}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="bg-sand py-16" aria-labelledby="process-title">
        <div className="container">
          <h2 id="process-title" className="font-display text-3xl font-semibold">{s.processTitle}</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <Steps title={s.processBuy} steps={s.buySteps} />
            <Steps title={s.processSell} steps={s.sellSteps} />
            <Steps title={s.processRent} steps={s.rentSteps} />
          </div>
        </div>
      </section>
      <section className="container py-16" aria-labelledby="fin-title">
        <h2 id="fin-title" className="font-display text-3xl font-semibold">{s.financingTitle}</h2>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {s.financing.map((f) => (
            <li key={f.title} className="rounded-2xl bg-navy p-6 text-white">
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-100">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="container pb-20" aria-labelledby="faq-title">
        <h2 id="faq-title" className="font-display text-3xl font-semibold">{s.faqTitle}</h2>
        <p className="mt-3 max-w-3xl rounded-xl bg-amber-50 p-4 text-sm text-amber-950">{s.faqDisclaimer}</p>
        <div className="mt-6 divide-y divide-navy-100 rounded-2xl border border-navy-100">
          {s.faq.map((f) => (
            <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy">
                {f.q}
                <span className="text-xl text-brand transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 max-w-[75ch] leading-relaxed text-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={href(lang, "contact")} className="btn-primary">{t.nav.contact} <IconArrowRight size={16} /></Link>
          <Link href={href(lang, "sell")} className="btn-outline"><IconCheck size={16} /> {t.nav.sell}</Link>
        </div>
      </section>
      <JsonLd data={faqLd} />
    </>
  );
}
