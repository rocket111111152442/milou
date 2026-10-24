"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { PLATES, type PlateName } from "@/lib/plates";

/**
 * Gravure botanique (domaine public) rendue comme une encre : l'image sert de masque,
 * la couleur vient du texte courant. Révélation « l'encre monte » au défilement.
 */
export function Plate({
  name,
  className,
  reveal = "view",
  delay = 0,
  duration = 2.2,
  opacity = 1,
  flip = false,
  label,
  fit = "ratio",
  style,
}: {
  name: PlateName | string;
  className?: string;
  reveal?: "view" | "mount" | "none";
  delay?: number;
  duration?: number;
  opacity?: number;
  flip?: boolean;
  label?: string;
  /** « ratio » : la boîte prend les proportions de la gravure ; « contain » : la gravure tient dans la boîte fournie */
  fit?: "ratio" | "contain";
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const meta = PLATES[name as PlateName] || { w: 820, h: 1040, title: "" };
  const url = `url(/planches/${name}.webp)`;
  const show = reveal === "none" || reveal === "mount" || inView;
  // gravure × encre qui monte × fondu des bords (les planches scannées ont des bords francs)
  const mask = `${url}, linear-gradient(to top, #000 0%, #000 var(--ink), transparent calc(var(--ink) + 22%)), linear-gradient(to right, transparent 0%, #000 7%, #000 93%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 6%, #000 92%, transparent 100%)`;
  const size = fit === "contain" ? "contain, 100% 100%, 100% 100%, 100% 100%" : "100% 100%, 100% 100%, 100% 100%, 100% 100%";
  return (
    <div ref={ref} className={cn(!/\b(absolute|fixed)\b/.test(className || "") && "relative", className)} style={fit === "ratio" ? { aspectRatio: `${meta.w} / ${meta.h}`, ...style } : style} role="img" aria-label={label || meta.title || "Gravure botanique"}>
      <motion.div
        className="absolute inset-0"
        initial={reveal === "none" ? false : ({ "--ink": "-25%", opacity: 0 } as never)}
        animate={show ? ({ "--ink": "110%", opacity } as never) : undefined}
        transition={{ duration, delay, ease: [0.45, 0.05, 0.25, 1] }}
        style={
          {
            "--ink": reveal === "none" ? "110%" : undefined,
            backgroundColor: "currentColor",
            opacity: reveal === "none" ? opacity : undefined,
            WebkitMaskImage: mask,
            maskImage: mask,
            WebkitMaskSize: size,
            maskSize: size,
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskComposite: "source-in, source-in, source-in, source-in",
            maskComposite: "intersect, intersect, intersect, intersect",
            transform: flip ? "scaleX(-1)" : undefined,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
