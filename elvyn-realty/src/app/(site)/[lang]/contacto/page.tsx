import type { Metadata } from "next";
import { isLang, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { site } from "@/config/site";
import { crmStorageConfigured } from "@/config/env";
import { pageMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/site/PageHero";
import { LeadForm } from "@/components/site/LeadForm";
import { IconFacebook, IconInstagram, IconLinkedin, IconMail, IconPhone, IconPin, IconWhatsApp, IconYoutube } from "@/components/site/Icons";

type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang).contact;
  return pageMetadata({ lang, route: "contact", title: t.title, description: t.subtitle });
}

export default async function Contact({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang);
  const channels = [
    { href: `https://wa.me/${site.whatsapp}`, label: "WhatsApp", value: site.phone.display, Icon: IconWhatsApp, external: true, primary: true },
    { href: `tel:${site.phone.e164}`, label: t.common.phone, value: site.phone.display, Icon: IconPhone },
    { href: `mailto:${site.email}`, label: t.common.email, value: site.email, Icon: IconMail },
  ];
  const socials = [
    { url: site.social.instagram.url, label: "Instagram", handle: site.social.instagram.handle, Icon: IconInstagram },
    { url: site.social.facebook.url, label: "Facebook", handle: site.social.facebook.handle, Icon: IconFacebook },
    { url: site.social.youtube.url, label: "YouTube", handle: site.social.youtube.handle, Icon: IconYoutube },
    { url: site.social.linkedin.url, label: "LinkedIn", handle: site.social.linkedin.handle, Icon: IconLinkedin },
  ];
  return (
    <>
      <PageHero title={t.contact.title} subtitle={t.contact.subtitle} />
      <section className="container grid gap-12 py-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t.contact.direct}</h2>
          <ul className="mt-5 space-y-3">
            {channels.map(({ href: h, label, value, Icon, external, primary }) => (
              <li key={label}>
                <a href={h} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${primary ? "border-[#1F8F4E]/30 bg-emerald-50 hover:bg-emerald-100" : "border-navy-100 hover:bg-navy-50"}`}>
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${primary ? "bg-[#1F8F4E] text-white" : "bg-navy text-white"}`}><Icon size={22} /></span>
                  <span className="min-w-0">
                    <span className="block text-sm text-ink-muted">{label}</span>
                    <span className="block break-all font-semibold text-navy">{value}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <h2 className="mt-10 font-display text-2xl font-semibold">{t.contact.office}</h2>
          <p className="mt-3 flex items-start gap-2.5 text-ink"><IconPin size={20} className="mt-0.5 shrink-0 text-brand" /> {site.address.street[lang]}, {site.address.locality}, {site.address.region}, {site.address.country}</p>
          <p className="mt-2 text-sm text-ink-muted">{site.hours ? site.hours[lang] : t.contact.hoursUnknown}</p>
          <h2 className="mt-10 font-display text-2xl font-semibold">{t.contact.social}</h2>
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {socials.map(({ url, label, handle, Icon }) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] items-center gap-3 rounded-xl border border-navy-100 px-3 hover:bg-navy-50">
                  <Icon size={20} className="text-brand-600" />
                  <span className="min-w-0"><span className="block text-sm font-semibold text-navy">{label}</span><span className="block truncate text-xs text-ink-muted">{handle}</span></span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-semibold">{t.contact.formTitle}</h2>
          <div className="mt-5"><LeadForm lang={lang} variant="contact" formEnabled={crmStorageConfigured()} /></div>
        </div>
      </section>
    </>
  );
}
