"use client";

import { AnimatePresence, motion } from "motion/react";
import { create } from "zustand";

type Flight = { id: number; src?: string; from: DOMRect; to: DOMRect };

const useFlights = create<{ flights: Flight[]; push: (f: Flight) => void; done: (id: number) => void }>((set) => ({
  flights: [],
  push: (f) => set((s) => ({ flights: [...s.flights, f] })),
  done: (id) => set((s) => ({ flights: s.flights.filter((f) => f.id !== id) })),
}));

let counter = 0;

/** Lance une petite vignette du produit vers le bouton panier. */
export function flyToCart(from: HTMLElement | null, src?: string) {
  if (!from || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = document.getElementById("cart-target");
  if (!target) return;
  useFlights.getState().push({ id: ++counter, src, from: from.getBoundingClientRect(), to: target.getBoundingClientRect() });
}

export function FlyLayer() {
  const { flights, done } = useFlights();
  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-hidden="true">
      <AnimatePresence>
        {flights.map((f) => {
          const size = 64;
          const x0 = f.from.left + f.from.width / 2 - size / 2;
          const y0 = f.from.top + f.from.height / 2 - size / 2;
          const x1 = f.to.left + f.to.width / 2 - size / 2;
          const y1 = f.to.top + f.to.height / 2 - size / 2;
          return (
            <motion.div
              key={f.id}
              className="absolute left-0 top-0 h-16 w-16 overflow-hidden rounded-full border-2 border-creme bg-dore shadow-xl"
              initial={{ x: x0, y: y0, scale: 1.2, opacity: 1 }}
              animate={{
                x: [x0, (x0 + x1) / 2, x1],
                y: [y0, Math.min(y0, y1) - 140, y1],
                scale: [1.2, 0.9, 0.3],
                rotate: [0, 120, 300],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.5, 0, 0.3, 1] }}
              onAnimationComplete={() => done(f.id)}
            >
              {f.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.src} alt="" className="h-full w-full object-cover" />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
