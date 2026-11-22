import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal, SplitTitle } from "./motion";
import { Blob, Star, Squiggle, Wave } from "./decor";

export function SectionTitle({
  eyebrow,
  title,
  intro,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={`${align === "center" ? "mx-auto text-center" : ""} max-w-3xl ${className ?? ""}`}>
      {eyebrow && (
        <Reveal y={16}>
          <span className="eyebrow">{eyebrow}</span>
        </Reveal>
      )}
      <h2 className="mt-4 text-4xl font-semibold sm:text-5xl lg:text-6xl">
        <SplitTitle text={title} />
      </h2>
      <Squiggle className={`mt-4 h-4 w-28 ${align === "center" ? "mx-auto" : ""}`} color="var(--color-coral)" />
      {intro && (
        <Reveal delay={0.15}>
          <div className="mt-5 text-lg text-ink-soft sm:text-xl">{intro}</div>
        </Reveal>
      )}
    </div>
  );
}

const HERO_COLORS = {
  peach: { bg: "bg-shell", blob1: "var(--color-coral)", blob2: "var(--color-mustard)" },
  sage: { bg: "bg-mint", blob1: "var(--color-sage)", blob2: "var(--color-butter)" },
  butter: { bg: "bg-butter", blob1: "var(--color-orange)", blob2: "var(--color-sage)" },
};

/** En-tête des pages intérieures */
export function PageHero({
  eyebrow,
  title,
  intro,
  image,
  imageAlt,
  color = "peach",
  children,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  image?: string;
  imageAlt?: string;
  color?: keyof typeof HERO_COLORS;
  children?: ReactNode;
}) {
  const c = HERO_COLORS[color];
  return (
    <section className={`relative ${c.bg} pt-32 sm:pt-40`}>
      <div className="paper absolute inset-0" />
      <Blob className="-top-24 -left-24 h-72 w-72 opacity-50" color={c.blob1} />
      <Star className="top-36 right-[8%] h-12 w-12 animate-float" color={c.blob2 === "var(--color-butter)" ? "var(--color-mustard)" : c.blob2} />
      <div className="container-x relative grid items-center gap-12 pb-16 lg:grid-cols-2 lg:pb-24">
        <div>
          <Reveal y={16}>
            <span className="eyebrow">{eyebrow}</span>
          </Reveal>
          <h1 className="mt-5 text-5xl font-semibold sm:text-6xl lg:text-7xl">
            <SplitTitle text={title} />
          </h1>
          <Reveal delay={0.2}>
            <div className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl">{intro}</div>
          </Reveal>
          {children && <Reveal delay={0.3}><div className="mt-8 flex flex-wrap gap-3">{children}</div></Reveal>}
        </div>
        {image && (
          <Reveal delay={0.15} x={40} y={0} className="relative">
            <Blob className="inset-6 -z-0 opacity-70" color={c.blob2} />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[3rem] shadow-2xl ring-8 ring-white sm:rotate-2">
              <Image src={image} alt={imageAlt ?? ""} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
            </div>
          </Reveal>
        )}
      </div>
      <Wave color="var(--color-cream)" />
    </section>
  );
}

export { ActivityCardInner as ActivityCard } from "./ActivityCardInner";

export function CTABand({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="container-x my-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[3rem] bg-tomato px-6 py-14 text-center text-white sm:px-14 sm:py-20">
          <Blob className="-top-20 -right-16 h-64 w-64 opacity-40" color="var(--color-mustard)" />
          <Blob className="-bottom-24 -left-10 h-64 w-64 opacity-30" color="var(--color-coral)" />
          <Star className="top-8 left-10 h-10 w-10 animate-spin-slow" color="var(--color-butter)" />
          <h2 className="relative text-4xl font-semibold text-white sm:text-5xl">{title}</h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-lg text-white/90">{text}</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">{children}</div>
        </div>
      </Reveal>
    </section>
  );
}

export function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2 font-display text-lg font-semibold text-tomato">
      {children}
      <span className="grid h-8 w-8 place-items-center rounded-full bg-tomato text-white transition group-hover:translate-x-1">→</span>
    </Link>
  );
}
