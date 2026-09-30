"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import Logo from "./Logo";

const LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/clubs", label: "Les clubs" },
  { href: "/planning", label: "Planning" },
  { href: "/galerie", label: "Galerie" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 40));

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between px-4 transition-all duration-500 sm:px-6 ${
          scrolled ? "mt-3 rounded-full border border-line bg-ink/80 py-2.5 backdrop-blur-xl sm:mx-4 xl:mx-auto" : "py-5"
        }`}
      >
        <Link href="/" aria-label="Biorythme, accueil" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "text-ink" : "text-bone/80 hover:text-bone"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-volt"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/planning"
            className="group hidden items-center gap-2 rounded-full bg-bone px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-volt sm:inline-flex"
          >
            Réserver un cours
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <button
            className="grid h-11 w-11 place-items-center rounded-full border border-line md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
          >
            <span className="relative block h-3 w-5">
              <span className={`absolute left-0 h-0.5 w-5 bg-bone transition-all ${open ? "top-1.5 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 h-0.5 w-5 bg-bone transition-all ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 -z-10 flex flex-col justify-center bg-ink px-6 md:hidden"
          >
            {LINKS.map((l, i) => (
              <motion.div
                key={l.href}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
              >
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="font-display block py-2 text-6xl hover:text-volt"
                >
                  {l.label}
                </Link>
              </motion.div>
            ))}
            <Link
              href="/planning"
              onClick={() => setOpen(false)}
              className="mt-8 inline-flex w-fit rounded-full bg-volt px-6 py-3 font-semibold text-ink"
            >
              Réserver un cours →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
