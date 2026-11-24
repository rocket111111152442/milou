import type { Metadata } from "next";
import Image from "next/image";
import { isLang, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { team, whatsappLink } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/site/PageHero";
import { IconInstagram, IconMail, IconPhone, IconWhatsApp } from "@/components/site/Icons";

type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang).team;
  return pageMetadata({ lang, route: "team", title: t.title, description: t.subtitle });
}

export default async function Team({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang);
  const bios: Record<string, readonly string[]> = { "elvyn-arnaud": t.team.elvynBio, "edwin-guzman": t.team.edwinBio };
  return (
    <>
      <PageHero title={t.team.title} subtitle={t.team.subtitle} />
      <section className="container py-16">
        <ul className="grid gap-8 md:grid-cols-2">
          {team.map((m) => (
            <li key={m.slug} id={m.slug} className="flex flex-col overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-card sm:flex-row">
              <div className="relative aspect-[4/5] sm:aspect-auto sm:w-56 sm:shrink-0">
                <Image src={m.photo} alt={m.name} fill sizes="(min-width:640px) 224px, 100vw" className="object-cover object-top" />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h2 className="font-display text-2xl font-semibold">{m.name}</h2>
                <p className="mt-1 text-sm font-medium text-brand-600">{m.role[lang]}</p>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-muted">
                  {bios[m.slug]?.map((b) => <li key={b.slice(0, 24)}>{b}</li>)}
                </ul>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <a href={whatsappLink(undefined, m.phone)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-4"><IconWhatsApp size={17} /> WhatsApp</a>
                  <a href={`tel:${m.phone}`} className="btn-outline px-4" aria-label={`${t.nav.call} ${m.shortName}`}><IconPhone size={17} /></a>
                  <a href={`mailto:${m.email}`} className="btn-outline px-4" aria-label={`${t.common.email} ${m.shortName}`}><IconMail size={17} /></a>
                  <a href={`https://www.instagram.com/${m.instagram}/`} target="_blank" rel="noopener noreferrer" className="btn-outline px-4" aria-label={`Instagram ${m.shortName}`}><IconInstagram size={17} /></a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
