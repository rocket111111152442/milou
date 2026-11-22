"use client";

import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";

const ease = [0.76, 0, 0.24, 1] as const;

/**
 * Transition entre les pages : rideau coloré (couleurs du logo) qui se lève,
 * puis le contenu glisse en douceur.
 */
let firstLoad = true;

export function PageTransition({ children }: { children: ReactNode }) {
  // Pas de rideau au tout premier chargement (meilleur LCP / SEO), seulement entre les pages
  const [skip] = useState(() => firstLoad);
  useEffect(() => {
    firstLoad = false;
  }, []);
  if (skip) return <>{children}</>;
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[90]">
        <motion.div
          className="absolute inset-0 origin-top bg-sage"
          initial={{ scaleY: 1 }}
          animate={{ scaleY: 0 }}
          transition={{ duration: 0.75, ease, delay: 0.2 }}
        />
        <motion.div
          className="absolute inset-0 origin-top bg-mustard"
          initial={{ scaleY: 1 }}
          animate={{ scaleY: 0 }}
          transition={{ duration: 0.75, ease, delay: 0.1 }}
        />
        <motion.div
          className="absolute inset-0 grid origin-top place-items-center bg-coral"
          initial={{ scaleY: 1 }}
          animate={{ scaleY: 0 }}
          transition={{ duration: 0.75, ease }}
        >
          <motion.div initial={{ scale: 1, opacity: 1 }} animate={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.35 }}>
            <Image src="/images/logo-horizontal.webp" alt="" width={220} height={50} className="h-12 w-auto" />
          </motion.div>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
      >
        {children}
      </motion.div>
    </>
  );
}
