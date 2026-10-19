"use client";

import Link, { useSitePath } from "@/components/TLink";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { useSiteData } from "@/components/SettingsProvider";
import { Logo } from "@/components/ui/Logo";
import { OpenStatus, OpenStatusCycle } from "@/components/ui/OpenStatus";
import { useHeaderState } from "@/lib/ui-store";

export function Header() {
  const pathname = useSitePath();
  const { shops: SHOPS } = useSiteData();
  const NAV = [
    { href: "/#maison", label: "La maison" },
    { href: "/#savoir-faire", label: "Savoir-faire" },
    { href: "/carte", label: "La carte" },
    { href: "/#boutiques", label: SHOPS.length > 1 ? "Nos boutiques" : "La boutique" },
  ];
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  // Sur l'accueil, le header est transparent au-dessus du hero sombre
  const overHero = pathname === "/" && !scrolled;

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 40);
    setHidden(y > 300 && y > prev && !menu);
  });

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => useHeaderState.getState().setHidden(hidden), [hidden]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        animate={{ y: hidden ? "-110%" : "0%" }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className={`mx-auto mt-3 flex max-w-7xl items-center justify-between gap-4 rounded-full px-4 py-2 transition-all duration-500 sm:px-6 ${
            overHero
              ? "bg-transparent"
              : "mx-3 bg-creme/85 shadow-[0_10px_30px_-18px_rgba(36,22,13,0.5)] ring-1 ring-mie/60 backdrop-blur-xl sm:mx-auto"
          }`}
        >
          <Logo light={overHero && !menu} />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
            {NAV.map((item) => {
              const active = item.href === pathname;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    overHero ? "text-creme/85 hover:text-creme" : "text-cafe/75 hover:text-cafe"
                  }`}
                >
                  {active && (
                    <motion.span layoutId="nav-pill" className={`absolute inset-0 -z-10 rounded-full ${overHero ? "bg-creme/15" : "bg-mie"}`} />
                  )}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden xl:block">
              <OpenStatusCycle tone={overHero ? "dark" : "light"} />
            </span>
            <Link
              href="/#boutiques"
              className={`hidden h-11 w-11 place-items-center rounded-full border transition sm:grid ${
                overHero ? "border-creme/25 text-creme hover:bg-creme/10" : "border-mie text-cafe hover:bg-mie"
              }`}
              aria-label="Nos boutiques : adresses, horaires et téléphones"
            >
              <PinIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/carte"
              className="hidden h-11 items-center rounded-full bg-croute px-5 text-sm font-semibold text-creme transition hover:bg-cafe sm:inline-flex"
            >
              Commander
            </Link>
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              className={`relative grid h-11 w-11 place-items-center rounded-full lg:hidden ${
                overHero && !menu ? "text-creme" : "text-cafe"
              }`}
              aria-expanded={menu}
              aria-controls="mobile-menu"
              aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"}
            >
              <motion.span className="absolute h-0.5 w-6 rounded bg-current" animate={menu ? { rotate: 45, y: 0 } : { rotate: 0, y: -5 }} />
              <motion.span className="absolute h-0.5 w-6 rounded bg-current" animate={menu ? { rotate: -45, y: 0 } : { rotate: 0, y: 5 }} />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menu && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 flex flex-col bg-farine px-6 pb-10 pt-28 lg:hidden"
            initial={{ clipPath: "circle(0% at calc(100% - 44px) 44px)" }}
            animate={{ clipPath: "circle(150% at calc(100% - 44px) 44px)" }}
            exit={{ clipPath: "circle(0% at calc(100% - 44px) 44px)" }}
            transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
          >
            <nav className="flex flex-col gap-2" aria-label="Navigation mobile">
              {[{ href: "/", label: "Accueil" }, ...NAV, { href: "/commande", label: "Ma commande" }].map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                >
                  <Link href={item.href} onClick={() => setMenu(false)} className="block font-display text-4xl tracking-tight text-cafe">
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <motion.div className="mt-auto grid gap-5 sm:grid-cols-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              {SHOPS.map((shop) => (
                <div key={shop.id} className="flex flex-col gap-1.5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-grege">
                    {shop.name} · {shop.short}
                  </p>
                  <OpenStatus shop={shop} className="self-start" />
                  <a href={shop.phone.href} className="font-display text-2xl text-croute">
                    {shop.phone.display}
                  </a>
                  <p className="text-sm text-grege">
                    {shop.address.street}, {shop.address.postalCode} {shop.address.city}
                  </p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function PhoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}
