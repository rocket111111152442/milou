import type { Metadata } from "next";
import { Reveal, SplitTitle } from "@/components/Reveal";
import { CLUBS, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-36 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-volt">Contactez votre salle de sport</p>
      <h1 className="font-display mt-4 text-7xl sm:text-9xl">
        <SplitTitle lines={["Contact"]} />
      </h1>

      <Reveal>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-display mt-12 block break-all text-4xl text-volt transition hover:text-bone sm:text-6xl"
        >
          {CONTACT_EMAIL}
        </a>
      </Reveal>

      <div className="mt-16 grid gap-6 md:grid-cols-2">
        {Object.values(CLUBS).map((c, i) => (
          <Reveal key={c.id} delay={i * 0.1}>
            <div className="h-full rounded-3xl border border-line bg-surface p-8">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{c.surface}</p>
              <h2 className="font-display mt-3 text-5xl">{c.city}</h2>
              <p className="mt-6 text-bone/80">{c.address}</p>
              <a href={`tel:${c.phoneHref}`} className="font-display mt-4 block text-4xl hover:text-volt">
                {c.phone}
              </a>
              <dl className="mt-6 grid gap-1 text-sm">
                {c.hours.map((h) => (
                  <div key={h.days} className="flex justify-between gap-4 border-b border-line/60 py-1.5">
                    <dt className="text-bone/70">{h.days}</dt>
                    <dd className="font-semibold">{h.time}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-8 overflow-hidden rounded-2xl border border-line">
                <iframe
                  title={`Plan d'accès ${c.name}`}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(c.mapQuery)}&output=embed`}
                  className="h-64 w-full grayscale invert-[0.9]"
                  loading="lazy"
                />
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
