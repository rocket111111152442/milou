"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { cartCount, useCart } from "@/store/cart";
import { useUI } from "@/store/ui";
import { Logo } from "./Logo";
import { MenuOverlay, type MenuData } from "./MenuOverlay";

const NAV = [
  { href: "/boutique", label: "Boutique" },
  { href: "/atelier", label: "Atelier" },
  { href: "/mariage", label: "Mariage" },
  { href: "/deuil", label: "Deuil" },
];

export function Header({ menu, hasAnnouncement }: { menu: MenuData; hasAnnouncement: boolean }) {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lines = useCart((s) => s.lines);
  const bump = useCart((s) => s.bump);
  const setOpen = useCart((s) => s.setOpen);
  const menuOpen = useUI((s) => s.menuOpen);
  const setMenuOpen = useUI((s) => s.setMenuOpen);
  const introDone = useUI((s) => s.introDone);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setMenuOpen(false), [pathname, setMenuOpen]);

  const pinnedUntil = useRef(0);
  // après un ajout au panier, l'en-tête reste visible quelques secondes
  useEffect(() => {
    if (!bump) return;
    pinnedUntil.current = Date.now() + 2500;
    setHidden(false);
  }, [bump]);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 40);
    if (Date.now() < pinnedUntil.current || Math.abs(y - prev) < 3) return;
    setHidden(y > 320 && y > prev && !menuOpen);
  });

  const count = mounted ? cartCount(lines) : 0;

  return (
    <>
      <motion.header
        className={cn(
          "fixed inset-x-0 z-[60] transition-[background-color,border-color,backdrop-filter,top] duration-500",
          hasAnnouncement && !scrolled ? "top-9" : "top-0",
          scrolled && !menuOpen ? "border-b border-ivory/[0.06] bg-noir/75 backdrop-blur-xl" : "border-b border-transparent",
        )}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: hidden ? "-110%" : 0, opacity: introDone ? 1 : 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: hidden ? 0 : 0.2 }}
      >
        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between gap-6 px-5 sm:px-8 lg:h-[88px] lg:px-12">
          <nav className="hidden flex-1 items-center gap-8 lg:flex" aria-label="Navigation principale">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={pathname.startsWith(n.href) ? "page" : undefined}
                className="link-line font-caps text-[0.66rem] uppercase tracking-[0.26em] text-ivory/85 transition hover:text-ivory"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <Link href="/" aria-label="Accueil — Empreinte de Violettes" className="text-ivory lg:flex-none">
            <Logo />
          </Link>

          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-5">
            <Link href="/contact" className="link-line hidden font-caps text-[0.66rem] uppercase tracking-[0.26em] text-ivory/85 xl:inline-block">
              Contact
            </Link>
            <button
              onClick={() => setOpen(true)}
              className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-ivory/15 text-ivory transition hover:border-gold/60"
              aria-label={`Ouvrir le panier (${count} article${count > 1 ? "s" : ""})`}
              data-cart-target
            >
              <motion.span key={bump} initial={{ rotate: 0 }} animate={bump ? { rotate: [0, -14, 12, -6, 0], scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.7 }}>
                <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.4} />
              </motion.span>
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0, y: 6 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0 }}
                    className="bg-foil absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.62rem] font-semibold text-noir"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="group flex h-11 items-center gap-3 rounded-full pl-2 text-ivory"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              <span className="hidden font-caps text-[0.62rem] uppercase tracking-[0.3em] sm:inline">{menuOpen ? "Fermer" : "Menu"}</span>
              <span className="relative block h-3 w-7">
                <motion.span
                  className="absolute left-0 top-0 block h-px w-full bg-current"
                  animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
                <motion.span
                  className="absolute bottom-0 right-0 block h-px bg-current"
                  animate={menuOpen ? { rotate: -45, y: -5.5, width: "100%" } : { rotate: 0, y: 0, width: "65%" }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            </button>
          </div>
        </div>
      </motion.header>
      <MenuOverlay open={menuOpen} data={menu} onClose={() => setMenuOpen(false)} />
    </>
  );
}
