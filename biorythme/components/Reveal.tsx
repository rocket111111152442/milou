"use client";

import { motion } from "motion/react";

export function Reveal({
  children,
  delay = 0,
  className,
  y = 40,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Titre qui monte ligne par ligne, masqué par un overflow. */
export function SplitTitle({ lines, className = "" }: { lines: React.ReactNode[]; className?: string }) {
  // L'observation se fait sur le conteneur : les lignes, décalées hors de leur
  // masque, ne seraient jamais détectées comme visibles.
  return (
    <motion.span
      className={`block ${className}`}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      transition={{ staggerChildren: 0.08 }}
    >
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.06em]">
          <motion.span
            className="block"
            variants={{ hidden: { y: "110%" }, show: { y: 0 } }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}
