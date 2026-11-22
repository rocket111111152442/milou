"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import type { QA } from "@/lib/faq";

export function Faq({ items }: { items: QA[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q} className={`rounded-3xl transition-colors ${isOpen ? "bg-white shadow-lg" : "bg-white/60"} ring-1 ring-ink/5`}>
            <button
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-display text-lg font-semibold sm:text-xl"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              {it.q}
              <motion.span animate={{ rotate: isOpen ? 45 : 0 }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mustard text-2xl leading-none">
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <p className="px-6 pb-6 text-ink-soft">{it.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

