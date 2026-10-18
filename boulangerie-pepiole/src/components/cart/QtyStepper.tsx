"use client";

import { AnimatePresence, motion } from "motion/react";
import { MAX_QTY } from "@/lib/cart";

export function QtyStepper({
  value,
  onChange,
  label,
  small = false,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  small?: boolean;
  min?: number;
}) {
  const size = small ? "h-8 w-8 text-base" : "h-10 w-10 text-lg";
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-mie bg-creme p-1">
      <button
        type="button"
        className={`${size} grid place-items-center rounded-full transition hover:bg-mie disabled:opacity-30`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Retirer un ${label}`}
      >
        −
      </button>
      <span className={`relative grid ${small ? "w-6" : "w-8"} place-items-center overflow-hidden font-semibold tabular-nums`} aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.2 }}>
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button
        type="button"
        className={`${size} grid place-items-center rounded-full transition hover:bg-mie disabled:opacity-30`}
        onClick={() => onChange(Math.min(MAX_QTY, value + 1))}
        disabled={value >= MAX_QTY}
        aria-label={`Ajouter un ${label}`}
      >
        +
      </button>
    </div>
  );
}
