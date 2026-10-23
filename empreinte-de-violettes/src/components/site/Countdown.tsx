"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  return {
    j: Math.floor(ms / 86400000),
    h: Math.floor((ms / 3600000) % 24),
    m: Math.floor((ms / 60000) % 60),
    s: Math.floor((ms / 1000) % 60),
  };
}

function Unit({ value, label }: { value: number; label: string }) {
  const v = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-20 w-16 items-center justify-center overflow-hidden rounded-2xl border border-ivory/15 bg-ivory/[0.04] font-display text-5xl tabular-nums sm:h-24 sm:w-20 sm:text-6xl">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={v}
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {v}
          </motion.span>
        </AnimatePresence>
        <span className="absolute inset-x-0 top-1/2 h-px bg-noir/40" />
      </div>
      <span className="mt-2 text-[0.6rem] uppercase tracking-[0.25em] text-ivory/50">{label}</span>
    </div>
  );
}

export function Countdown({ target }: { target: string }) {
  const t = new Date(target).getTime();
  const [d, setD] = useState<ReturnType<typeof diff> | null>(null);
  useEffect(() => {
    setD(diff(t));
    const id = setInterval(() => setD(diff(t)), 1000);
    return () => clearInterval(id);
  }, [t]);
  if (!d) return <div className="h-24" />;
  if (t < Date.now()) return null;
  return (
    <div className="flex gap-3 sm:gap-4" role="timer" aria-label={`${d.j} jours ${d.h} heures ${d.m} minutes`}>
      <Unit value={d.j} label="Jours" />
      <Unit value={d.h} label="Heures" />
      <Unit value={d.m} label="Min." />
      <Unit value={d.s} label="Sec." />
    </div>
  );
}
