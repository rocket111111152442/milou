"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ExternalLink,
  Flower2,
  Gift,
  HelpCircle,
  Images,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  Package,
  Percent,
  Settings,
  Sparkles,
  Star,
  Tag,
  Tags,
  Truck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { VioletMark } from "@/components/site/Logo";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: typeof Package; badge?: number };

export function AdminShell({
  children,
  counts,
  warnings,
}: {
  children: React.ReactNode;
  counts: { orders: number; messages: number };
  warnings: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: "Pilotage",
      items: [
        { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
        { href: "/admin/commandes", label: "Commandes", icon: Package, badge: counts.orders },
        { href: "/admin/planning", label: "Planning", icon: CalendarDays },
        { href: "/admin/clients", label: "Clients", icon: Users },
      ],
    },
    {
      title: "Catalogue",
      items: [
        { href: "/admin/produits", label: "Produits", icon: Flower2 },
        { href: "/admin/categories", label: "Catégories", icon: Tags },
        { href: "/admin/occasions", label: "Occasions", icon: Tag },
        { href: "/admin/options", label: "Options & cadeaux", icon: Gift },
        { href: "/admin/atelier", label: "Atelier", icon: Sparkles },
      ],
    },
    {
      title: "Ventes",
      items: [
        { href: "/admin/livraison", label: "Livraison & créneaux", icon: Truck },
        { href: "/admin/promos", label: "Codes promo", icon: Percent },
      ],
    },
    {
      title: "Contenu",
      items: [
        { href: "/admin/contenu", label: "Pages & textes", icon: BookOpen },
        { href: "/admin/avis", label: "Avis clients", icon: Star },
        { href: "/admin/faq", label: "FAQ", icon: HelpCircle },
        { href: "/admin/galerie", label: "Galerie", icon: Images },
      ],
    },
    {
      title: "Relation",
      items: [
        { href: "/admin/messages", label: "Messages", icon: Inbox, badge: counts.messages },
        { href: "/admin/newsletter", label: "Newsletter", icon: Newspaper },
      ],
    },
    { title: "Système", items: [{ href: "/admin/parametres", label: "Paramètres", icon: Settings }] },
  ];

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-3 px-6 pb-6 pt-7">
        <VioletMark className="h-9 w-9 text-gold" />
        <span className="leading-none">
          <span className="block font-caps text-[0.5rem] uppercase tracking-[0.45em] text-gold/80">Espace fleuriste</span>
          <span className="mt-1 block font-caps text-[0.78rem] uppercase tracking-[0.14em] text-ivory">Empreinte de Violettes</span>
        </span>
      </Link>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6" data-lenis-prevent>
        {groups.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-2 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ivory/35">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = isActive(it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={() => setOpen(false)}
                      className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition", active ? "text-white" : "text-ivory/65 hover:bg-white/[0.04] hover:text-ivory")}
                    >
                      {active && <motion.span layoutId="adm-nav" className="absolute inset-0 rounded-xl bg-gradient-to-r from-aubergine-600 to-aubergine-700 shadow-lg shadow-black/20" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                      <it.icon className={cn("relative h-4 w-4", active ? "text-gold-light" : "")} strokeWidth={1.6} />
                      <span className="relative flex-1">{it.label}</span>
                      {!!it.badge && <span className="relative rounded-full bg-gold px-1.5 py-0.5 text-[0.62rem] font-semibold text-noir">{it.badge}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-white/[0.06] p-3">
        <a href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ivory/65 hover:bg-white/[0.04] hover:text-ivory">
          <ExternalLink className="h-4 w-4" strokeWidth={1.6} /> Voir le site
        </a>
        <button
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            window.location.href = "/admin/login";
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ivory/65 hover:bg-white/[0.04] hover:text-ivory"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.6} /> Déconnexion
        </button>
      </div>
    </nav>
  );

  return (
    <div className="lg:pl-[260px]">
      <aside className="fern-night fixed inset-y-0 left-0 z-40 hidden w-[260px] bg-aubergine-950 lg:block">{nav}</aside>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.button aria-label="Fermer" className="absolute inset-0 bg-noir/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="fern-night absolute inset-y-0 left-0 w-[270px] bg-aubergine-950" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}>
              <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-ivory/60" aria-label="Fermer le menu">
                <X className="h-4 w-4" />
              </button>
              {nav}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-noir/[0.06] bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-noir/5" aria-label="Ouvrir le menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-caps text-xs uppercase tracking-[0.16em]">Empreinte de Violettes</span>
      </header>
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 lg:py-10">
        {warnings.length > 0 && (
          <div className="mb-6 space-y-2">
            {warnings.map((w) => (
              <div key={w} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{w}</span>
              </div>
            ))}
          </div>
        )}
        <motion.div key={pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
