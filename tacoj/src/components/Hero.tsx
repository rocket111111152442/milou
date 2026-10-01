import Image from "next/image";
import { brand } from "@/data/site";
import { ArrowDownIcon, ArrowIcon } from "./Icons";
import { NightScene, SunsetScene } from "./Scenes";

export default function Hero() {
  return (
    <section id="top" className="grain relative flex min-h-[100svh] items-end overflow-hidden bg-char text-cream" aria-labelledby="hero-title">
      {/* Background: official photo if provided, otherwise the split "two moods" artwork */}
      <div className="absolute inset-0">
        {brand.heroImage ? (
          <Image src={brand.heroImage} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : (
          <>
            <SunsetScene id="hero-sun" className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-0 [clip-path:polygon(62%_0,100%_0,100%_100%,38%_100%)] md:[clip-path:polygon(58%_0,100%_0,100%_100%,46%_100%)]">
              <NightScene id="hero-night" className="h-full w-full" />
            </div>
            <div className="absolute inset-0 [clip-path:polygon(61.3%_0,62.7%_0,38.7%_100%,37.3%_100%)] bg-mango md:[clip-path:polygon(57.6%_0,58.4%_0,46.4%_100%,45.6%_100%)]" />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-char via-char/55 to-transparent" />
      </div>

      {/* Mood stickers */}
      <div className="pointer-events-none absolute inset-x-0 top-24 z-10 mx-auto flex max-w-7xl justify-between px-4 sm:top-28 sm:px-6 lg:px-8">
        <span className="animate-floaty whitespace-nowrap rounded-full bg-mango px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-char shadow-sticker [--r:-6deg] sm:text-sm">
          ☀ Liwa · Beachfront
        </span>
        <span className="animate-floaty whitespace-nowrap rounded-full bg-char px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-cream shadow-neon [--r:5deg] [animation-delay:-3s] sm:text-sm">
          <span className="neon-text">● SBMA · Late Night</span>
        </span>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-14 pt-40 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
        <p className="eyebrow mb-4 text-mango">Mexican-inspired street food · Zambales, PH</p>
        <h1 id="hero-title" className="display max-w-5xl text-[17vw] text-cream sm:text-8xl lg:text-[9.5rem]">
          Bold tacos.
          <span className="block text-mango">Two moods.</span>
          <span className="block">
            One <span className="relative inline-block text-chili-light">Taco&nbsp;J<span className="absolute -right-3 -top-1 h-3 w-3 rounded-full bg-mango sm:h-4 sm:w-4" aria-hidden /></span>
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg font-medium text-cream/85 sm:text-xl">
          Mexican-inspired street food from beachfront Liwa to late-night Subic Bay.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href="#locations" className="btn btn-mango text-base">
            Choose your branch <ArrowIcon />
          </a>
          <a href="#menu" className="btn btn-ghost-light text-base">
            View menu
          </a>
        </div>
      </div>

      <a
        href="#locations"
        className="absolute bottom-6 right-4 z-10 hidden h-12 w-12 items-center justify-center rounded-full border-2 border-cream/40 text-cream transition hover:border-mango hover:text-mango sm:inline-flex lg:right-8"
        aria-label="Scroll to branches"
      >
        <ArrowDownIcon />
      </a>
    </section>
  );
}
