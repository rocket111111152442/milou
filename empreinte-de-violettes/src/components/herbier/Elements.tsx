"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { SmartImage } from "@/components/site/SmartImage";

export const EASE = [0.22, 1, 0.36, 1] as const;

export { roman } from "@/lib/roman";

/** Titre courant de page de livre. */
export function RunningHead({ left, right, className }: { left: string; right?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="sc whitespace-nowrap">{left}</span>
      <span className="rule flex-1" />
      {right && <span className="folio whitespace-nowrap">{right}</span>}
    </div>
  );
}

/** Ligne de sommaire avec points de conduite. */
export function Leader({ left, right, className }: { left: React.ReactNode; right: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline", className)}>
      <span className="min-w-0">{left}</span>
      <span className="leader" />
      <span className="shrink-0 tabular-nums">{right}</span>
    </div>
  );
}

/** Photo montée sur coins d'album, avec légende. */
export function Mounted({
  src,
  alt,
  caption,
  className,
  ratio = "4/5",
  sizes = "50vw",
  priority,
  reveal = true,
  dark = false,
}: {
  src: string;
  alt: string;
  caption?: React.ReactNode;
  className?: string;
  ratio?: string;
  sizes?: string;
  priority?: boolean;
  reveal?: boolean;
  dark?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const on = !reveal || inView;
  return (
    <figure ref={ref} className={cn("group", className)}>
      <div className={cn("mount p-[6px]", dark ? "bg-plum-deep" : "bg-paper-light shadow-[0_1px_2px_rgba(27,19,32,0.12),0_18px_40px_-24px_rgba(27,19,32,0.45)]")}>
        <span className="c tl" />
        <span className="c tr" />
        <span className="c bl" />
        <span className="c br" />
        <div className="relative overflow-hidden bg-paper-deep" style={{ aspectRatio: ratio }}>
          <motion.div
            className="absolute inset-0"
            initial={reveal ? { opacity: 0, scale: 1.08, filter: "blur(6px)" } : false}
            animate={on ? { opacity: 1, scale: 1, filter: "blur(0px)" } : undefined}
            transition={{ duration: 1.6, ease: EASE }}
          >
            <SmartImage src={src} alt={alt} fill sizes={sizes} priority={priority} className="tirage object-cover transition duration-[1.6s] ease-silk group-hover:scale-[1.03]" />
          </motion.div>
        </div>
      </div>
      {caption && <figcaption className={cn("folio mt-3", dark ? "text-paper/60" : "text-ink-muted")}>{caption}</figcaption>}
    </figure>
  );
}

/** Texte révélé ligne à ligne (par mots, derrière un masque). */
export function Words({ text, className, delay = 0, stagger = 0.035, play = true }: { text: string; className?: string; delay?: number; stagger?: number; play?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const show = play && inView;
  return (
    <span ref={ref} className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i}>
          {i > 0 && " "}
          <span aria-hidden className="-mb-[0.12em] -mr-[0.06em] inline-block overflow-hidden pb-[0.12em] pr-[0.06em] align-bottom">
            <motion.span className="inline-block" initial={{ y: "105%" }} animate={show ? { y: "0%" } : { y: "105%" }} transition={{ duration: 1.1, ease: EASE, delay: delay + i * stagger }}>
              {w}
            </motion.span>
          </span>
        </span>
      ))}
    </span>
  );
}

/** Apparition douce. */
export function Fade({ children, className, delay = 0, y = 16 }: { children: React.ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 1.2, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}

/** Filet qui se trace. */
export function DrawRule({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.span
      className={cn("block h-px origin-left bg-current opacity-25", className)}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.6, ease: EASE, delay }}
    />
  );
}

/** Ellipse tracée à la main (pour entourer un mot). */
export function HandCircle({ className, play = true, delay = 0.3 }: { className?: string; play?: boolean; delay?: number }) {
  return (
    <svg viewBox="0 0 200 80" preserveAspectRatio="none" className={cn("pointer-events-none absolute", className)} aria-hidden>
      <motion.path
        d="M18,44 C20,18 78,6 122,10 C170,14 196,30 188,50 C180,70 120,76 76,72 C34,68 8,58 14,40 C18,28 40,20 58,17"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={play ? { pathLength: 1 } : undefined}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1], delay }}
      />
    </svg>
  );
}
