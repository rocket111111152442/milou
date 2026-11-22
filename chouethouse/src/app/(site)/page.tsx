import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HomeHero } from "@/components/HomeHero";
import { Marquee } from "@/components/Marquee";
import { Counter, Parallax, Reveal, Stagger, StaggerItem, Tilt } from "@/components/motion";
import { ActivityCard, ArrowLink, CTABand, SectionTitle } from "@/components/ui";
import { Blob, Owl, Star, Wave } from "@/components/decor";
import { Faq } from "@/components/Faq";
import { faqJsonLd, type QA } from "@/lib/faq";
import { getActivities, getPosts } from "@/lib/store";
import { formatDate, todayISO } from "@/lib/format";
import { SITE } from "@/lib/site";

export const revalidate = 300;

export const metadata: Metadata = { alternates: { canonical: "/" } };

const FAQ: QA[] = [
  {
    q: "Quels sont les horaires de Chouet'House ?",
    a: "Chouet'House vous accueille du lundi au samedi, de 9 h à 18 h, au 2496 avenue Pierre Auguste Renoir à La Seyne-sur-Mer. Nous sommes fermés le dimanche.",
  },
  {
    q: "Faut-il réserver pour venir bruncher ?",
    a: "Ce n'est pas obligatoire, mais c'est conseillé le samedi et pour les groupes. Vous pouvez réserver une table en ligne depuis la page Restauration ou par téléphone au 09 56 60 77 74.",
  },
  {
    q: "À partir de quel âge les enfants peuvent-ils participer aux ateliers ?",
    a: "Dès la naissance ! Massage bébé et réflexologie dès 1 mois, anglais et éveil sensoriel dès 6 mois, pâtisserie et messy play dès 12 mois, et des stages en anglais jusqu'à 11 ans.",
  },
  {
    q: "Organisez-vous des anniversaires d'enfants ?",
    a: "Oui, nous organisons des anniversaires sur demande. Contactez-nous par téléphone, e-mail ou via le formulaire en précisant l'âge de l'enfant, et nous vous proposons une formule adaptée.",
  },
  {
    q: "Le lieu est-il accessible en poussette et en fauteuil roulant ?",
    a: "Oui, Chouet'House est accessible aux personnes à mobilité réduite et pensé pour les familles avec poussettes.",
  },
  {
    q: "Proposez-vous la vente à emporter ?",
    a: "Oui : repas sur place, vente à emporter et livraison sont disponibles.",
  },
];

const PILLARS = [
  {
    href: "/restaurant-brunch",
    title: "Restauration",
    text: "Brunchs gourmands, cookies maison et petite restauration fraîche et de saison.",
    img: "/images/toast-avocat.webp",
    color: "bg-mustard",
    emoji: "🥞",
  },
  {
    href: "/ateliers-enfants",
    title: "Ateliers",
    text: "Éveil sensoriel, anglais, danse, musique, pâtisserie : des ateliers parents-enfants dès 0 an.",
    img: "/images/ateliers/cinq-sens.webp",
    color: "bg-sage",
    emoji: "🎨",
    contain: true,
  },
  {
    href: "/anniversaires",
    title: "Anniversaires",
    text: "Une fête inoubliable pour votre enfant, sans stress pour les parents.",
    img: "/images/gateau-anniversaire.webp",
    color: "bg-coral",
    emoji: "🎂",
  },
];

