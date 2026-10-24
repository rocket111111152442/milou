"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/components/motion/SmoothScroll";
import { cn } from "@/lib/cn";
import type { PlateName } from "@/lib/plates";
import { cartCount, useCart } from "@/store/cart";
import { useUI } from "@/store/ui";
import { EASE, roman } from "./Elements";
import { Plate } from "./Plate";

export type MenuData = {
  links: { href: string; label: string; note: string; plate: PlateName }[];
  categories: { href: string; label: string }[];
  phone: string;
  address: string;
  hoursLine: string;
  instagram: string;
  facebook: string;
  announcement: { text: string; link: string } | null;
};

const NAV = [
  { href: "/boutique", label: "Boutique" },
  { href: "/atelier", label: "Atelier" },
  { href: "/mariage", label: "Mariages" },
];

export function Masthead({ menu }: { menu: MenuData }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const introDone = useUI((s) => s.introDone);
  const menuOpen = useUI((s) => s.menuOpen);
  const setMenuOpen = useUI((s) => s.setMenuOpen);
  const lines = useCart((s) => s.lines);
  const bump = useCart((s) => s.bump);
  const setBagOpen = useCart((s) => s.setOpen);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMenuOpen(false), [pathname, setMenuOpen]);
  // un ajout au panier fait réapparaître l'en-tête, pour que le compteur se voie
  useEffect(() => {
    if (bump) setHidden(false);
  }, [bump]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      if (y > 320 && y > last.current + 6) setHidden(true);
      else if (y < last.current - 6 || y < 320) setHidden(false);
      last.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const veiled = isHome && !introDone;
  const count = mounted ? cartCount(lines) : 0;
  const ann = menu.announcement;

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        initial={false}
        animate={{ y: hidden && !menuOpen ? "-100%" : "0%", opacity: veiled ? 0 : 1 }}
        transition={{ y: { duration: 0.55, ease: EASE }, opacity: { duration: 1.1, ease: EASE } }}
        style={{ pointerEvents: veiled ? "none" : undefined }}
      >
        {ann && !scrolled && !menuOpen && (
          <Link href={ann.link || "/boutique"} className="group block border-b border-ink/10 bg-paper-deep/80 py-2 text-center font-text text-[0.82rem] italic text-ink-soft">
            <span className="wrap block truncate">
              {ann.text} <span className="not-italic text-ink-muted transition group-hover:text-ink">→</span>
            </span>
          </Link>
        )}
        <div className={cn("transition-[background-color,box-shadow,backdrop-filter] duration-500", scrolled || menuOpen ? "bg-paper/90 shadow-[0_1px_0_rgba(27,19,32,0.1)] backdrop-blur-md" : isHome ? "bg-gradient-to-b from-paper via-paper/80 to-transparent" : "bg-transparent")}>
          <div className="wrap grid h-[64px] grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex items-center">
              <button onClick={() => setMenuOpen(!menuOpen)} className="group flex items-center gap-3" aria-expanded={menuOpen} aria-controls="sommaire">
                <span className="relative block h-[9px] w-6" aria-hidden>
                  <span className={cn("absolute left-0 top-0 h-px w-full bg-ink transition duration-500 ease-silk", menuOpen && "top-1 rotate-[20deg]")} />
                  <span className={cn("absolute bottom-0 left-0 h-px bg-ink transition-all duration-500 ease-silk", menuOpen ? "bottom-1 w-full -rotate-[20deg]" : "w-4 group-hover:w-full")} />
                </span>
                <span className="sc">{menuOpen ? "Fermer" : "Sommaire"}</span>
              </button>
            </div>

            <Link href="/" className="group flex flex-col items-center text-center" aria-label="Empreinte de Violettes — accueil">
              <motion.span
                className="hidden whitespace-nowrap font-display text-[0.9rem] uppercase tracking-[0.22em] sm:inline"
                initial={false}
                animate={{ opacity: isHome && !scrolled && !menuOpen ? 0 : 1, y: isHome && !scrolled && !menuOpen ? 6 : 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                style={{ marginRight: "-0.22em" }}
              >
                Empreinte de Violettes
              </motion.span>
            </Link>

            <div className="flex items-center justify-end gap-6">
              <nav className="hidden items-center gap-6 xl:flex" aria-label="Navigation principale">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="ulink font-text text-[0.95rem] text-ink-soft hover:text-ink" aria-current={pathname.startsWith(n.href) ? "page" : undefined}>
                    {n.label}
                  </Link>
                ))}
              </nav>
              <button onClick={() => setBagOpen(true)} className="sc flex items-baseline gap-1.5" aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}>
                Panier
                <span className="relative inline-flex min-w-[1.6em] justify-center overflow-hidden font-text text-[0.9rem] normal-case tracking-normal">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={`${count}-${bump}`} initial={{ y: "100%" }} animate={{ y: "0%" }} exit={{ y: "-100%" }} transition={{ duration: 0.5, ease: EASE }} className="num">
                      ({count})
                    </motion.span>
                  </AnimatePresence>
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      <Sommaire menu={menu} open={menuOpen} onClose={() => setMenuOpen(false)} pathname={pathname} />
    </>
  );
}

