"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

const EASE = [0.22, 1, 0.36, 1] as const;
const WORD = "Empreinte de Violettes";

/**
 * L'étiquette noire de la carte de visite : « Maison / Empreinte de Violettes / Artisane fleuriste »
 * en dorure. `play` déclenche l'impression (utilisée par l'intro), `sheen` fait passer un reflet sur la dorure.
 */
export function Label({
  size = "lg",
  play = true,
  instant = false,
  delay = 0,
  sheen = false,
  as = "p",
  className,
  onDone,
}: {
  size?: "lg" | "md" | "sm";
  play?: boolean;
  instant?: boolean;
  delay?: number;
  sheen?: boolean;
  as?: "h1" | "p";
  className?: string;
  onDone?: () => void;
}) {
  const t = (d: number) => (instant ? 0 : d + delay);
  const d = (d: number) => (instant ? 0 : d);
  const pad = size === "lg" ? "px-[clamp(1.5rem,4.4vw,4.2rem)] py-[clamp(1.4rem,3.6vw,3.2rem)]" : size === "md" ? "px-10 py-8" : "px-6 py-5";
  const big = size === "lg" ? "text-[clamp(1.12rem,3.3vw,2.85rem)]" : size === "md" ? "text-[1.45rem]" : "text-[0.95rem]";
  const Name = as === "h1" ? motion.h1 : motion.p;
  const words = WORD.split(" ");
  let index = 0;
  return (
    <motion.div
      className={cn("label-card relative inline-flex flex-col items-center overflow-hidden text-center", pad, className)}
      initial={instant ? false : { clipPath: "inset(49.6% 0% 49.6% 0%)", opacity: 0 }}
      animate={play ? { clipPath: "inset(0% 0% 0% 0%)", opacity: 1 } : undefined}
      transition={{ clipPath: { duration: d(1.1), ease: [0.77, 0, 0.18, 1], delay: t(0.25) }, opacity: { duration: d(0.3), delay: t(0) } }}
    >
      <motion.span
        className="foil font-display uppercase"
        style={{ fontSize: size === "lg" ? "clamp(0.6rem,1.2vw,0.95rem)" : "0.6rem", letterSpacing: "0.5em", marginRight: "-0.5em" }}
        initial={instant ? false : { opacity: 0, letterSpacing: "1.2em" }}
        animate={play ? { opacity: 1, letterSpacing: "0.5em" } : undefined}
        transition={{ duration: d(1.4), ease: EASE, delay: t(1.1) }}
      >
        Maison
      </motion.span>
      <Name className={cn("mt-[0.45em] font-display font-normal uppercase leading-[1.08] tracking-[0.16em]", big)} style={{ marginRight: "-0.16em" }} aria-label={WORD}>
        {words.map((w, wi) => (
          <span key={wi} aria-hidden className={cn("inline-block whitespace-nowrap", wi === 1 && "mx-[0.35em]")}>
            {w.split("").map((c, ci) => {
              const i = index++;
              const last = wi === words.length - 1 && ci === w.length - 1;
              return (
                <motion.span
                  key={ci}
                  className="foil inline-block"
                  initial={instant ? false : { opacity: 0, y: "0.35em", filter: "blur(4px)" }}
                  animate={play ? { opacity: 1, y: "0em", filter: "blur(0px)" } : undefined}
                  transition={{ duration: d(0.9), ease: EASE, delay: t(1.35 + i * 0.045) }}
                  onAnimationComplete={last ? onDone : undefined}
                >
                  {c}
                </motion.span>
              );
            })}
          </span>
        ))}
      </Name>
      <motion.span
        className="mt-[0.9em] block h-px w-14 bg-foil/70"
        initial={instant ? false : { scaleX: 0 }}
        animate={play ? { scaleX: 1 } : undefined}
        transition={{ duration: d(1), ease: EASE, delay: t(2.35) }}
      />
      <motion.span
        className="foil mt-[0.9em] font-display uppercase"
        style={{ fontSize: size === "lg" ? "clamp(0.52rem,0.95vw,0.78rem)" : "0.52rem", letterSpacing: "0.55em", marginRight: "-0.55em" }}
        initial={instant ? false : { opacity: 0 }}
        animate={play ? { opacity: 1 } : undefined}
        transition={{ duration: d(1.2), delay: t(2.55) }}
      >
        Artisane fleuriste
      </motion.span>
      {sheen && (
        // reflet : le mode « color-dodge » n'éclaire que la dorure, le noir reste noir
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 mix-blend-color-dodge"
          style={{ background: "linear-gradient(100deg, transparent 0%, rgba(255,236,190,0.0) 30%, rgba(255,236,190,0.75) 50%, rgba(255,236,190,0) 70%, transparent 100%)" }}
          initial={{ x: "0%" }}
          animate={play ? { x: "400%" } : undefined}
          transition={{ duration: 1.5, ease: [0.65, 0, 0.35, 1], delay: t(3.05) }}
        />
      )}
    </motion.div>
  );
}
