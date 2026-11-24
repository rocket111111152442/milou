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
    <footer className="mt-auto bg-navy text-navy-100">
      <div className="container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr]">
        <div>
          <Logo variant="white" className="max-h-14" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-navy-200">{t.footer.about}</p>
          <ul className="mt-5 flex gap-2" aria-label={lang === "es" ? "Redes sociales" : "Social media"}>
            {socials.map(({ url, label, Icon }) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-brand" aria-label={label}>
                  <Icon size={18} />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label={t.footer.explore}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">{t.footer.explore}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="hover:text-white" href={href(lang, "catalog")}>{t.nav.catalog}</Link></li>
            <li><Link className="hover:text-white" href={href(lang, "sale")}>{t.nav.buy}</Link></li>
            <li><Link className="hover:text-white" href={href(lang, "rent")}>{t.nav.rent}</Link></li>
            <li><Link className="hover:text-white" href={href(lang, "sell")}>{t.nav.sell}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t.footer.company}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">{t.footer.company}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="hover:text-white" href={href(lang, "about")}>{t.nav.about}</Link></li>
            <li><Link className="hover:text-white" href={href(lang, "team")}>{t.nav.team}</Link></li>
            <li><Link className="hover:text-white" href={href(lang, "services")}>{t.nav.services}</Link></li>
            <li><Link className="hover:text-white" href={href(lang, "contact")}>{t.nav.contact}</Link></li>
          </ul>
        </nav>
        <div>
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
            <Link className="hover:text-white" href={href(lang, "privacy")}>{t.footer.privacy}</Link>
            <span>{t.footer.catalogSource}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
