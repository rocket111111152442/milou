"use client";
import { useEffect, useRef, useState } from "react";
import { brand } from "@/data/site";
import { CloseIcon, InstagramIcon, MenuIcon } from "./Icons";
import Logo from "./Logo";

const links = [
  { href: "#menu", label: "Menu" },
  { href: "#locations", label: "Locations" },
  { href: "#instagram", label: "Instagram" },
  { href: "#contact", label: "Contact" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open ? "bg-char/95 shadow-[0_8px_30px_rgba(0,0,0,.25)] backdrop-blur-md" : "bg-gradient-to-b from-char/70 to-transparent"
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-mango focus:px-4 focus:py-2 focus:font-bold focus:text-char">
        Skip to content
      </a>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <a href="#top" className="shrink-0" aria-label={`${brand.name} — back to top`} onClick={close}>
          <Logo />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-full px-4 py-2 text-[15px] font-bold text-cream/90 transition hover:bg-cream/10 hover:text-mango">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href={brand.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-11 w-11 items-center justify-center rounded-full text-cream transition hover:bg-cream/10 hover:text-mango md:inline-flex"
            aria-label={`${brand.instagramHandle} on Instagram (opens in a new tab)`}
          >
            <InstagramIcon />
          </a>
          <a href="#locations" onClick={close} className="btn btn-mango !min-h-[44px] whitespace-nowrap !px-4 !py-2.5 text-sm sm:text-[15px]">
            <span className="md:hidden">Choose a branch</span>
            <span className="hidden md:inline">Find your branch</span>
          </a>
          <button
            ref={toggleRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-cream transition hover:bg-cream/10 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        hidden={!open}
        className="grain grain-light h-[calc(100dvh-4rem)] overflow-y-auto border-t border-cream/10 bg-char px-4 pb-10 pt-6 md:hidden"
      >
        <ul className="relative z-10 space-y-1">
          {links.map((l, i) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={close}
                className="display flex items-center justify-between border-b border-cream/10 py-4 text-5xl text-cream transition hover:text-mango"
              >
                {l.label}
                <span className="font-sans text-sm font-bold text-cream/40">0{i + 1}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="relative z-10 mt-8 grid gap-3">
          <a href="#liwa" onClick={close} className="btn btn-mango w-full">Liwa — Beachfront</a>
          <a href="#sbma" onClick={close} className="btn btn-chili w-full">SBMA — Late Night</a>
          <a href={brand.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-light w-full">
            <InstagramIcon /> {brand.instagramHandle}
          </a>
        </div>
      </div>
    </header>
  );
}
