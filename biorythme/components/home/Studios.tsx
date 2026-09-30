"use client";

import { motion } from "motion/react";
import { useState } from "react";

const STUDIOS = [
  {
    name: "Bike",
    color: "var(--color-blaze)",
    text: "Le studio vélo : lumière tamisée, musique à fond et cadence qui monte.",
  },
  {
    name: "Pump & Boxe",
    color: "var(--color-volt)",
    text: "Barres, poids, gants : renforcement musculaire et enchaînements de boxe.",
  },
  {
    name: "Zen & Freestyle",
    color: "var(--color-ice)",
    text: "Pilates, yoga, stretching… un espace pour gainer, respirer et récupérer.",
  },
];

export default function Studios() {
  const [active, setActive] = useState(0);
  return (
    <div className="flex flex-col gap-3 lg:h-[34rem] lg:flex-row">
      {STUDIOS.map((s, i) => {
        const on = active === i;
        return (
          <motion.button
            key={s.name}
            layout
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
            className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 text-left sm:p-8"
            style={{ flex: on ? 3 : 1 }}
          >
            <motion.div
              className="absolute inset-0 opacity-0"
              animate={{ opacity: on ? 1 : 0 }}
              style={{ background: `radial-gradient(circle at 20% 110%, ${s.color}55, transparent 60%)` }}
            />
            <div className="relative flex h-full min-h-40 flex-col justify-between gap-8">
              <span className="font-display text-7xl" style={{ color: s.color }}>
                0{i + 1}
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Studio</p>
                <h3 className="font-display mt-2 text-4xl break-words sm:text-5xl lg:text-4xl xl:text-5xl">{s.name}</h3>
                <motion.p
                  initial={false}
                  animate={{ opacity: on ? 1 : 0, height: on ? "auto" : 0 }}
                  className="mt-3 max-w-sm overflow-hidden text-bone/75"
                >
                  {s.text}
                </motion.p>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
