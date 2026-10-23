"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Faq } from "@/lib/types";

export function FaqList({ faqs, tone = "light" }: { faqs: Faq[]; tone?: "light" | "dark" }) {
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);
  const light = tone === "light";
  return (
    <div className={cn("divide-y border-y", light ? "divide-noir/10 border-noir/10" : "divide-ivory/10 border-ivory/10")}>
      {faqs.map((f) => {
        const isOpen = open === f.id;
        return (
          <div key={f.id}>
            <button
              onClick={() => setOpen(isOpen ? null : f.id)}
              className="group flex w-full items-center justify-between gap-6 py-6 text-left"
              aria-expanded={isOpen}
            >
              <span className={cn("font-display text-2xl transition sm:text-[1.7rem]", isOpen && (light ? "italic text-aubergine-700" : "italic text-gold-light"))}>{f.question}</span>
              <motion.span
                animate={{ rotate: isOpen ? 135 : 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border", light ? "border-noir/15" : "border-ivory/20")}
              >
                <Plus className="h-4 w-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                  <p className={cn("max-w-3xl pb-7 leading-relaxed", light ? "text-noir/70" : "text-ivory/70")}>{f.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
