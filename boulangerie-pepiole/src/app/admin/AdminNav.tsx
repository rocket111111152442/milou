"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";
import { Monogram } from "@/components/ui/Logo";
import { logout } from "./actions";

const TABS = [
  { href: "/admin", label: "Commandes" },
  { href: "/admin/carte", label: "Carte & prix" },
  { href: "/admin/reglages", label: "Réglages" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-mie bg-farine/90 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link href="/admin" className="flex items-center gap-2.5">
          <Monogram className="h-10 w-10 text-croute" />
          <span className="leading-none">
            <span className="block font-script text-lg text-caramel">Espace boutiques</span>
            <span className="block font-display text-lg">Le Pétrin de Pépiole</span>
          </span>
        </Link>
        <LayoutGroup id="admin-nav">
          <nav className="order-3 flex w-full gap-1 overflow-x-auto rounded-full bg-creme p-1 ring-1 ring-mie sm:order-none sm:w-auto" aria-label="Espace boutiques">
            {TABS.map((t) => {
              const on = t.href === pathname;
              return (
                <Link key={t.href} href={t.href} className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${on ? "text-creme" : "text-cafe/70 hover:text-cafe"}`}>
                  {on && <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-full bg-cafe" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <span className="relative">{t.label}</span>
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
        <div className="flex items-center gap-2">
          <Link href="/" className="hidden text-sm font-semibold text-grege hover:text-cafe sm:inline">
            Voir le site
          </Link>
          <form action={logout}>
            <button type="submit" className="h-10 rounded-full border border-mie bg-creme px-4 text-sm font-semibold transition hover:bg-mie">
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
