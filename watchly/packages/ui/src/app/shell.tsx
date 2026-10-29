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
}: {
  nav: NavItem[];
  secondaryNav?: NavItem[];
  renderLink?: RenderLink;
  header?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
  homeHref?: string;
}) {
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
              item.active ? "bg-surface-strong text-ink" : "text-ink-soft hover:bg-surface hover:text-ink",
            ),
            children: (
              <>
                <span className={cn("text-muted transition-colors group-hover:text-ink", item.active && "text-ink")}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="min-w-5 rounded-full bg-ink px-1.5 text-center text-[11px] font-semibold leading-5 text-white">
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
      <div className="flex h-10 items-center px-2">{renderLink({ href: homeHref, children: <Logo />, onClick: close })}</div>
      <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-6">
        {navList(nav)}
        {secondaryNav.length ? (
          <div className="mt-auto border-t border-line pt-4">{navList(secondaryNav)}</div>
        ) : null}
      </nav>
      {sidebarFooter}
    </div>
  );

  return (
    <div className="min-h-dvh bg-surface">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block">{sidebar}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-ink/30" onClick={close} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-white">{sidebar}</div>
        </div>
      ) : null}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur sm:px-6">
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
        <main id="contenu" className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
