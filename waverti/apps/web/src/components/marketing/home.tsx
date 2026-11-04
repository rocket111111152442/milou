/**
 * Page d'accueil (refonte du 1er novembre 2026) : courte, visuelle, et fidèle aux capacités réelles du produit.
 * Chaque exemple correspond à une condition réellement prise en charge par le moteur de surveillance.
 */
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bell,
  Globe,
  MousePointerClick,
  ShieldCheck,
  Sofa,
  Ticket,
  Calculator,
  Clock,
} from "lucide-react";
import { Button, Container, LogoMark, Reveal, cn } from "@waverti/ui";
import { PLAN_CATALOG, PAID_PLAN_IDS } from "@waverti/billing/catalog";
import { formatCents, formatInterval } from "@waverti/types";
import { Radar } from "@/components/visual/radar";
import { HomeDemo } from "./home-demo";

const H2 = "font-display text-[30px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[40px]";

/* ——————————————————————————— 1. Premier écran ——————————————————————————— */

export function HomeHero() {
  return (
    <section aria-labelledby="hero-title" className="relative px-3 pb-4 pt-2 sm:px-5">
      <div className="grain relative mx-auto max-w-[1320px] overflow-hidden rounded-[36px] bg-[#0d0c2b] text-white shadow-lift">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="anim-glow absolute -left-32 -top-40 size-[560px] rounded-full bg-blue/45 blur-3xl" />
          <div className="anim-glow absolute -bottom-52 right-[-6%] size-[620px] rounded-full bg-violet/40 blur-3xl" style={{ animationDelay: "1.6s" }} />
          <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at 70% 40%, black 10%, transparent 70%)" }} />
        </div>
        <div className="relative grid items-center gap-10 px-6 py-14 sm:px-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6 lg:py-24">
          <div className="flex flex-col items-start">
            <p className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide backdrop-blur">
              <span aria-hidden="true" className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-pulse-dot rounded-full bg-[#5eead4] text-[#5eead4]" />
                <span className="relative inline-flex size-2 rounded-full bg-[#5eead4]" />
              </span>
              Votre sentinelle du web
            </p>
            <h1 id="hero-title" className="mt-6 text-balance font-display text-[42px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-[60px] lg:text-[68px]">
              Un prix baisse. Une place se libère.{" "}
              <span className="animate-gradient-pan bg-[linear-gradient(90deg,#00e5ff,#8aa4ff,#ed4df5,#00e5ff)] bg-[length:200%_100%] bg-clip-text text-transparent">Vous êtes prévenu.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
              Choisissez une page à suivre. Waverti la vérifie à votre place et vous avertit quand ce que vous attendez arrive.
            </p>
            <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link
                href="/inscription"
                className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-white px-8 text-base font-semibold text-[#0d0c2b] shadow-[0_10px_40px_-10px_rgba(255,255,255,0.5)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:hover:translate-y-0"
              >
                Commencer <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
              <Link href="#comment-ca-marche" className="text-center text-sm font-semibold text-white underline-offset-4 hover:underline sm:ml-3">
                Voir comment ça marche
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
              <li className="flex items-center gap-2"><Clock className="size-4 text-cyan" aria-hidden="true" /> Vérifications par nos serveurs</li>
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-cyan" aria-hidden="true" /> Résiliable en ligne</li>
              <li className="flex items-center gap-2"><Bell className="size-4 text-cyan" aria-hidden="true" /> Alerte seulement si ça change</li>
            </ul>
          </div>
          <div className="relative">
            <Radar />
            <p className="mt-3 text-center text-xs text-white/65">Illustration animée : des exemples, pas des données réelles.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Bandeau défilant : les types de surveillance réellement pris en charge (décoratif, masqué aux lecteurs d'écran). */
const TICKER = ["Prix", "Retour en stock", "Billetterie", "Inscriptions", "Nouvelle annonce", "Offre d'emploi", "Document PDF", "Disponibilité d'un site", "Modification d'une page", "Mot-clé"];

export function HomeTicker() {
  const row = [...TICKER, ...TICKER];
  return (
    <div aria-hidden="true" className="my-6 overflow-hidden border-y border-line py-5">
      <div className="anim-ticker flex w-max items-center gap-10 whitespace-nowrap">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            <span className="text-outline">{t}</span>
            <span className="text-2xl text-violet">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* Démonstration interactive (étiquetée « Exemple de fonctionnement » : aucune donnée réelle). */
export function HomeShowcase() {
  return (
    <section aria-labelledby="showcase-title" className="py-12 sm:py-16">
      <Container className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-violet">Démonstration</p>
          <h2 id="showcase-title" className={cn(H2, "mt-3")}>
            Voyez ce que vous recevez.
          </h2>
          <p className="mt-4 text-lg text-ink-soft">Choisissez un exemple : à gauche ce que vous suivez, à droite l'alerte que vous recevez quand ça change.</p>
        </div>
        <HomeDemo />
      </Container>
    </section>
  );
}

/* ——————————————————————————— 2. Comment ça marche ——————————————————————————— */

const STEPS = [
  {
    n: "1",
    q: "Que voulez-vous suivre ?",
    a: "Un prix, un retour en stock, l'ouverture d'une billetterie, une nouvelle annonce ou une page qui change.",
    icon: <MousePointerClick />,
    tint: "bg-[#eef3ff] text-blue",
  },
  {
    n: "2",
    q: "Sur quelle page ?",
    a: "Collez l'adresse de la page à suivre. Waverti l'analyse et vous propose les alertes possibles.",
    icon: <Globe />,
    tint: "bg-[#f4edff] text-violet",
  },
  {
    n: "3",
    q: "Quand être averti ?",
    a: "Vous fixez le déclencheur : sous 100 €, de nouveau en stock, quand « Réserver » apparaît…",
    icon: <Bell />,
    tint: "bg-[#fdeefe] text-pink",
  },
];

export function HomeHowItWorks() {
  return (
    <section id="comment-ca-marche" aria-labelledby="how-title" className="scroll-mt-20 pb-16 pt-8 sm:pb-24">
      <Container>
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-violet">Trois gestes</p>
          <h2 id="how-title" className={cn(H2, "mt-3")}>
            Comment ça marche
          </h2>
          <p className="mt-3 text-lg text-ink-soft">Trois questions, et Waverti s'occupe des vérifications.</p>
        </div>
        <ol className="mt-12 divide-y divide-line border-y border-line">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i * 0.08} className="group grid items-center gap-3 py-8 transition-colors sm:grid-cols-[150px_1fr_1.1fr] sm:gap-8 sm:py-10">
              <span aria-hidden="true" className="text-outline font-display text-[84px] font-extrabold leading-none tracking-[-0.06em] transition-[-webkit-text-stroke-color] duration-300 group-hover:[--outline:#245bff]">
                0{s.n}
              </span>
              <div className="flex items-center gap-4">
                <span className={cn("grid size-12 shrink-0 place-items-center rounded-full [&_svg]:size-5", s.tint)} aria-hidden="true">
                  {s.icon}
                </span>
                <h3 className="font-display text-2xl font-bold tracking-[-0.02em]">{s.q}</h3>
              </div>
              <p className="text-lg leading-relaxed text-ink-soft">{s.a}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/* ——————————————————————————— 3. Usages concrets ——————————————————————————— */

const USES = [
  {
    icon: <Calculator />,
    tint: "from-blue to-violet",
    title: "Acheter au bon prix",
    goal: "Une calculatrice, un vélo, un billet d'avion sur une page précise.",
    result: "Alerte quand le prix passe sous votre seuil ou baisse d'au moins X %.",
  },
  {
    icon: <Ticket />,
    tint: "from-violet to-pink",
    title: "Ne pas rater une ouverture",
    goal: "Une billetterie, des inscriptions, une réservation.",
    result: "Alerte quand le bouton ou la mention d'ouverture apparaît, ou qu'une nouvelle date est publiée.",
  },
  {
    icon: <Sofa />,
    tint: "from-cyan to-blue",
    title: "Saisir un retour en stock",
    goal: "Un canapé, une console, une taille épuisée.",
    result: "Alerte dès que la fiche produit indique de nouveau « en stock ».",
  },
];

export function HomeUses() {
  return (
    <section id="usages" aria-labelledby="uses-title" className="bg-surface py-16 sm:py-24">
      <Container>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-violet">Usages</p>
        <h2 id="uses-title" className={cn(H2, "mt-3")}>
          Ce que vous pouvez confier à Waverti
        </h2>
        <ul className="mt-10 grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
          {USES.map((u, i) => (
            <Reveal
              as="li"
              key={u.title}
              delay={i * 0.1}
              className={cn(
                "group relative flex flex-col gap-4 overflow-hidden rounded-[28px] p-7 transition-transform duration-300 hover:-translate-y-1",
                i === 0 ? "grain bg-[#0d0c2b] text-white lg:col-span-2 lg:row-span-2 lg:p-10" : "border border-line bg-white shadow-soft",
              )}
            >
              <span aria-hidden="true" className={cn("pointer-events-none absolute -right-6 -top-6 opacity-20 transition-opacity group-hover:opacity-40 [&_svg]:size-44", i === 0 ? "text-cyan" : "hidden")}>
                {u.icon}
              </span>
              <span className={cn("grid size-14 place-items-center rounded-2xl bg-gradient-to-br text-white [&_svg]:size-7", u.tint)} aria-hidden="true">
                {u.icon}
              </span>
              <h3 className={cn("font-display font-bold tracking-[-0.02em]", i === 0 ? "text-3xl sm:text-4xl" : "text-xl")}>{u.title}</h3>
              <p className={cn(i === 0 ? "max-w-md text-lg text-white/85" : "text-ink-soft")}>{u.goal}</p>
              {i === 0 ? (
                <div aria-hidden="true" className="relative my-2 hidden flex-1 lg:block">
                  <svg viewBox="0 0 520 170" className="size-full max-h-[220px]" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="0" y1="112" x2="520" y2="112" stroke="rgba(255,255,255,0.35)" strokeDasharray="5 7" />
                    <text x="6" y="104" fill="rgba(255,255,255,0.7)" fontSize="12" fontFamily="ui-monospace, monospace">votre seuil</text>
                    <path d="M0 40 L70 46 L130 36 L190 52 L250 44 L310 70 L370 66 L430 138 L520 142" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
                    <path className="anim-ecg" d="M0 40 L70 46 L130 36 L190 52 L250 44 L310 70 L370 66 L430 138 L520 142" stroke="#00e5ff" strokeWidth="3" style={{ strokeDasharray: "180 520" }} />
                    <circle cx="430" cy="138" r="6" fill="#00e5ff" />
                    <circle cx="430" cy="138" r="14" stroke="#00e5ff" strokeOpacity="0.5" />
                  </svg>
                  <p className="text-[11px] text-white/60">Illustration : un prix qui passe sous le seuil.</p>
                </div>
              ) : null}
              <p className={cn("mt-auto rounded-2xl p-4 text-sm font-medium", i === 0 ? "bg-white/10 text-white backdrop-blur" : "bg-surface")}>{u.result}</p>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ——————————————————————————— 4. Waverti Business ——————————————————————————— */

const BUSINESS = [
  { icon: <Activity />, title: "Votre site ne répond plus" },
  { icon: <ShieldCheck />, title: "Votre certificat HTTPS expire" },
  { icon: <MousePointerClick />, title: "Un parcours ne fonctionne plus" },
];

export function HomeBusiness() {
  return (
    <section id="business" aria-labelledby="business-title" className="px-3 py-16 sm:px-5 sm:py-24">
      <div className="grain relative mx-auto max-w-[1320px] overflow-hidden rounded-[36px] bg-[#0d0c2b] p-6 text-white sm:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-0 size-[420px] rounded-full bg-violet/35 blur-3xl" />
        <div className="relative grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="flex flex-col items-start">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Waverti Business</p>
            <h2 id="business-title" className="mt-3 font-display text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[42px]">
              Soyez le premier informé quand votre site a un problème.
            </h2>
            <p className="mt-4 text-lg text-white/85">Toutes les fonctions Pro, plus la surveillance de votre site professionnel.</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link href="/entreprises" className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#0d0c2b] hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Découvrir Waverti Business
              </Link>
              <span className="text-sm text-white/75">49,99 € par mois TTC</span>
            </div>
          </div>
          <div>
            <div aria-hidden="true" className="rounded-3xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur">
              <svg viewBox="0 0 400 90" className="h-24 w-full" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M0 50 H90 L105 50 L118 12 L136 82 L150 50 H230 L244 50 L256 24 L270 66 L282 50 H400" stroke="rgba(255,255,255,0.15)" />
                <path className="anim-ecg" d="M0 50 H90 L105 50 L118 12 L136 82 L150 50 H230 L244 50 L256 24 L270 66 L282 50 H400" />
              </svg>
              <p className="mt-1 text-center text-[11px] text-white/60">Illustration : pouls d'un site surveillé.</p>
            </div>
            <ul className="mt-6 flex flex-col gap-3">
              {BUSINESS.map((b) => (
                <li key={b.title} className="flex items-center gap-3 text-white/90 [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-cyan">
                  <span aria-hidden="true">{b.icon}</span>
                  {b.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ——————————————————————————— 5. Forfaits compacts ——————————————————————————— */

export function HomePricing() {
  return (
    <section id="tarifs" aria-labelledby="pricing-title" className="scroll-mt-20 bg-surface py-16 sm:py-20">
      <Container>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 id="pricing-title" className={H2}>
              Quatre formules, sans engagement
            </h2>
            <p className="mt-3 text-ink-soft">
              Essai gratuit de 3 jours (carte bancaire demandée, aucun prélèvement pendant l'essai), puis prix mensuel TTC,
              reconduit chaque mois jusqu'à résiliation en ligne.
            </p>
          </div>
          <Link href="/tarifs" className="shrink-0 text-sm font-semibold underline-offset-4 hover:underline">
            Comparer les formules en détail →
          </Link>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAID_PLAN_IDS.map((id, idx) => {
            const p = PLAN_CATALOG[id];
            const highlighted = id === "pro";
            return (
              <Reveal as="li" key={id} delay={idx * 0.08} className={cn("flex flex-col rounded-[28px] p-6 transition-transform duration-300 hover:-translate-y-1", highlighted ? "grain relative overflow-hidden bg-[#0d0c2b] text-white shadow-lift" : "border border-line bg-white")}>
                {highlighted ? <span className="mb-3 w-fit rounded-full bg-[linear-gradient(90deg,#00e5ff,#ed4df5)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0d0c2b]">Le plus choisi</span> : null}
                <h3 className="font-display text-lg font-bold">{p.name}</h3>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold tabular-nums">{formatCents(p.priceCents)}</span>
                  <span className={cn("text-sm", highlighted ? "text-white/75" : "text-muted-fg")}>/ mois</span>
                </p>
                <ul className={cn("mt-4 flex flex-col gap-1.5 text-sm", highlighted ? "text-white/85" : "text-ink-soft")}>
                  <li>{p.maxMonitors} suivis</li>
                  <li className="flex items-center gap-1.5">
                    <Clock className={cn("size-3.5", highlighted ? "text-cyan" : "text-muted-fg")} aria-hidden="true" /> Vérification {formatInterval(p.pageIntervalMinutes)}
                  </li>
                  <li>{p.maxWebTopics} sujets de recherche sur Internet</li>
                  {p.businessSitesIncluded > 0 ? <li className={cn("font-medium", highlighted ? "text-white" : "text-ink")}>+ surveillance de votre site</li> : null}
                </ul>
                <Button asChild variant={highlighted ? "secondary" : "secondary"} className="mt-6">
                  <Link href={`/inscription?formule=${id}`} aria-label={`Commencer avec ${p.name}`}>
                    Commencer
                  </Link>
                </Button>
              </Reveal>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

/* ——————————————————————————— 6. Réponses essentielles ——————————————————————————— */

export const homeFaq: Array<{ q: string; a: string }> = [
  {
    q: "Vais-je recevoir trop de messages ?",
    a: "Non : Waverti ne vous écrit que lorsque le changement que vous avez demandé se produit, pas à chaque vérification. Les e-mails se désactivent pour chaque suivi et sont plafonnés chaque mois selon la formule ; les alertes restent toujours visibles dans l'application.",
  },
  {
    q: "Faut-il laisser mon ordinateur allumé ?",
    a: "Non. Les vérifications sont faites par les serveurs Waverti : votre ordinateur peut rester éteint. Il suffit d'un navigateur pour créer et consulter vos suivis.",
  },
  {
    q: "Waverti cherche-t-il sur tout Internet ?",
    a: "Non. Il vérifie les pages que vous lui indiquez et, pour les sujets de recherche, interroge un moteur de recherche et examine les pages publiques trouvées. Il ne lit pas les pages protégées par un mot de passe et n'invente jamais une information manquante.",
  },
  {
    q: "Waverti achète-t-il ou réserve-t-il à ma place ?",
    a: "Non. Waverti suit et vous avertit ; l'achat ou la réservation restent entre vos mains, sur le site concerné.",
  },
  {
    q: "Comment fonctionnent l'essai et la résiliation ?",
    a: "Chaque formule s'essaie 3 jours avec une carte enregistrée via Stripe ; aucun prélèvement pendant l'essai, qui a des limites (3 suivis). Sans résiliation, le prix mensuel est prélevé à la fin de l'essai puis chaque mois. Vous résiliez en ligne à tout moment depuis la page Abonnement. Un seul essai par personne.",
  },
];

/* ——————————————————————————— 7. Dernier appel ——————————————————————————— */

export function HomeFinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-3 pb-16 pt-4 sm:px-5 sm:pb-24">
      <div className="grain relative mx-auto max-w-[1320px] overflow-hidden rounded-[36px] bg-[#0d0c2b] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="anim-glow absolute left-1/2 top-[-30%] size-[640px] -translate-x-1/2 rounded-full bg-blue/45 blur-3xl" />
          <div className="absolute bottom-[-45%] left-1/2 w-[900px] -translate-x-1/2 opacity-40"><Radar /></div>
        </div>
        <div className="relative flex flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
          <LogoMark className="size-14" />
          <h2 id="cta-title" className="max-w-3xl text-balance font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[56px]">
            Arrêtez de vérifier. <span className="animate-gradient-pan bg-[linear-gradient(90deg,#00e5ff,#8aa4ff,#ed4df5,#00e5ff)] bg-[length:200%_100%] bg-clip-text text-transparent">Soyez prévenu.</span>
          </h2>
          <Link
            href="/inscription"
            className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-white px-9 text-base font-semibold text-[#0d0c2b] shadow-[0_10px_40px_-10px_rgba(255,255,255,0.5)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:hover:translate-y-0"
          >
            Commencer <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
          <p className="text-[13px] text-white/75">Essai gratuit de 3 jours, carte demandée, puis à partir de 9,99 € par mois.</p>
        </div>
      </div>
    </section>
  );
}
