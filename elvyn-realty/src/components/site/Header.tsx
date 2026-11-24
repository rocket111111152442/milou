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
  const [scrolled, setScrolled] = useState(false);
  const overHero = false; // the bar always sits on light backgrounds
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
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
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
    <header className={`sticky inset-x-0 top-0 z-40 transition-[padding] duration-500 ${scrolled ? "pt-2 sm:pt-3" : "pt-0 sm:pt-4"}`}>
      <div
        className={`mx-auto flex items-center justify-between gap-4 transition-all duration-500 ease-out ${
          overHero
            ? "h-[72px] max-w-[1400px] px-4 sm:px-6 lg:h-[84px] lg:px-8"
            : `h-16 max-w-[1240px] border border-navy-100/70 bg-white/95 px-4 shadow-[0_12px_40px_-18px_rgba(16,38,50,.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/85 sm:rounded-full sm:px-6 lg:h-[70px] ${scrolled ? "sm:mx-3 xl:mx-auto" : "sm:mx-4 xl:mx-auto"}`
        }`}
      >
        <Link href={href(lang, "home")} className="shrink-0 transition-transform duration-300 hover:scale-[1.03]" aria-label={`${site.name} — ${lang === "es" ? "inicio" : "home"}`}>
          <Logo priority variant={overHero ? "white" : undefined} className={`transition-all duration-500 ${overHero ? "max-h-12 lg:max-h-14" : "max-h-10 lg:max-h-11"}`} />
        </Link>
        <nav aria-label={lang === "es" ? "Principal" : "Main"} className="hidden lg:block">
          <ul className="flex items-center gap-6 xl:gap-8">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`link-underline py-1 text-[15px] font-medium transition-colors ${overHero ? "text-white/90 hover:text-white" : "text-navy-700 hover:text-navy aria-[current=page]:text-brand-600"}`}
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
            translate="no"
            className={`hidden h-10 w-10 items-center justify-center rounded-full border text-xs font-bold tracking-wider transition-colors sm:inline-flex ${overHero ? "border-white/30 text-white hover:bg-white/15" : "border-navy-200 text-navy-700 hover:bg-navy-50"}`}
            aria-label={t.nav.language}
          >
            {t.nav.languageShort}
          </Link>
          <a href={`tel:${site.phone.e164}`} className={`hidden xl:inline-flex ${overHero ? "btn-glass" : "btn-outline"}`} aria-label={`${t.nav.call} ${site.phone.display}`}>
            <IconPhone size={18} /> {site.phone.display}
          </a>
          <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-primary hidden sm:inline-flex">
            <IconWhatsApp size={18} /> WhatsApp
          </a>
          <button
            ref={buttonRef}
            type="button"
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors lg:hidden ${overHero ? "text-white hover:bg-white/15" : "text-navy hover:bg-navy-50"}`}
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
          <button className="absolute inset-0 animate-fade-up bg-navy-900/60 backdrop-blur-sm" aria-label={t.nav.close} tabIndex={-1} onClick={() => setOpen(false)} />
          <div id="mobile-menu" ref={panelRef} className="absolute inset-y-0 right-0 flex w-[min(88vw,380px)] flex-col bg-white shadow-lift animate-pop-in">
            <div className="flex h-16 items-center justify-between border-b border-navy-100 px-4">
              <Logo className="max-h-10" />
              <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-navy-50" onClick={() => { setOpen(false); buttonRef.current?.focus(); }}>
                <IconClose size={24} />
                <span className="sr-only">{t.nav.close}</span>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label={lang === "es" ? "Principal" : "Main"}>
              <ul>
                {[{ href: href(lang, "catalog"), label: t.nav.catalog }, ...links, { href: href(lang, "team"), label: t.nav.team }].map((l, i) => (
                  <li key={l.href} className="animate-fade-up" style={{ animationDelay: `${80 + i * 45}ms` }}>
                    <Link href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className="flex min-h-[52px] items-center rounded-xl px-4 font-display text-xl font-medium text-navy transition-all hover:translate-x-1 hover:bg-navy-50 aria-[current=page]:text-brand-600">
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
