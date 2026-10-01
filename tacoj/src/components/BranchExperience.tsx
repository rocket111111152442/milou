import Image from "next/image";
import type { Location } from "@/data/site";
import { HoursTable, StatusPill } from "./Hours";
import { DirectionsIcon, ExternalIcon, PhoneIcon, PinIcon } from "./Icons";
import Reveal from "./Reveal";
import { NightScene, SunsetScene } from "./Scenes";

export default function BranchExperience({ location }: { location: Location }) {
  const sun = location.theme === "sun";

  return (
    <section
      id={location.id}
      aria-labelledby={`${location.id}-title`}
      className={`grain relative overflow-hidden py-20 sm:py-28 ${
        sun ? "bg-gradient-to-b from-[#FFE3A8] via-cream to-cream-2 text-char" : "grain-light bg-[#0F0C0B] text-cream"
      }`}
    >
      {!sun && (
        <div aria-hidden className="pointer-events-none absolute -left-40 top-20 h-[480px] w-[480px] rounded-full bg-chili/25 blur-[120px]" />
      )}
      {!sun && (
        <div aria-hidden className="pointer-events-none absolute -right-40 bottom-0 h-[420px] w-[420px] rounded-full bg-ocean/25 blur-[120px]" />
      )}
      {sun && (
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-mango/60 blur-3xl" />
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mb-10 sm:mb-14">
          <p className={`eyebrow ${sun ? "text-chili" : "text-ocean-glow"}`}>
            {sun ? "Branch 01 · San Felipe, Zambales" : "Branch 02 · Subic Bay Freeport"}
          </p>
          <h2 id={`${location.id}-title`} className="display mt-3 text-[15vw] sm:text-8xl lg:text-9xl">
            {sun ? (
              <>
                {location.shortName} <span className="text-sunset-deep">{location.mood}</span>
              </>
            ) : (
              <>
                <span className="neon-text animate-flicker">{location.shortName}</span>{" "}
                <span className="neon-teal">{location.mood}</span>
              </>
            )}
          </h2>
        </Reveal>

        <div className={`grid items-start gap-8 lg:grid-cols-12 lg:gap-12 ${sun ? "" : "lg:[&>*:first-child]:order-2"}`}>
          {/* Visual */}
          <Reveal className="lg:col-span-7">
            <div
              className={`relative aspect-[4/5] overflow-hidden rounded-[32px] border-[3px] sm:aspect-[16/11] ${
                sun ? "border-char shadow-sticker-lg" : "border-chili-light/70 shadow-neon"
              }`}
            >
              {location.image ? (
                <Image src={location.image} alt={`${location.name} — ${location.mood}`} fill sizes="(min-width:1024px) 58vw, 100vw" className="object-cover" />
              ) : sun ? (
                <SunsetScene id={`${location.id}-exp`} className="h-full w-full" />
              ) : (
                <NightScene id={`${location.id}-exp`} className="h-full w-full" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-char/80 to-transparent p-5 pt-20 sm:p-8 sm:pt-24">
                <p className={`font-hand text-3xl sm:text-5xl ${sun ? "text-mango" : "neon-text"}`}>{location.tagline}</p>
              </div>
            </div>
            <ul className="mt-6 flex flex-wrap gap-2" aria-label={`${location.shortName} highlights`}>
              {location.highlights.map((h, i) => (
                <li
                  key={h}
                  className={`rounded-full px-4 py-2 text-sm font-extrabold uppercase tracking-wide ${
                    sun
                      ? ["bg-chili text-white", "bg-ocean text-white", "bg-char text-mango", "bg-mango text-char"][i % 4] + " shadow-sticker"
                      : "border border-cream/20 bg-cream/5 text-cream"
                  } ${i % 2 ? "rotate-1" : "-rotate-1"}`}
                >
                  {h}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Info ticket */}
          <Reveal delay={120} className="lg:col-span-5">
            <p className={`mb-6 text-lg leading-relaxed ${sun ? "text-char/80" : "text-cream/80"}`}>{location.description}</p>

            <div
              className={`rounded-[28px] p-6 sm:p-7 ${
                sun ? "border-[3px] border-char bg-cream shadow-sticker-lg" : "border border-cream/15 bg-char-2/80 backdrop-blur"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="display text-3xl">{location.name}</h3>
                <StatusPill location={location} tone={sun ? "dark" : "light"} />
              </div>

              <div className="dashed-rule my-5" />

              <div className="flex items-start gap-3">
                <PinIcon className={`mt-1 h-5 w-5 shrink-0 ${sun ? "text-chili" : "text-chili-light"}`} />
                <address className="not-italic leading-relaxed">
                  {location.address.map((line) => (
                    <span key={line} className="block">{line}</span>
                  ))}
                </address>
              </div>

              <div className="mt-5">
                <p className={`mb-2 text-xs font-extrabold uppercase tracking-[0.18em] ${sun ? "text-char/60" : "text-cream/60"}`}>Opening hours</p>
                <HoursTable location={location} tone={sun ? "light" : "dark"} />
              </div>

              <div className="dashed-rule my-5" />

              <div className="grid gap-3">
                {location.phones.map((p) => (
                  <a key={p.tel} href={`tel:${p.tel}`} className={`btn ${sun ? "btn-chili" : "btn-mango"} w-full justify-between`} aria-label={`Call ${location.name} at ${p.display}`}>
                    <span className="inline-flex items-center gap-2"><PhoneIcon /> Call</span>
                    <span className="tabular-nums">{p.display}</span>
                  </a>
                ))}
                <a
                  href={location.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn w-full ${sun ? "btn-ghost-dark" : "btn-ghost-light"}`}
                  aria-label={`Get directions to ${location.name} (opens Google Maps)`}
                >
                  <DirectionsIcon /> Get directions
                </a>
                {location.orderUrl && (
                  <a href={location.orderUrl} target="_blank" rel="noopener noreferrer" className={`btn w-full ${sun ? "btn-mango" : "btn-cream"}`}>
                    Order online <ExternalIcon />
                  </a>
                )}
                {location.reserveUrl && (
                  <a href={location.reserveUrl} target="_blank" rel="noopener noreferrer" className={`btn w-full ${sun ? "btn-ghost-dark" : "btn-ghost-light"}`}>
                    Reserve a table <ExternalIcon />
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
