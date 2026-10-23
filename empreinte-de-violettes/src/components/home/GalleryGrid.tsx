"use client";

import { motion } from "framer-motion";
import { SmartImage } from "@/components/site/SmartImage";
import { InstagramIcon } from "@/components/site/Social";
import type { GalleryItem } from "@/lib/types";

export function GalleryGrid({ items, instagram, title = "Dans l'atelier" }: { items: GalleryItem[]; instagram: string; title?: string }) {
  const spans = ["row-span-2", "", "", "row-span-2", "", "col-span-2", "", "row-span-2"];
  return (
    <section className="bg-noir py-28 sm:py-36">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-16">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow flex items-center gap-4 text-gold">
              <span className="h-px w-8 bg-gold/60" />
              @empreintedeviolettes
            </p>
            <h2 className="h-display mt-5 text-[clamp(2.6rem,5.4vw,5.4rem)]">
              {title} <em className="text-gold-light">& au-delà</em>
            </h2>
          </div>
          <a href={instagram} target="_blank" rel="noreferrer" className="btn btn-ghost text-ivory">
            <InstagramIcon className="h-4 w-4" />
            <span>Suivre sur Instagram</span>
          </a>
        </div>
        <div className="mt-14 grid grid-flow-dense auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[220px] sm:gap-4 lg:grid-cols-4">
          {items.slice(0, 8).map((g, i) => (
            <motion.figure
              key={g.id}
              className={`group relative overflow-hidden rounded-2xl ${spans[i % spans.length]}`}
              initial={{ opacity: 0, scale: 0.92, y: 40 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: (i % 4) * 0.08 }}
              data-cursor="view"
            >
              <SmartImage src={g.image} alt={g.caption} fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover transition duration-[1.4s] ease-silk group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
              <figcaption className="absolute bottom-4 left-4 right-4 translate-y-3 font-display text-lg italic text-ivory opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                {g.caption}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
