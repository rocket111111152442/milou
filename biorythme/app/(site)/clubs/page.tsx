import type { Metadata } from "next";
import Link from "next/link";
import Photo from "@/components/Photo";
import { Reveal, SplitTitle } from "@/components/Reveal";
import { CLUBS } from "@/lib/site";

export const metadata: Metadata = { title: "Les clubs" };

export default function ClubsPage() {
  return (
    <div className="pt-36">
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-xs uppercase tracking-[0.2em] text-volt">Six-Fours · Sanary</p>
        <h1 className="font-display mt-4 text-7xl sm:text-9xl">
          <SplitTitle lines={["Les clubs"]} />
        </h1>
      </section>

      {Object.values(CLUBS).map((c, i) => (
        <section key={c.id} id={c.id} className="mx-auto mt-24 max-w-7xl scroll-mt-28 px-4 sm:px-6">
          <div className={`grid gap-10 lg:grid-cols-2 lg:items-center ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <Reveal>
              <div className="relative">
                <Photo src={c.image} alt={c.name} className="aspect-[4/3] rounded-3xl" />
                <span className="font-display absolute -bottom-6 right-6 rounded-2xl bg-volt px-5 py-3 text-4xl text-ink sm:text-5xl">
                  {c.surface}
                </span>
              </div>
            </Reveal>
            <div>
              <h2 className="font-display text-6xl sm:text-7xl">
                <SplitTitle lines={[c.city]} />
              </h2>
              <Reveal delay={0.1}>
                <p className="mt-6 text-lg text-bone/80">{c.pitch}</p>
                <ul className="mt-8 flex flex-wrap gap-2">
                  {c.features.map((f) => (
                    <li key={f} className="rounded-full border border-line px-4 py-2 text-sm">
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Adresse</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.mapQuery)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block hover:text-volt"
                    >
                      {c.address} ↗
                    </a>
                    <a href={`tel:${c.phoneHref}`} className="mt-2 block font-semibold hover:text-volt">
                      {c.phone}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Horaires</p>
                    {c.hours ? (
                      <dl className="mt-2 grid gap-1 text-sm">
                        {c.hours.map((h) => (
                          <div key={h.days} className="flex justify-between gap-4">
                            <dt className="text-bone/70">{h.days}</dt>
                            <dd className="font-semibold">{h.time}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-2 text-sm text-bone/70">Nous contacter par téléphone.</p>
                    )}
                  </div>
                </div>
                <Link
                  href={`/planning?club=${c.id}`}
                  className="mt-10 inline-flex rounded-full bg-bone px-7 py-4 font-semibold text-ink transition hover:bg-volt"
                >
                  Voir le planning →
                </Link>
              </Reveal>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
