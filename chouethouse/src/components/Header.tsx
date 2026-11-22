"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { NAV, SITE } from "@/lib/site";

export function Header() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 30);
    setHidden(y > 400 && y > prev && !open);
  });

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <motion.header
        animate={{ y: hidden ? -120 : 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5"
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full px-4 py-2 transition-all duration-500 sm:px-6 ${
            scrolled ? "bg-white/85 shadow-[0_10px_40px_-20px_rgba(43,42,54,0.45)] ring-1 ring-ink/5 backdrop-blur-xl" : "bg-transparent"
          }`}
        >
          <Link href="/" className="relative z-10 shrink-0" aria-label="Chouet'House – accueil">
            <Image src="/images/logo-horizontal.webp" alt="Chouet'House" width={220} height={50} priority className="h-9 w-auto sm:h-11" />
          </Link>

          <nav aria-label="Navigation principale" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.slice(1).map((item) => (
                <li key={item.href} className="relative">
                  <Link
                    href={item.href}
                    className={`relative z-10 block rounded-full px-4 py-2 font-display text-[1.05rem] font-medium transition-colors ${
                      isActive(item.href) ? "text-white" : "text-ink hover:text-tomato"
                    }`}
                  >
                    {item.label}
                  </Link>
                  {isActive(item.href) && (
                    <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-sage-deep" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/ateliers-enfants#planning" className="hidden rounded-full bg-tomato px-5 py-2.5 font-display font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#cc463c] sm:inline-flex">
              Planning
            </Link>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              className="relative z-[70] grid h-12 w-12 place-items-center rounded-full bg-ink text-white lg:hidden"
            >
              <span className="relative block h-4 w-6">
                <motion.span animate={open ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }} className="absolute top-0 left-0 h-0.5 w-6 rounded bg-current" />
                <motion.span animate={{ opacity: open ? 0 : 1 }} className="absolute top-[7px] left-0 h-0.5 w-6 rounded bg-current" />
                <motion.span animate={open ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }} className="absolute top-[14px] left-0 h-0.5 w-6 rounded bg-current" />
              </span>
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ clipPath: "circle(0% at calc(100% - 44px) 40px)" }}
            animate={{ clipPath: "circle(150% at calc(100% - 44px) 40px)" }}
            exit={{ clipPath: "circle(0% at calc(100% - 44px) 40px)" }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-[65] flex flex-col overflow-y-auto bg-sage-deep px-6 pt-28 pb-10 text-white lg:hidden"
          >
            <nav aria-label="Navigation mobile">
              <ul className="space-y-1">
                {NAV.map((item, i) => (
                  <motion.li key={item.href} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                    <Link href={item.href} className={`block py-2 font-display text-4xl font-semibold ${isActive(item.href) ? "text-mustard" : "text-white"}`}>
                      {item.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </nav>
            <div className="mt-auto space-y-2 pt-10 text-white/85">
              <a href={`tel:${SITE.phoneHref}`} className="block text-2xl font-bold text-white">
                {SITE.phone}
              </a>
              <p>{SITE.hours}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
