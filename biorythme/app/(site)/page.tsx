import Link from "next/link";
import Hero from "@/components/home/Hero";
import Stats from "@/components/home/Stats";
import ClubCards from "@/components/home/ClubCards";
import Studios from "@/components/home/Studios";
import Marquee from "@/components/Marquee";
import { Reveal, SplitTitle } from "@/components/Reveal";
import Photo from "@/components/Photo";
import Families from "@/components/home/Families";
import { COURSE_FAMILIES } from "@/lib/site";

const ACTIVITIES = COURSE_FAMILIES.flatMap((f) => f.courses);

const STEPS = [
  { n: "01", title: "Choisis ton cours", text: "Filtre par club et par jour : tout le planning est au même endroit." },
  { n: "02", title: "Vois les places en direct", text: "Le compteur se met à jour en temps réel à chaque réservation." },
  { n: "03", title: "Réserve en 10 secondes", text: "Nom, email, c'est bloqué. Un empêchement ? Tu libères ta place en un clic." },
];

export default function Home() {
  return (
    <>
      <Hero />

      <section className="border-y border-line bg-volt py-5 text-ink">
        <Marquee items={ACTIVITIES} duration={40} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 md:items-end">
          <h2 className="font-display text-6xl sm:text-8xl">
            <SplitTitle lines={["Envie de vous", <span key="b" className="text-volt">dépenser&nbsp;?</span>]} />
          </h2>
          <Reveal>
            <p className="max-w-md text-lg text-bone/75">
              De perdre vos kilos en trop ? Fitness, musculation, cross training et plus de 20 cours collectifs, avec
              une équipe de coachs professionnels et qualifiés, diplômés et expérimentés.
            </p>
          </Reveal>
        </div>
        <div className="mt-14">
          <Stats />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-32 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display text-6xl sm:text-8xl">
            <SplitTitle lines={["Deux clubs"]} />
          </h2>
          <Reveal>
            <Link href="/clubs" className="text-sm uppercase tracking-[0.2em] text-muted hover:text-volt">
              Tout voir →
            </Link>
          </Reveal>
        </div>
        <ClubCards />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-32 sm:px-6">
        <div className="mb-10 grid gap-6 md:grid-cols-2 md:items-end">
          <h2 className="font-display text-6xl sm:text-8xl">
            <SplitTitle lines={["3 studios", <span key="o" className="text-outline">3 ambiances</span>]} />
          </h2>
          <Reveal>
            <p className="max-w-md text-bone/75">
              À Six-Fours, trois studios entièrement équipés avec des ambiances complètement différentes, et de nombreux
              cours répartis sur toute la journée.
            </p>
          </Reveal>
        </div>
        <Studios />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-32 sm:px-6">
        <div className="mb-10 grid gap-6 md:grid-cols-2 md:items-end">
          <h2 className="font-display text-6xl sm:text-8xl">
            <SplitTitle lines={["Cours", <span key="c" className="text-volt">collectifs</span>]} />
          </h2>
          <Reveal>
            <p className="max-w-md text-bone/75">
              Renforcement musculaire, cardio-training, danse, étirements et postures : il y en a pour tous les goûts.
            </p>
          </Reveal>
        </div>
        <Families />
      </section>

      <section className="relative mt-32 overflow-hidden border-y border-line py-6">
        <Marquee items={["Réserve", "Transpire", "Recommence"]} reverse duration={25} className="text-outline" />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-32 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-volt">Nouveau</p>
            <h2 className="font-display mt-4 text-6xl sm:text-8xl">
              <SplitTitle lines={["Ta place", "en direct"]} />
            </h2>
            <div className="mt-12 grid gap-4">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 0.1}>
                  <div className="group flex gap-6 rounded-3xl border border-line p-6 transition-colors hover:border-volt/60 hover:bg-surface">
                    <span className="font-display text-4xl text-volt">{s.n}</span>
                    <div>
                      <h3 className="text-xl font-semibold">{s.title}</h3>
                      <p className="mt-1 text-muted">{s.text}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.3}>
              <Link href="/planning" className="mt-10 inline-flex rounded-full bg-volt px-8 py-4 font-semibold text-ink transition hover:scale-105">
                Voir le planning →
              </Link>
            </Reveal>
          </div>
          <Reveal className="relative hidden lg:block">
            <Photo
              src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=70"
              alt="Cours collectif"
              className="h-full min-h-[36rem] rounded-3xl"
            />
            <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-line bg-ink/80 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-3xl">Body Pump</p>
                  <p className="text-sm text-muted">Studio Pump & Boxe · 18h30</p>
                </div>
                <span className="rounded-full bg-volt px-4 py-2 text-sm font-semibold text-ink">4 places</span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full w-[88%] rounded-full bg-[#ffb02e]" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-32 sm:px-6">
        <Reveal>
          <Link
            href="/planning"
            className="group relative block overflow-hidden rounded-[2.5rem] bg-volt px-6 py-20 text-center text-ink sm:py-28"
          >
            <span className="stripes absolute inset-0 opacity-40" />
            <span className="font-display relative block text-6xl transition-transform duration-700 group-hover:scale-105 sm:text-9xl">
              Réserve ton cours
            </span>
            <span className="relative mt-6 inline-block text-lg font-semibold">Planning des 2 clubs, places en temps réel →</span>
          </Link>
        </Reveal>
      </section>
    </>
  );
}
