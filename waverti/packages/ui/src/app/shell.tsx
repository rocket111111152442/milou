"use client";
import * as React from "react";
import { Menu, X } from "lucide-react";
import { cn } from "../lib/cn";
import { Logo } from "../components/logo";
import { defaultRenderLink, type RenderLink } from "./link";

export { defaultRenderLink, type RenderLink };

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: number | null;
  /** Petite mention à côté du libellé (ex. « Bientôt »). */
  tag?: string;
}

/** Coque applicative partagée par le tableau de bord web et l'application desktop. */
export function AppShell({
  nav,
  secondaryNav = [],
  renderLink = defaultRenderLink,
  header,
  sidebarFooter,
  children,
  homeHref = "/app",
  variant = "default",
  mobileTabs,
}: {
  nav: NavItem[];
  secondaryNav?: NavItem[];
  renderLink?: RenderLink;
  header?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
  homeHref?: string;
  /** « brand » : menu indigo coloré (tableau de bord web). « default » : inchangé (application desktop). */
  variant?: "default" | "brand";
  /** Barre d'onglets en bas sur téléphone (4 ou 5 entrées au plus). */
  mobileTabs?: NavItem[];
}) {
  const brand = variant === "brand";
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  const navList = (items: NavItem[]) => (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={item.href}>
          {renderLink({
            href: item.href,
            "aria-current": item.active ? "page" : undefined,
            onClick: close,
            className: cn(
              "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors [&_svg]:size-[18px]",
              brand
                ? item.active
                  ? "bg-white text-nav shadow-soft"
                  : "text-nav-fg hover:bg-white/10 hover:text-white"
                : item.active
                  ? "bg-blue/10 text-blue"
                  : "text-ink-soft hover:bg-canvas hover:text-ink",
            ),
            children: (
              <>
                <span className={cn("transition-colors", brand ? (item.active ? "text-blue" : "text-nav-fg group-hover:text-white") : cn("text-muted group-hover:text-ink", item.active && "text-blue"))}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.tag ? (
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", brand ? "bg-white/15 text-white" : "bg-surface-strong text-ink-soft")}>{item.tag}</span>
                ) : null}
                {item.badge ? (
                  <span className={cn("min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 text-white", brand ? "bg-[#d6249f]" : "bg-ink")}>
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </>
            ),
          })}
        </li>
      ))}
    </ul>
  );

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex h-10 items-center px-2">{renderLink({ href: homeHref, children: <Logo light={brand} />, onClick: close })}</div>
      <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-6">
        {navList(nav)}
        {secondaryNav.length ? (
          <div className={cn("mt-auto border-t pt-4", brand ? "border-white/15" : "border-line")}>{navList(secondaryNav)}</div>
        ) : null}
      </nav>
      {sidebarFooter}
    </div>
  );

  return (
    <div className="app-canvas min-h-dvh">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden w-64 lg:block", brand ? "sidebar-brand" : "border-r border-line/70 bg-white/80 backdrop-blur")}>{sidebar}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-ink/30" onClick={close} />
          <div className={cn("absolute inset-y-0 left-0 w-72 max-w-[85vw]", brand ? "sidebar-brand" : "border-r border-line bg-white")}>{sidebar}</div>
        </div>
      ) : null}
      <div className="lg:pl-64">
        <header className={cn("sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-6", brand ? "border-white/60 bg-white/55" : "border-line/70 bg-white/70")}>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-ink hover:bg-surface lg:hidden"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className="flex flex-1 items-center justify-end gap-2">{header}</div>
        </header>
        <main id="contenu" className={cn("mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8", mobileTabs?.length && "pb-28 lg:pb-8")}>
          {children}
        </main>
      </div>
      {mobileTabs?.length ? (
        <nav aria-label="Navigation rapide" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-nav/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
            {mobileTabs.map((t) => (
              <li key={t.href} className="flex-1">
                {renderLink({
                  href: t.href,
                  "aria-current": t.active ? "page" : undefined,
                  className: cn(
                    "relative flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors [&_svg]:size-5",
                    t.active ? "text-white" : "text-nav-fg hover:text-white",
                  ),
                  children: (
                    <>
                      <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", t.active && "bg-white/20")}>{t.icon}</span>
                      <span>{t.label}</span>
                      {t.badge ? (
                        <span className="absolute right-[22%] top-2 min-w-4 rounded-full bg-[#d6249f] px-1 text-center text-[10px] font-semibold leading-4 text-white">
                          <span className="sr-only">{t.badge} non lues </span>
                          <span aria-hidden="true">{t.badge > 9 ? "9+" : t.badge}</span>
                        </span>
                      ) : null}
                    </>
                  ),
                })}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
