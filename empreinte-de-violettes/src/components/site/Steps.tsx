"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

/** Étapes reliées par une ligne qui se dessine au défilement. */
export function Steps({ steps, tone = "light" }: { steps: { title: string; text: string }[]; tone?: "light" | "dark" }) {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.6"] });
  const h = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const light = tone === "light";
  return (
    <ol ref={ref} className="relative ml-4 space-y-14 border-l border-transparent pl-12">
      <span className={`absolute left-0 top-0 h-full w-px ${light ? "bg-noir/10" : "bg-ivory/10"}`} />
      <motion.span className={`absolute left-0 top-0 w-px ${light ? "bg-aubergine-600" : "bg-gold"}`} style={{ height: h }} />
      {steps.map((s, i) => (
        <motion.li key={i} className="relative" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.6 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
          <span className={`absolute -left-[4.1rem] top-0 flex h-10 w-10 items-center justify-center rounded-full border font-caps text-xs ${light ? "border-aubergine-600 bg-ivory text-aubergine-700" : "border-gold bg-noir text-gold"}`}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="font-display text-3xl">{s.title}</h3>
          <p className={`mt-2 max-w-lg leading-relaxed ${light ? "text-noir/65" : "text-ivory/65"}`}>{s.text}</p>
        </motion.li>
      ))}
    </ol>
  );
}
