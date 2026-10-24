import Link from "next/link";
import { ALMANACH } from "@/lib/almanach";
import { MONTHS } from "@/lib/format";
import type { Content } from "@/lib/types";
import { Fade, RunningHead, Words } from "../Elements";
import { Plate } from "../Plate";

/** Ce qui fleurit ce mois-ci, et le rendez-vous de la saison. */
export function Almanach({ seasonal, month, daysTo }: { seasonal: Content["seasonal"]; month: number; daysTo: number | null }) {
  const items = ALMANACH[month] || ALMANACH[0];
  const name = MONTHS[month];
  const when = daysTo == null || daysTo < 0 ? null : daysTo === 0 ? "aujourd'hui" : daysTo === 1 ? "demain" : `dans ${daysTo} jours`;
  return (
    <section className="h-paper-deep py-24 sm:py-32">
      <div className="wrap">
        <RunningHead left="Almanach des fleurs" right="IV" />
        <div className="mt-14 grid gap-16 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <p className="sc text-ink-muted">En saison au mois de</p>
            <h2 className="mt-3 font-display text-[clamp(4rem,11vw,9.5rem)] italic leading-[0.9] tracking-[-0.02em]">
              <Words text={name.charAt(0).toUpperCase() + name.slice(1)} />
            </h2>
            {seasonal.active && (
              <Fade delay={0.2} className="mt-12 max-w-md border-t border-ink/15 pt-6">
                <p className="sc text-plum">
                  {seasonal.eyebrow}
                  {when && <span className="font-text normal-case italic tracking-normal text-ink-muted"> — {when}</span>}
                </p>
                <h3 className="mt-3 font-display text-[2rem] leading-tight">{seasonal.title}</h3>
                <p className="body-text mt-3">{seasonal.text}</p>
                <Link href={seasonal.ctaLink || "/boutique"} className="btn-line mt-6">
                  {seasonal.ctaLabel} <span className="arrow">→</span>
                </Link>
              </Fade>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:col-span-7 lg:grid-cols-5 lg:gap-x-5 lg:pt-8">
            {items.map((f, i) => (
              <li key={f.name} className={i % 2 ? "lg:pt-16" : ""}>
                <div className="aspect-[3/4] text-plum">
                  <Plate name={f.plate} fit="contain" delay={i * 0.18} duration={2} className="h-full w-full" />
                </div>
                <Fade delay={0.3 + i * 0.1} y={8}>
                  <p className="mt-4 font-display text-[1.25rem] leading-tight">{f.name}</p>
                  <p className="font-text text-[0.9rem] italic text-ink-muted">{f.note}</p>
                </Fade>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
