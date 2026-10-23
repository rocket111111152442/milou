"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { useScrollLock } from "@/components/motion/SmoothScroll";
import { SmartImage } from "./SmartImage";
import { FacebookIcon, InstagramIcon } from "./Social";

export interface MenuData {
  links: { href: string; label: string; image: string }[];
  categories: { href: string; label: string }[];
  phone: string;
  address: string;
  instagram: string;
  facebook: string;
  hoursLine: string;
}

const EASE = [0.76, 0, 0.24, 1] as const;

export function MenuOverlay({ open, data, onClose }: { open: boolean; data: MenuData; onClose: () => void }) {
  const [hover, setHover] = useState(0);
  useScrollLock(open);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[55] overflow-hidden"
          initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
          animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
          transition={{ duration: 0.9, ease: EASE }}
          role="dialog"
          aria-modal
          aria-label="Menu"
          data-lenis-prevent
        >
          <div className="fern-night absolute inset-0 bg-aubergine-950" />
          <div className="relative mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-10 overflow-y-auto px-6 pb-10 pt-28 sm:px-10 lg:grid-cols-[1.25fr_1fr] lg:px-16 lg:pt-32">
            <nav aria-label="Menu principal" className="flex flex-col justify-center">
              <ul>
                {data.links.map((l, i) => (
                  <li key={l.href} className="overflow-hidden border-b border-ivory/[0.07]">
                    <motion.div
                      initial={{ y: "110%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "110%" }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.25 + i * 0.06 }}
                    >
                      <Link
                        href={l.href}
                        onClick={onClose}
                        onPointerEnter={() => setHover(i)}
                        onFocus={() => setHover(i)}
                        className="group flex items-baseline gap-5 py-3 sm:py-4"
                      >
                        <span className="w-8 font-caps text-[0.6rem] tracking-[0.2em] text-gold/80">{String(i + 1).padStart(2, "0")}</span>
                        <span className="font-display text-[clamp(2.2rem,6vw,4.8rem)] font-light leading-none text-ivory transition duration-500 group-hover:translate-x-3 group-hover:italic group-hover:text-gold-light">
                          {l.label}
                        </span>
                      </Link>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </nav>

            <motion.div
              className="hidden flex-col justify-center gap-8 lg:flex"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative aspect-[4/5] w-full max-w-md overflow-hidden rounded-t-full border border-gold/30">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={hover}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 1.12 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <SmartImage src={data.links[hover]?.image || data.links[0].image} alt="" fill sizes="450px" className="object-cover" />
                  </motion.div>
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-aubergine-950/70 via-transparent to-transparent" />
              </div>
              <div className="grid max-w-md grid-cols-2 gap-6 text-sm text-ivory/70">
                <div>
                  <p className="eyebrow mb-3 text-gold/80">Boutique</p>
                  <ul className="space-y-1.5">
                    {data.categories.map((c) => (
                      <li key={c.href}>
                        <Link href={c.href} onClick={onClose} className="link-line hover:text-ivory">
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow mb-3 text-gold/80">Nous trouver</p>
                  <p>{data.address}</p>
                  <a href={`tel:${data.phone.replace(/\s/g, "")}`} className="mt-2 block text-ivory">
                    {data.phone}
                  </a>
                  <p className="mt-2 text-xs text-ivory/50">{data.hoursLine}</p>
                  <div className="mt-4 flex gap-3">
                    <a href={data.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="rounded-full border border-ivory/15 p-2 transition hover:border-gold hover:text-gold">
                      <InstagramIcon className="h-4 w-4" />
                    </a>
                    <a href={data.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="rounded-full border border-ivory/15 p-2 transition hover:border-gold hover:text-gold">
                      <FacebookIcon className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
