"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { CLUBS } from "@/lib/site";
import Photo from "../Photo";
import { photo } from "@/lib/photos";

function ClubCard({ id, index }: { id: keyof typeof CLUBS; index: number }) {
  const c = CLUBS[id];
  const ref = useRef<HTMLAnchorElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.9, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        ref={ref}
        href={`/clubs#${c.id}`}
        className="group relative block aspect-[4/5] overflow-hidden rounded-3xl border border-line sm:aspect-[5/6]"
      >
        <motion.div style={{ y }} className="absolute -inset-y-[12%] inset-x-0">
          <Photo {...photo(c.image)} className="h-full w-full transition-transform duration-[1.2s] group-hover:scale-110" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-6">
          <span className="rounded-full bg-ink/60 px-3 py-1 text-xs uppercase tracking-[0.2em] backdrop-blur">
            {c.surface}
          </span>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-volt text-ink transition-transform duration-500 group-hover:rotate-[-45deg]">
            →
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-volt">Club</p>
          <h3 className="font-display mt-2 text-5xl sm:text-7xl">{c.city}</h3>
          <p className="mt-4 max-w-md text-sm text-bone/75 opacity-100 transition-all duration-500 sm:translate-y-4 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
            {c.pitch}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

export default function ClubCards() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ClubCard id="six-fours" index={0} />
      <ClubCard id="sanary" index={1} />
    </div>
  );
}
