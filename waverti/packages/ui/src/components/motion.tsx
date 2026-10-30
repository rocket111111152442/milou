"use client";
import { MotionConfig } from "motion/react";
import * as React from "react";

/** Applique la préférence système prefers-reduced-motion à toutes les animations Motion. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/**
 * Apparition douce au défilement, sans masquer le contenu quand JavaScript est absent :
 * le masquage initial n'est appliqué que sous `html.js` (cf. styles.css + script de layout).
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-revealed", "");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-revealed", "");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -60px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return React.createElement(
    as,
    {
      ref,
      className,
      "data-reveal": "",
      style: delay ? ({ "--reveal-delay": `${delay}s` } as React.CSSProperties) : undefined,
    },
    children,
  );
}

/** Script à insérer dans <head> : marque le document comme « JS actif » avant le premier rendu. */
export const REVEAL_BOOT_SCRIPT = "document.documentElement.classList.add('js')";

export { motion, AnimatePresence, useReducedMotion, useInView } from "motion/react";
