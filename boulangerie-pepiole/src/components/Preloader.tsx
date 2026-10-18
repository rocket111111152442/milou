"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

const ease = [0.76, 0, 0.24, 1] as const;

/** Écran d'ouverture (une fois par session) : le losange se dessine, le nom lève comme une pâte. */
export function Preloader() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("pepiole-intro") === "1";
      sessionStorage.setItem("pepiole-intro", "1");
    } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setShow(false), seen || reduce ? 0 : 2100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = show ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="preloader"
          id="preloader"
          className="fixed inset-0 z-[100] grid place-items-center bg-torref text-creme"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          initial={{ clipPath: "inset(0 0 0% 0)" }}
          transition={{ duration: 1, ease }}
        >
          <div className="flex flex-col items-center gap-6">
            <svg viewBox="0 0 64 64" className="h-24 w-24 text-dore" aria-hidden="true">
              <motion.path
                d="M32 3 L61 32 L32 61 L3 32 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
              <motion.text
                x="32"
                y="39.5"
                textAnchor="middle"
                fontFamily="var(--font-display)"
                fontStyle="italic"
                fontWeight="600"
                fontSize="20"
                fill="currentColor"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.6 }}
              >
                PP
              </motion.text>
            </svg>
            <div className="overflow-hidden">
              <motion.p
                className="font-display text-3xl tracking-tight sm:text-4xl"
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ delay: 0.5, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                Le Pétrin de Pépiole
              </motion.p>
            </div>
            <div className="h-px w-48 overflow-hidden bg-creme/15">
              <motion.div
                className="h-full bg-dore"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                style={{ originX: 0 }}
                transition={{ duration: 1.8, ease: "easeInOut" }}
              />
            </div>
            <motion.p
              className="font-script text-2xl text-caramel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
            >
              Le four est chaud…
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Délai d'entrée des animations du hero : long à la 1re visite (écran d'ouverture), court ensuite. */
export function introDelay() {
  if (typeof window === "undefined") return 1.9;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
    return sessionStorage.getItem("pepiole-intro") === "1" ? 0.35 : 1.9;
  } catch {
    return 0.35;
  }
}
