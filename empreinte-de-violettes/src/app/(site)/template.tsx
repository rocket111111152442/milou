"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

let firstLoad = true;

/** Transition de page : un rideau violet se lève à chaque navigation. */
export default function Template({ children }: { children: React.ReactNode }) {
  const [curtain] = useState(() => !firstLoad);
  useEffect(() => {
    firstLoad = false;
  }, []);
  return (
    <>
      {curtain && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[140] bg-aubergine-800"
          initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
          animate={{ clipPath: "inset(0% 0% 100% 0%)" }}
          transition={{ duration: 0.85, ease: [0.77, 0, 0.18, 1], delay: 0.05 }}
        >
          <div className="flex h-full items-center justify-center">
            <motion.span
              className="font-caps text-xs uppercase tracking-[0.6em] text-gold/80"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              Empreinte de Violettes
            </motion.span>
          </div>
        </motion.div>
      )}
      <motion.div initial={curtain ? { opacity: 0, y: 30 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}>
        {children}
      </motion.div>
    </>
  );
}
