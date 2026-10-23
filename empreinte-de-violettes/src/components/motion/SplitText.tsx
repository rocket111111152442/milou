"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/cn";

type Props = {
  text: string;
  className?: string;
  wordClassName?: string;
  innerClassName?: string;
  by?: "word" | "char";
  delay?: number;
  stagger?: number;
  duration?: number;
  play?: boolean; // si false, attend (ex. fin de l'intro)
  once?: boolean;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
};

/** Texte dévoilé mot par mot (ou lettre par lettre) derrière un masque. */
export function SplitText({
  text,
  className,
  wordClassName,
  innerClassName,
  by = "word",
  delay = 0,
  stagger,
  duration = 1.05,
  play = true,
  once = true,
  as = "span",
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once, amount: 0.3 });
  const show = play && inView;
  const words = text.split(" ");
  const step = stagger ?? (by === "char" ? 0.028 : 0.07);
  let i = 0;
  const Tag = as as "span";
  return (
    <Tag ref={ref as React.RefObject<HTMLSpanElement>} className={className} aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi} aria-hidden className={cn("inline-block overflow-hidden pb-[0.14em] -mb-[0.14em] align-bottom", wordClassName)}>
          {by === "word" ? (
            <motion.span
              className={cn("inline-block will-change-transform", innerClassName)}
              initial={{ y: "115%", rotate: 4 }}
              animate={show ? { y: "0%", rotate: 0 } : { y: "115%", rotate: 4 }}
              transition={{ duration, ease: [0.22, 1, 0.36, 1], delay: delay + i++ * step }}
            >
              {w}
            </motion.span>
          ) : (
            w.split("").map((c, ci) => (
              <motion.span
                key={ci}
                className={cn("inline-block will-change-transform", innerClassName)}
                initial={{ y: "115%" }}
                animate={show ? { y: "0%" } : { y: "115%" }}
                transition={{ duration, ease: [0.22, 1, 0.36, 1], delay: delay + i++ * step }}
              >
                {c}
              </motion.span>
            ))
          )}
          {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </Tag>
  );
}
