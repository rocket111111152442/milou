"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { brand, menu, type MenuItem } from "@/data/site";
import FoodArt from "./FoodArt";
import { ExternalIcon, InstagramIcon } from "./Icons";
import Reveal from "./Reveal";

const availability: Record<MenuItem["availableAt"], string> = {
  both: "Both branches",
  liwa: "Liwa only",
  sbma: "SBMA only",
};

function MenuCard({ item, index }: { item: MenuItem; index: number }) {
  return (
    <article className="group flex h-full flex-row overflow-hidden sm:flex-col rounded-3xl border-[3px] border-char bg-white shadow-sticker transition duration-300 hover:-translate-y-1.5 hover:shadow-sticker-lg">
      <div className="relative w-28 shrink-0 overflow-hidden border-r-[3px] border-char min-[400px]:w-32 sm:aspect-[4/3] sm:w-auto sm:border-b-[3px] sm:border-r-0">
        {item.image ? (
          <Image src={item.image} alt={item.name} fill sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <FoodArt art={item.art} variant={index} className="h-full w-full transition duration-500 group-hover:scale-105" />
        )}
        {item.tag && (
          <span className="absolute left-2 top-2 hidden -rotate-3 rounded-full bg-mango px-3 py-1 sm:inline-block text-xs font-extrabold uppercase tracking-wider text-char shadow-sticker">
            {item.tag}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4 sm:gap-2 sm:p-5">
        {item.tag && <span className="text-[11px] font-extrabold uppercase tracking-wider text-chili sm:hidden">{item.tag}</span>}
        <h4 className="display text-2xl sm:text-3xl">{item.name}</h4>
        <p className="text-sm leading-relaxed text-char/75 sm:text-[15px]">{item.description}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 sm:pt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-char/60">{availability[item.availableAt]}</span>
          <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${item.price ? "bg-chili text-white" : "bg-cream-2 text-char/80"}`}>
            {item.price || "Ask in store"}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function MenuSection() {
  const [active, setActive] = useState(menu[0].id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = menu.find((c) => c.id === active) ?? menu[0];

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % menu.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + menu.length) % menu.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = menu.length - 1;
    else return;
    e.preventDefault();
    setActive(menu[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="menu" className="relative bg-cream-2 py-20 sm:py-28" aria-labelledby="menu-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-chili">What we&apos;re serving</p>
            <h2 id="menu-title" className="display mt-3 text-6xl sm:text-7xl lg:text-8xl">
              The menu<span className="text-chili">.</span>
            </h2>
          </div>
          <a href={brand.fullMenuUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-dark self-start md:self-auto">
            <InstagramIcon /> See the full menu on Instagram <ExternalIcon />
          </a>
        </Reveal>

        <div
          role="tablist"
          aria-label="Menu categories"
          className="-mx-4 mt-10 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {menu.map((c, i) => {
            const selected = c.id === active;
            return (
              <button
                key={c.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                role="tab"
                id={`tab-${c.id}`}
                type="button"
                aria-selected={selected}
                aria-controls={`panel-${c.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(c.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={`min-h-[48px] shrink-0 whitespace-nowrap rounded-full border-[3px] border-char px-5 text-[15px] font-extrabold uppercase tracking-wide transition duration-200 ${
                  selected ? "bg-char text-mango shadow-[3px_3px_0_0_#D42A1E]" : "bg-cream text-char hover:-translate-y-0.5 hover:bg-mango"
                }`}
              >
                {c.label}
                <span className={`ml-2 text-xs ${selected ? "text-cream/60" : "text-char/50"}`}>{c.items.length}</span>
              </button>
            );
          })}
        </div>

        <div id={`panel-${current.id}`} role="tabpanel" aria-labelledby={`tab-${current.id}`} tabIndex={0} className="mt-6 focus-visible:outline-offset-8">
          <p className="mb-6 max-w-xl text-lg text-char/75">{current.intro}</p>
          <ul key={current.id} className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {current.items.map((item, i) => (
              <li key={item.name} className="animate-[fadeUp_.45s_ease-out_both]" style={{ animationDelay: `${i * 60}ms` }}>
                <MenuCard item={item} index={i} />
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-10 rounded-2xl border-2 border-dashed border-char/30 px-5 py-4 text-sm text-char/70">
          Prices and availability vary by branch and season — ask our team in store, or check{" "}
          <a href={brand.instagramUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-chili underline decoration-2 underline-offset-2 hover:text-chili-deep">
            {brand.instagramHandle}
          </a>{" "}
          for the latest menu.
        </p>
      </div>
    </section>
  );
}
