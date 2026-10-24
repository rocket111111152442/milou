"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { EASE } from "./Elements";

/** Questions dépliables, numérotées comme les entrées d'un index. */
export function FaqList({ faqs, start = 1 }: { faqs: { id: string; question: string; answer: string }[]; start?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="border-t border-ink/15">
      {faqs.map((f, i) => {
        const on = open === f.id;
        return (
          <li key={f.id} className="border-b border-ink/15">
            <button onClick={() => setOpen(on ? null : f.id)} className="group flex w-full items-baseline gap-4 py-5 text-left" aria-expanded={on}>
              <span className="tab w-8 shrink-0 font-text text-[0.85rem] italic text-ink-muted">{String(start + i).padStart(2, "0")}</span>
              <span className={cn("flex-1 font-display text-[clamp(1.25rem,2.2vw,1.6rem)] leading-snug transition", on && "italic")}>{f.question}</span>
              <span className={cn("shrink-0 font-text text-[1.3rem] leading-none text-ink-muted transition-transform duration-500 ease-silk", on && "rotate-45")}>+</span>
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.55, ease: EASE }} className="overflow-hidden">
                  <p className="body-text max-w-3xl pb-6 pl-12">{f.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
