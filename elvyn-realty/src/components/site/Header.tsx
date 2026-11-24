"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { href, switchLangPath, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { site } from "@/config/site";
import { Logo } from "./Logo";
import { IconClose, IconMenu, IconPhone, IconWhatsApp } from "./Icons";

export function Header({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const links = [
    { href: href(lang, "sale"), label: t.nav.buy },
    { href: href(lang, "rent"), label: t.nav.rent },
    { href: href(lang, "sell"), label: t.nav.sell },
    { href: href(lang, "services"), label: t.nav.services },
    { href: href(lang, "about"), label: t.nav.about },
    { href: href(lang, "contact"), label: t.nav.contact },
  ];
  // usePathname returns the public URL (before rewrite)
  const internal = lang === "es" ? `/es${pathname === "/" ? "" : pathname}` : pathname;
  const otherLang: Lang = lang === "es" ? "en" : "es";
  const isActive = (h: string) => pathname === h || (h !== "/" && h !== "/en" && pathname.startsWith(h + "/"));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
      if (e.key === "Tab" && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll<HTMLElement>("a,button")];
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="container flex h-16 items-center justify-between gap-4 lg:h-[76px]">
        <Link href={href(lang, "home")} className="shrink-0" aria-label={`${site.name} — ${lang === "es" ? "inicio" : "home"}`}>
          <Logo priority className="max-h-11 lg:max-h-[52px]" />
        </Link>
        <nav aria-label={lang === "es" ? "Principal" : "Main"} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className="rounded-full px-3.5 py-2 text-[15px] font-medium text-navy-700 transition-colors hover:bg-navy-50 hover:text-navy aria-[current=page]:text-brand-600"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href={switchLangPath(internal, otherLang)}
            hrefLang={otherLang}
            lang={otherLang}
            className="hidden min-h-[44px] items-center rounded-full px-3 text-sm font-semibold text-navy-700 hover:bg-navy-50 sm:inline-flex"
            aria-label={t.nav.language}
          >
            {t.nav.languageShort}
          </Link>
          <a href={`tel:${site.phone.e164}`} className="btn-outline hidden xl:inline-flex" aria-label={`${t.nav.call} ${site.phone.display}`}>
            <IconPhone size={18} /> {site.phone.display}
          </a>
          <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-primary hidden sm:inline-flex">
            <IconWhatsApp size={18} /> WhatsApp
          </a>
          <button
            ref={buttonRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-navy hover:bg-navy-50 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(true)}
          >
            <IconMenu size={24} />
            <span className="sr-only">{t.nav.menu}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t.nav.menu}>
          <button className="absolute inset-0 bg-navy-900/50" aria-label={t.nav.close} tabIndex={-1} onClick={() => setOpen(false)} />
          <div id="mobile-menu" ref={panelRef} className="absolute inset-y-0 right-0 flex w-[min(88vw,380px)] flex-col bg-white shadow-lift animate-fade-up">
            <div className="flex h-16 items-center justify-between border-b border-navy-100 px-4">
              <Logo className="max-h-10" />
              <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-navy-50" onClick={() => { setOpen(false); buttonRef.current?.focus(); }}>
                <IconClose size={24} />
                <span className="sr-only">{t.nav.close}</span>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label={lang === "es" ? "Principal" : "Main"}>
              <ul>
                {[{ href: href(lang, "catalog"), label: t.nav.catalog }, ...links, { href: href(lang, "team"), label: t.nav.team }].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className="flex min-h-[52px] items-center rounded-xl px-4 text-lg font-medium text-navy hover:bg-navy-50 aria-[current=page]:text-brand-600">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="space-y-2 border-t border-navy-100 p-4">
              <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp w-full"><IconWhatsApp size={18} /> WhatsApp</a>
              <a href={`tel:${site.phone.e164}`} className="btn-outline w-full"><IconPhone size={18} /> {site.phone.display}</a>
              <Link href={switchLangPath(internal, otherLang)} hrefLang={otherLang} lang={otherLang} className="btn-ghost w-full">{t.nav.language}</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
