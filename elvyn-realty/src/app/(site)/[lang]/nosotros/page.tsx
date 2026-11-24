import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { href, isLang, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { site } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/site/PageHero";
import { IconArrowRight, IconPin, IconShield, IconTag, IconUser } from "@/components/site/Icons";
import portrait from "../../../../../public/img/elvyn-arnaud.jpg";

type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang).about;
  return pageMetadata({ lang, route: "about", title: lang === "es" ? "Nosotros · Elvyn Arnaud" : "About · Elvyn Arnaud", description: t.subtitle });
}

export default async function About({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang);
  const icons = [IconShield, IconTag, IconUser];
  return (
    <>
      <PageHero eyebrow={t.about.eyebrow} title={t.about.title} subtitle={t.about.subtitle} />
      <section className="container grid gap-12 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="mx-auto w-full max-w-sm lg:sticky lg:top-24 lg:self-start">
          <Image src={portrait} alt="Elvyn Daniel Arnaud Paredes" placeholder="blur" sizes="(min-width:1024px) 380px, 90vw" className="rounded-3xl object-cover shadow-lift" />
          <p className="mt-4 text-center font-display text-lg italic text-navy">“{site.motto[lang]}”</p>
        </div>
        <div>
          <h2 className="font-display text-3xl font-semibold">{t.about.storyTitle}</h2>
          <p className="mt-1 font-medium text-brand-600">{t.about.storyRole}</p>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink">
            {t.about.story.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}
          </div>
          <blockquote className="mt-8 rounded-2xl bg-navy p-6 font-display text-xl leading-relaxed text-white sm:p-8">“{t.about.quote}”</blockquote>

          <h2 className="mt-12 font-display text-2xl font-semibold">{t.about.valuesTitle}</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {t.about.values.map((v, i) => {
              const Icon = icons[i];
              return (
                <li key={v.title} className="rounded-2xl border border-navy-100 p-5">
                  <Icon size={24} className="text-brand-600" />
                  <h3 className="mt-3 font-semibold text-navy">{v.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{v.text}</p>
                </li>
              );
            })}
          </ul>

          <h2 className="mt-12 font-display text-2xl font-semibold">{t.about.areasTitle}</h2>
          <p className="mt-3 text-ink-muted">{t.about.areasText}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {site.areas.map((a) => <li key={a} className="chip"><IconPin size={14} /> {a}</li>)}
          </ul>
          <dl className="mt-10 grid gap-4 rounded-2xl bg-sand p-6 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-soft">{lang === "es" ? "Razón social" : "Legal name"}</dt><dd className="font-medium text-navy">{site.legalName}</dd></div>
            <div><dt className="text-ink-soft">{lang === "es" ? "Oficina" : "Office"}</dt><dd className="font-medium text-navy">{site.address.street[lang]}, {site.address.locality}</dd></div>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={href(lang, "team")} className="btn-dark">{t.about.teamCta} <IconArrowRight size={16} /></Link>
            <Link href={href(lang, "contact")} className="btn-outline">{t.nav.contact}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