function Sommaire({ menu, open, onClose, pathname }: { menu: MenuData; open: boolean; onClose: () => void; pathname: string }) {
  const [hover, setHover] = useState(0);
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  const current = menu.links[hover] || menu.links[0];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="sommaire"
          className="h-paper-deep fixed inset-0 z-40 overflow-y-auto pt-[64px]"
          data-lenis-prevent
          initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
          animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
          transition={{ duration: 0.85, ease: [0.77, 0, 0.18, 1] }}
        >
          <div className="wrap grid min-h-[calc(100svh-64px)] gap-10 pb-10 pt-8 lg:grid-cols-[1.25fr_1fr] lg:gap-20 lg:pt-14">
            <div className="flex flex-col">
              <motion.p className="sc text-ink-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                Sommaire
              </motion.p>
              <ol className="mt-6 border-t border-ink/15" onMouseLeave={() => setHover(0)}>
                {menu.links.map((l, i) => (
                  <motion.li
                    key={l.href}
                    className="border-b border-ink/15"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.3 + i * 0.045 }}
                  >
                    <Link href={l.href} onClick={onClose} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} className="group flex items-baseline gap-4 py-3 sm:py-3.5">
                      <span className="w-8 shrink-0 font-text text-[0.8rem] italic text-ink-muted">{roman(i + 1)}.</span>
                      <span className={cn("font-display text-[clamp(1.6rem,3.6vw,2.7rem)] leading-none transition duration-500", (pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href))) && "italic")}>
                        <span className="inline-block transition-transform duration-500 ease-silk group-hover:translate-x-2 group-hover:italic">{l.label}</span>
                      </span>
                      <span className="leader hidden sm:block" />
                      <span className="hidden shrink-0 font-text text-[0.9rem] italic text-ink-muted sm:block">{l.note}</span>
                    </Link>
                  </motion.li>
                ))}
              </ol>
              <motion.div className="mt-8 flex flex-wrap gap-x-5 gap-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}>
                <span className="sc text-ink-muted">Rayons —</span>
                {menu.categories.map((c) => (
                  <Link key={c.href} href={c.href} onClick={onClose} className="ulink font-text text-[0.98rem] italic text-ink-soft">
                    {c.label}
                  </Link>
                ))}
              </motion.div>
            </div>

            <div className="relative hidden flex-col justify-between lg:flex">
              <div className="relative mx-auto mt-2 w-[min(100%,380px)] text-plum">
                <AnimatePresence mode="wait">
                  <motion.div key={current.plate} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
                    <Plate name={current.plate} reveal="mount" duration={1.1} />
                  </motion.div>
                </AnimatePresence>
              </div>
              <motion.div className="mt-10 grid grid-cols-2 gap-6 border-t border-ink/15 pt-6 font-text text-[0.95rem] text-ink-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                <div>
                  <p className="sc mb-2 text-ink-muted">La boutique</p>
                  <p>{menu.address}</p>
                  <p className="mt-1 italic">{menu.hoursLine}</p>
                </div>
                <div>
                  <p className="sc mb-2 text-ink-muted">Nous joindre</p>
                  <a href={`tel:${menu.phone.replace(/\s/g, "")}`} className="ulink tab">
                    {menu.phone}
                  </a>
                  <p className="mt-1 flex gap-4">
                    <a href={menu.instagram} target="_blank" rel="noreferrer" className="ulink italic">
                      Instagram
                    </a>
                    <a href={menu.facebook} target="_blank" rel="noreferrer" className="ulink italic">
                      Facebook
                    </a>
                  </p>
                </div>
              </motion.div>
            </div>

            <div className="font-text text-[0.95rem] text-ink-soft lg:hidden">
              <p>{menu.address}</p>
              <a href={`tel:${menu.phone.replace(/\s/g, "")}`} className="ulink-on tab mt-1 inline-block">
                {menu.phone}
              </a>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