export default async function HomePage() {
  const [activities, posts] = await Promise.all([getActivities(), getPosts()]);
  const today = todayISO();
  const withNext = activities
    .map((a) => ({ ...a, sessions: a.sessions.filter((s) => s.date >= today) }))
    .sort((a, b) => {
      const an = a.sessions[0] ? a.sessions[0].date + a.sessions[0].start : "9999";
      const bn = b.sessions[0] ? b.sessions[0].date + b.sessions[0].start : "9999";
      if (an !== bn) return an.localeCompare(bn);
      return Number(!!b.featured) - Number(!!a.featured);
    })
    .filter((a, i, arr) => arr.findIndex((x) => x.image === a.image) === i)
    .slice(0, 6);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ)) }} />
      <HomeHero />

      <div className="relative z-10 -mt-6 -rotate-2 bg-tomato py-5 text-white shadow-xl">
        <Marquee items={["Brunch", "Cookies maison", "Ateliers d'éveil", "Anniversaires", "Salon de thé", "Stages vacances", "Mini English"]} />
      </div>

      {/* CONCEPT */}
      <section className="container-x relative py-28 sm:py-36">
        <Star className="top-20 right-6 h-10 w-10 animate-float" color="var(--color-sage)" />
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className="relative">
            <Parallax offset={40}>
              <div className="relative aspect-[5/4] overflow-hidden rounded-[3rem] shadow-2xl">
                <Image src="/images/toast-avocat.webp" alt="Assiette gourmande de saison chez Chouet'House" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
              </div>
            </Parallax>
            <Parallax offset={-30} className="absolute -right-4 -bottom-14 w-1/2 sm:-right-10">
              <div className="relative aspect-[494/224] -rotate-3 overflow-hidden rounded-3xl shadow-2xl ring-8 ring-white">
                <Image src="/images/salle.webp" alt="La salle lumineuse de Chouet'House, suspensions en rotin" fill sizes="300px" className="object-cover" />
              </div>
            </Parallax>
            <div className="absolute -top-8 -left-4 grid h-28 w-28 animate-spin-slow place-items-center rounded-full bg-mustard text-center font-display text-sm leading-tight font-bold sm:-left-8">
              <span>
                Fait
                <br />
                maison
                <br />
                avec ♥
              </span>
            </div>
          </div>

          <div>
            <SectionTitle
              align="left"
              eyebrow="Notre concept"
              title="Un cocon où gourmandise et partage sont à l'honneur"
              intro={
                <>
                  <p>
                    Chouet&apos;House est un <strong className="text-ink">coffee shop familial</strong> à La Seyne-sur-Mer. Nous vous proposons une{" "}
                    <strong className="text-ink">petite restauration fraîche et de saison</strong>, de délicieux <strong className="text-ink">brunchs</strong> et des{" "}
                    <strong className="text-ink">cookies maison</strong>, préparés avec amour pour régaler petits et grands.
                  </p>
                  <p className="mt-4">
                    Autour de cet espace gourmand, profitez d&apos;un lieu pensé pour les familles : <strong className="text-ink">ateliers éducatifs et créatifs</strong>,{" "}
                    <strong className="text-ink">anniversaires</strong> inoubliables et <strong className="text-ink">stages ludiques</strong> pendant les vacances scolaires.
                  </p>
                </>
              }
            />
            <Stagger className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { v: <Counter to={4.9} decimals={1} />, l: "note Google", c: "bg-butter" },
                { v: <Counter to={136} />, l: "avis clients", c: "bg-shell" },
                { v: <Counter to={20} suffix="+" />, l: "ateliers", c: "bg-mint" },
                { v: <Counter to={6} suffix="j/7" />, l: "9 h – 18 h", c: "bg-peach" },
              ].map((s, i) => (
                <StaggerItem key={i}>
                  <div className={`${s.c} rounded-3xl p-4 text-center`}>
                    <p className="font-display text-3xl font-bold">{s.v}</p>
                    <p className="text-sm font-bold text-ink-soft">{s.l}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* 3 UNIVERS */}
      <section className="relative bg-mint">
        <Wave color="var(--color-mint)" flip className="absolute -top-[49px] sm:-top-[79px]" />
        <div className="container-x py-24">
          <SectionTitle eyebrow="Nos 3 univers" title="Pour les grands, pour les petits, pour tous" />
          <Stagger className="mt-14 grid gap-8 md:grid-cols-3">
            {PILLARS.map((p) => (
              <StaggerItem key={p.href}>
                <Tilt>
                  <Link href={p.href} className="group block h-full overflow-hidden rounded-[2.5rem] bg-white shadow-xl ring-1 ring-ink/5">
                    <div className="relative aspect-[4/3]">
                      <div className={`absolute inset-0 overflow-hidden ${p.contain ? "bg-white" : ""}`}>
                        <Image
                          src={p.img}
                          alt={p.title}
                          fill
                          sizes="(min-width:768px) 33vw, 100vw"
                          className={`${p.contain ? "object-contain p-6" : "object-cover"} transition duration-700 group-hover:scale-110`}
                        />
                      </div>
                      <span className={`absolute -bottom-6 left-6 grid h-16 w-16 place-items-center rounded-2xl ${p.color} text-3xl shadow-lg transition duration-500 group-hover:-translate-y-3 group-hover:rotate-12`}>
                        {p.emoji}
                      </span>
                    </div>
                    <div className="p-7 pt-10">
                      <h3 className="text-3xl font-semibold">{p.title}</h3>
                      <p className="mt-2 text-ink-soft">{p.text}</p>
                      <span className="mt-5 inline-flex items-center gap-2 font-display font-semibold text-tomato">
                        Découvrir <span className="transition group-hover:translate-x-2">→</span>
                      </span>
                    </div>
                  </Link>
                </Tilt>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
        <Wave color="var(--color-cream)" />
      </section>

      {/* PROCHAINS ATELIERS */}
      <section className="container-x py-24">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <SectionTitle align="left" eyebrow="Programme des ateliers" title="Les prochains rendez-vous" className="max-w-2xl" />
          <ArrowLink href="/ateliers-enfants#planning">Tout le planning</ArrowLink>
        </div>
        <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {withNext.map((a) => (
            <StaggerItem key={a.id}>
              <Link href={`/ateliers-enfants#catalogue`} className="block h-full">
                <ActivityCard a={a} />
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* GALERIE */}
      <section className="relative overflow-hidden bg-ink py-24 text-white">
        <Blob className="-top-20 right-10 h-72 w-72 opacity-20" color="var(--color-coral)" />
        <div className="container-x">
          <Reveal>
            <p className="font-script text-3xl text-mustard">Miam…</p>
            <h2 className="text-4xl font-semibold text-white sm:text-6xl">Ça se passe chez nous</h2>
          </Reveal>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4 px-5 sm:grid-cols-4 sm:px-8">
          {[
            { src: "/images/pancakes.webp", alt: "Pancakes chocolat et fraises", cls: "row-span-2 aspect-[3/4] sm:aspect-auto" },
            { src: "/images/smoothies.webp", alt: "Smoothie fraise et milkshake vanille", cls: "aspect-square" },
            { src: "/images/toast-avocat.webp", alt: "Tartine gourmande et œuf", cls: "aspect-square" },
            { src: "/images/table-brunch.webp", alt: "Table de brunch partagée", cls: "row-span-2 aspect-[3/4] sm:aspect-auto" },
            { src: "/images/gateau-anniversaire.webp", alt: "Gâteau d'anniversaire coloré", cls: "aspect-square" },
            { src: "/images/salle.webp", alt: "La salle de Chouet'House", cls: "aspect-square" },
          ].map((g, i) => (
            <Reveal key={g.src + i} delay={i * 0.07} className={`group relative overflow-hidden rounded-[2rem] ${g.cls}`}>
              <Image src={g.src} alt={g.alt} fill sizes="(min-width:640px) 25vw, 50vw" className="object-cover transition duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent opacity-0 transition group-hover:opacity-100" />
              <p className="absolute bottom-4 left-4 translate-y-4 text-sm font-bold opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">{g.alt}</p>
            </Reveal>
          ))}
        </div>
        <div className="container-x mt-10 flex justify-center">
          <a href={SITE.instagram} target="_blank" rel="noopener" className="btn-yellow">
            Suivez-nous sur Instagram @chouethouse
          </a>
        </div>
      </section>

      {/* POUR QUI */}
      <section className="container-x py-28">
        <SectionTitle eyebrow="Pour qui ?" title="Toute la famille est la bienvenue" />
        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Les parents", d: "Un vrai café, un brunch, un moment pour souffler pendant que les enfants s'amusent.", c: "bg-butter", e: "☕" },
            { t: "Les tout-petits", d: "Éveil sensoriel, comptines signées, massage bébé : des ateliers dès 0 an.", c: "bg-mint", e: "🍼" },
            { t: "Les plus grands", d: "Anglais, danse, pâtisserie, stages vacances jusqu'à 11 ans.", c: "bg-shell", e: "🧁" },
            { t: "Les (futures) mamans", d: "Cercles de parole, bien-être et auto-massage pour prendre soin de soi.", c: "bg-peach", e: "🌸" },
          ].map((x) => (
            <StaggerItem key={x.t}>
              <div className={`${x.c} group h-full rounded-[2rem] p-7 transition duration-500 hover:-translate-y-2 hover:rotate-1`}>
                <span className="inline-block text-4xl transition duration-500 group-hover:scale-125 group-hover:-rotate-12">{x.e}</span>
                <h3 className="mt-4 text-2xl font-semibold">{x.t}</h3>
                <p className="mt-2 text-ink-soft">{x.d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* AVIS */}
      <section className="container-x">
        <Reveal>
          <div className="relative overflow-hidden rounded-[3rem] bg-sage-deep px-6 py-14 text-center text-white sm:px-16">
            <Owl className="absolute -bottom-6 -left-4 h-32 w-32 opacity-90 sm:h-40 sm:w-40" />
            <Star className="top-8 right-10 h-12 w-12 animate-spin-slow" color="var(--color-mustard)" />
            <p className="font-display text-7xl font-bold text-mustard sm:text-8xl">
              <Counter to={4.9} decimals={1} />
            </p>
            <p className="mt-1 text-3xl tracking-widest text-mustard" aria-label="5 étoiles">★★★★★</p>
            <p className="mx-auto mt-4 max-w-xl text-xl">
              Note moyenne sur <strong>136 avis Google</strong>. Merci à toutes les familles qui nous font confiance !
            </p>
            <a href={SITE.mapsUrl} target="_blank" rel="noopener" className="btn-yellow mt-8">
              Lire les avis sur Google
            </a>
          </div>
        </Reveal>
      </section>

      {/* BLOG */}
      {posts.length > 0 && (
        <section className="container-x py-28">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <SectionTitle align="left" eyebrow="Le blog" title="Les news de la maison" className="max-w-2xl" />
            <ArrowLink href="/blog">Tous les articles</ArrowLink>
          </div>
          <Stagger className="mt-12 grid gap-8 md:grid-cols-3">
            {posts.slice(0, 3).map((p) => (
              <StaggerItem key={p.id}>
                <Link href={`/blog/${p.slug}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-white">
                    <Image src={p.cover} alt={p.title} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                  </div>
                  <p className="mt-4 text-sm font-bold text-sage-deep">{formatDate(p.date.slice(0, 10), { day: "numeric", month: "long", year: "numeric" })}</p>
                  <h3 className="mt-1 text-2xl font-semibold transition group-hover:text-tomato">{p.title}</h3>
                  <p className="mt-2 line-clamp-2 text-ink-soft">{p.excerpt}</p>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {/* INFOS PRATIQUES + FAQ */}
      <section className="relative bg-butter">
        <Wave color="var(--color-butter)" flip className="absolute -top-[49px] sm:-top-[79px]" />
        <div className="container-x grid gap-14 py-24 lg:grid-cols-2">
          <div>
            <SectionTitle align="left" eyebrow="Infos pratiques" title="Venir chez Chouet'House" />
            <Reveal delay={0.1}>
              <div className="mt-8 space-y-4 text-lg">
                <p>
                  📍 <strong>{SITE.street}</strong>, {SITE.postalCode} {SITE.city}
                </p>
                <p>🕘 {SITE.hours}</p>
                <p>
                  📞{" "}
                  <a className="font-bold underline decoration-coral decoration-2 underline-offset-4" href={`tel:${SITE.phoneHref}`}>
                    {SITE.phone}
                  </a>
                </p>
                <p>♿ Accessible PMR · 🥡 Sur place, à emporter & livraison</p>
              </div>
              <div className="mt-8 aspect-[4/3] overflow-hidden rounded-[2rem] shadow-xl ring-8 ring-white">
                <iframe title="Plan d'accès Chouet'House" src={SITE.mapsEmbed} className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            </Reveal>
          </div>
          <div>
            <SectionTitle align="left" eyebrow="FAQ" title="Vos questions" />
            <div className="mt-8">
              <Faq items={FAQ} />
            </div>
          </div>
        </div>
      </section>

      <CTABand title="On vous garde une place ?" text="Réservez une table pour le brunch ou inscrivez votre enfant au prochain atelier.">
        <Link href="/restaurant-brunch#reserver" className="btn-yellow">Réserver une table</Link>
        <Link href="/ateliers-enfants#planning" className="btn bg-white text-ink hover:-translate-y-0.5">Réserver un atelier</Link>
      </CTABand>
    </>
  );
}
