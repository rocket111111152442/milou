import Image from "next/image";
import { locations, type Location } from "@/data/site";
import { StatusPill, TodayHours } from "./Hours";
import { ArrowIcon, DirectionsIcon, PhoneIcon, PinIcon } from "./Icons";
import Reveal from "./Reveal";
import { NightScene, SunsetScene } from "./Scenes";

function BranchCard({ location }: { location: Location }) {
  const sun = location.theme === "sun";
  return (
    <article
      aria-labelledby={`card-${location.id}`}
      className={`grain group relative flex h-full flex-col overflow-hidden rounded-[28px] border-[3px] border-char transition duration-300 hover:-translate-y-1 ${
        sun ? "bg-mango text-char shadow-sticker-lg" : "bg-char text-cream shadow-[8px_8px_0_0_#D42A1E]"
      }`}
    >
      {/* Visual header */}
      <div className="relative h-48 overflow-hidden sm:h-60">
        {location.image ? (
          <Image src={location.image} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
        ) : sun ? (
          <SunsetScene id={`card-${location.id}`} className="h-full w-full transition duration-700 group-hover:scale-105" />
        ) : (
          <NightScene id={`card-${location.id}`} className="h-full w-full transition duration-700 group-hover:scale-105" />
        )}
        <div className={`absolute inset-0 ${sun ? "bg-gradient-to-t from-mango via-transparent" : "bg-gradient-to-t from-char via-transparent"}`} />
        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${sun ? "bg-char text-mango" : "bg-chili text-white"}`}>
            {location.mood}
          </span>
        </div>
        {!sun && (
          <span className="neon-text absolute right-5 top-4 z-10 animate-flicker font-hand text-2xl" aria-hidden>
            open late
          </span>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col gap-5 p-5 sm:p-7">
        <div>
          <h3 id={`card-${location.id}`} className="display text-6xl sm:text-7xl">
            {location.shortName}
            <span className={`ml-3 align-middle font-hand text-2xl normal-case tracking-normal sm:text-3xl ${sun ? "text-chili" : "text-mango"}`}>
              — {location.mood}
            </span>
          </h3>
          <p className={`mt-2 text-base font-medium ${sun ? "text-char/80" : "text-cream/75"}`}>{location.tagline}</p>
        </div>

        <div className={`grid gap-4 rounded-2xl p-4 sm:grid-cols-2 ${sun ? "bg-cream/70" : "bg-cream/[0.06] ring-1 ring-cream/10"}`}>
          <TodayHours location={location} />
          <div className="flex items-start gap-2 text-[15px] leading-snug">
            <PinIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <address className="not-italic">{location.address.join(", ")}</address>
          </div>
          <div className="sm:col-span-2">
            <StatusPill location={location} tone={sun ? "dark" : "light"} />
          </div>
        </div>

        <div className="mt-auto grid gap-3">
          <div className="grid gap-3">
            {location.phones.map((p) => (
              <a
                key={p.tel}
                href={`tel:${p.tel}`}
                className={`btn ${sun ? "btn-chili" : "btn-mango"} w-full justify-between`}
                aria-label={`Call ${location.name} at ${p.display}`}
              >
                <span className="inline-flex items-center gap-2"><PhoneIcon /> Call {location.shortName}</span>
                <span className="tabular-nums">{p.display}</span>
              </a>
            ))}
            <a
              href={location.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn ${sun ? "btn-ghost-dark" : "btn-ghost-light"} w-full`}
              aria-label={`Directions to ${location.name} (opens Google Maps)`}
            >
              <DirectionsIcon /> Directions
            </a>
          </div>
          <a
            href={`#${location.id}`}
            aria-label={`View the ${location.name} branch details`}
            className={`btn w-full justify-between !rounded-2xl !py-4 text-base ${sun ? "bg-char text-cream hover:bg-char-3" : "bg-cream text-char hover:bg-white"}`}
          >
            View this branch <ArrowIcon className="h-5 w-5 transition group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </article>
  );
}

export default function BranchSelector() {
  return (
    <section id="locations" className="relative bg-cream py-16 sm:py-24" aria-labelledby="locations-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mb-10 flex flex-col gap-4 sm:mb-14 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-chili">Step 1 · Pick your spot</p>
            <h2 id="locations-title" className="display mt-3 text-[15vw] sm:text-7xl lg:text-8xl">
              Which Taco&nbsp;J<span className="text-chili">?</span>
            </h2>
          </div>
          <p className="max-w-md text-lg text-char/75">
            Two branches with different hours and phone numbers. Pick the right one before you call or head out — it saves you a wasted trip.
          </p>
        </Reveal>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          {locations.map((l, i) => (
            <Reveal key={l.id} delay={i * 120} className="h-full">
              <BranchCard location={l} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
