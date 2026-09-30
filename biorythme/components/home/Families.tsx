"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { COURSE_FAMILIES } from "@/lib/site";

export default function Families() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {COURSE_FAMILIES.map((f, i) => (
        <motion.div
          key={f.name}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="group relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8"
        >
          <span
            className="absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-50"
            style={{ background: f.color }}
          />
          <h3 className="font-display relative text-4xl" style={{ color: f.color }}>
            {f.name}
          </h3>
          <ul className="relative mt-6 flex flex-wrap gap-2">
            {f.courses.map((c) => (
              <li key={c}>
                <Link
                  href="/planning"
                  className="inline-block rounded-full border border-line px-4 py-2 text-sm transition hover:border-bone hover:bg-bone hover:text-ink"
                >
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}
