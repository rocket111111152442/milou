"use client";

import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { StarGlyph } from "./Social";

export function AnnouncementBar({ text, link }: { text: string; link: string }) {
  const { scrollY } = useScroll();
  const [hide, setHide] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setHide(y > 40));
  return (
    <motion.div
      className="bg-foil fixed inset-x-0 top-0 z-[61] flex h-9 items-center justify-center overflow-hidden px-4 text-center text-noir"
      animate={{ y: hide ? "-100%" : 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={link || "/boutique"} className="flex items-center gap-3 truncate font-caps text-[0.58rem] uppercase tracking-[0.22em] sm:text-[0.62rem]">
        <StarGlyph className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{text}</span>
        <StarGlyph className="hidden h-2.5 w-2.5 shrink-0 sm:block" />
      </Link>
    </motion.div>
  );
}
