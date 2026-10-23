"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

type Variant = { type: "default" | "link" | "view" | "drag" | "text" | "hidden"; label?: string };

/** Curseur personnalisé : point + anneau, avec états « Voir », « Glisser », lien. */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [variant, setVariant] = useState<Variant>({ type: "hidden" });
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const dotX = useSpring(x, { stiffness: 900, damping: 50, mass: 0.3 });
  const dotY = useSpring(y, { stiffness: 900, damping: 50, mass: 0.3 });
  const ringX = useSpring(x, { stiffness: 220, damping: 24, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 220, damping: 24, mass: 0.6 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setEnabled(true);
    document.documentElement.classList.add("has-cursor");
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const t = e.target as HTMLElement | null;
      const el = t?.closest<HTMLElement>("[data-cursor], a, button, [role=button], input, textarea, select, label, summary");
      if (!el) return setVariant((v) => (v.type === "default" ? v : { type: "default" }));
      const c = el.dataset.cursor;
      if (c) return setVariant({ type: c as Variant["type"], label: el.dataset.cursorLabel });
      if (el.matches("input, textarea, select")) return setVariant({ type: "text" });
      setVariant({ type: "link" });
    };
    const onLeave = () => setVariant({ type: "hidden" });
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.classList.remove("has-cursor");
    };
  }, [x, y]);

  if (!enabled) return null;
  const big = variant.type === "view" || variant.type === "drag";
  const ringScale = variant.type === "hidden" || variant.type === "text" ? 0 : big ? 2.6 : variant.type === "link" ? 1.6 : 1;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[200]">
      <motion.div
        className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-ivory mix-blend-difference"
        style={{ x: dotX, y: dotY, translateX: "-50%", translateY: "-50%" }}
        animate={{ scale: big || variant.type === "hidden" ? 0 : 1 }}
      />
      <motion.div
        className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full"
        style={{ x: ringX, y: ringY, translateX: "-50%", translateY: "-50%" }}
        animate={{ scale: ringScale }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <div
          className={
            big
              ? "bg-foil absolute inset-0 rounded-full shadow-[0_0_40px_rgba(198,161,91,0.35)]"
              : variant.type === "link"
                ? "absolute inset-0 rounded-full border border-gold/70 bg-gold/10 backdrop-blur-[1px]"
                : "absolute inset-0 rounded-full border border-ivory/40"
          }
        />
        {big && (
          <span className="relative font-caps text-[0.24rem] uppercase tracking-[0.2em] text-noir">{variant.label || (variant.type === "drag" ? "Glisser" : "Voir")}</span>
        )}
      </motion.div>
    </div>
  );
}
