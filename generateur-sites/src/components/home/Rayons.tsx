"use client";

import Image from "next/image";
import Link from "@/components/TLink";
import { motion } from "motion/react";
import { useSiteData } from "@/components/SettingsProvider";
import { Reveal, SplitWords, Tilt } from "@/components/ui/motion";

export function Rayons() {
  const { categories } = useSiteData();
  const cats = categories.filter((c) => c.id !== "formules");
  if (cats.length === 0) return null;
  return (
    <section className="relative bg-creme py-24 sm:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <Reveal>
              <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-croute">
                <span className="h-px w-10 bg-croute" /> Nos rayons
              </p>
            </Reveal>
            <SplitWords as="h2" text="Du premier café au goûter." className="block max-w-2xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl" />
          </div>
          <Reveal delay={0.2}>
            <Link href="/carte" className="group inline-flex items-center gap-3 font-semibold text-cafe">
              <span className="border-b-2 border-croute pb-1">Toute la carte</span>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-cafe text-creme transition group-hover:translate-x-1 group-hover:bg-croute">→</span>
            </Link>
          </Reveal>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.9, delay: (i % 3) * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className={i === 0 ? "lg:row-span-2" : i === cats.length - 1 ? "lg:col-span-3" : ""}
            >
              <Tilt className="h-full">
                <Link
                  href={`/carte?rayon=${c.id}`}
                  className={`group relative flex h-full min-h-[280px] flex-col justify-end overflow-hidden rounded-[2rem] p-7 text-creme ${i === 0 ? "lg:min-h-[600px]" : ""}`}
                >
                  <Image
                    src={c.image}
                    alt=""
                    fill
                    sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-[1.4s] ease-[var(--ease-pain)] group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-torref/90 via-torref/30 to-transparent transition-opacity duration-500 group-hover:opacity-90" />
                  <div className="relative">
                    <p className="font-script text-2xl text-dore">{c.tagline}</p>
                    <div className="flex items-end justify-between gap-4">
                      <h3 className="font-display text-4xl tracking-tight">{c.label}</h3>
                      <span className="grid h-12 w-12 shrink-0 translate-y-3 place-items-center rounded-full bg-creme text-torref opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                        →
                      </span>
                    </div>
                  </div>
                </Link>
              </Tilt>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
