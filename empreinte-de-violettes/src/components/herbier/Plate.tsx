"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { PLATES, type PlateName } from "@/lib/plates";

/**
 * Gravure botanique (domaine public) pré-encrée en image (public/planches/tinted), avec bords fondus.
 * Une vraie image se déplace et s'anime sans recalcul de masque : bien plus léger pour le navigateur.
 * Révélation « l'encre monte » : l'image se découvre de bas en haut.
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
  tone,
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
  /** encre prune (défaut) ou crème pour les fonds sombres — déduite de `text-paper` dans className */
  tone?: "plum" | "paper";
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const meta = PLATES[name as PlateName] || { w: 820, h: 1040, title: "" };
  const t = tone || (/\btext-paper\b/.test(className || "") && (name === "fougere" || name === "graminee") ? "paper" : "plum");
  const show = reveal === "none" || reveal === "mount" || inView;
  return (
    <div ref={ref} className={cn(!/\b(absolute|fixed)\b/.test(className || "") && "relative", className)} style={fit === "ratio" ? { aspectRatio: `${meta.w} / ${meta.h}`, ...style } : style} role="img" aria-label={label || meta.title || "Gravure botanique"}>
      <motion.img
        src={`/planches/tinted/${name}-${t}.webp`}
        alt=""
        draggable={false}
        decoding="async"
        loading={reveal === "view" ? "lazy" : "eager"}
        className={cn("absolute inset-0 h-full w-full select-none", fit === "contain" ? "object-contain" : "object-fill")}
        style={{ transform: flip ? "scaleX(-1)" : undefined, opacity: reveal === "none" ? opacity : undefined }}
        initial={reveal === "none" ? false : { clipPath: "inset(100% 0% 0% 0%)", opacity: 0 }}
        animate={show ? { clipPath: "inset(0% 0% 0% 0%)", opacity } : undefined}
        transition={{ duration, delay, ease: [0.45, 0.05, 0.25, 1] }}
      />
    </div>
  );
}
