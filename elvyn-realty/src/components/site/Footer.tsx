import Link from "next/link";
import { href, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { site } from "@/config/site";
import { Logo } from "./Logo";
import { IconCalendar, IconFacebook, IconInstagram, IconLinkedin, IconMail, IconPhone, IconPin, IconWhatsApp, IconYoutube } from "./Icons";

export function Footer({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const year = new Date().getFullYear();
  const socials = [
    { url: site.social.instagram.url, label: `Instagram ${site.social.instagram.handle}`, Icon: IconInstagram },
    { url: site.social.facebook.url, label: "Facebook", Icon: IconFacebook },
    { url: site.social.youtube.url, label: "YouTube", Icon: IconYoutube },
    { url: site.social.linkedin.url, label: "LinkedIn", Icon: IconLinkedin },
  ];
  return (
    <footer className="grain relative mt-auto overflow-hidden rounded-t-[2.5rem] bg-navy-900 text-navy-100">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-10 h-80 w-80 animate-blob bg-brand/15 blur-3xl motion-reduce:animate-none" />
      <div className="container relative hidden border-b border-white/10 py-10 sm:block sm:py-20" data-reveal>
        <p className="eyebrow text-brand-200">{lang === "es" ? "¿Hablamos?" : "Let's talk"}</p>
        <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="group mt-3 inline-flex flex-wrap items-center gap-x-4 gap-y-2 font-display text-3xl font-semibold leading-tight text-white sm:text-6xl lg:text-7xl">
          <span className="link-underline">{lang === "es" ? "Encuentra tu lugar en el Caribe" : "Find your place in the Caribbean"}</span>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white transition-transform duration-500 group-hover:rotate-45 sm:h-20 sm:w-20">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 17 17 7M8 7h9v9" /></svg>
          </span>
        </a>
      </div>
      <div className="container relative grid grid-cols-2 gap-x-6 gap-y-8 py-10 sm:gap-10 sm:py-14 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr]">
        <div className="col-span-2 lg:col-span-1">
          <Logo variant="white" className="max-h-14" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-navy-200">{t.footer.about}</p>
          <ul className="mt-5 flex gap-2" aria-label={lang === "es" ? "Redes sociales" : "Social media"}>
            {socials.map(({ url, label, Icon }) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-300 hover:-translate-y-1 hover:rotate-6 hover:bg-brand" aria-label={label}>
                  <Icon size={18} />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label={t.footer.explore}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">{t.footer.explore}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="link-underline hover:text-white" href={href(lang, "catalog")}>{t.nav.catalog}</Link></li>
            <li><Link className="link-underline hover:text-white" href={href(lang, "sale")}>{t.nav.buy}</Link></li>
            <li><Link className="link-underline hover:text-white" href={href(lang, "rent")}>{t.nav.rent}</Link></li>
            <li><Link className="link-underline hover:text-white" href={href(lang, "sell")}>{t.nav.sell}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t.footer.company}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">{t.footer.company}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="link-underline hover:text-white" href={href(lang, "about")}>{t.nav.about}</Link></li>
            <li><Link className="link-underline hover:text-white" href={href(lang, "team")}>{t.nav.team}</Link></li>
            <li><Link className="link-underline hover:text-white" href={href(lang, "services")}>{t.nav.services}</Link></li>
            <li><Link className="link-underline hover:text-white" href={href(lang, "contact")}>{t.nav.contact}</Link></li>
          </ul>
        </nav>
        <div className="col-span-2 lg:col-span-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">{t.footer.contact}</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li><a className="flex items-start gap-2.5 hover:text-white" href={`tel:${site.phone.e164}`}><IconPhone size={18} className="mt-0.5 shrink-0 text-brand-200" />{site.phone.display}</a></li>
            <li><a className="flex items-start gap-2.5 hover:text-white" href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer"><IconWhatsApp size={18} className="mt-0.5 shrink-0 text-brand-200" />WhatsApp</a></li>
            <li><a className="flex items-start gap-2.5 break-all hover:text-white" href={`mailto:${site.email}`}><IconMail size={18} className="mt-0.5 shrink-0 text-brand-200" />{site.email}</a></li>
            <li className="flex items-start gap-2.5"><IconPin size={18} className="mt-0.5 shrink-0 text-brand-200" /><span>{site.address.street[lang]}, {site.address.locality}, {site.address.region}</span></li>
            {site.hours && <li className="flex items-start gap-2.5"><IconCalendar size={18} className="mt-0.5 shrink-0 text-brand-200" /><span>{site.hours[lang]}</span></li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container flex flex-col gap-2 py-5 text-xs text-navy-200 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {t.footer.legal(`${site.name} · ${site.legalName}`)}</p>
          <p className="flex gap-4">
            <Link className="link-underline hover:text-white" href={href(lang, "privacy")}>{t.footer.privacy}</Link>
            <span>{t.footer.catalogSource}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
