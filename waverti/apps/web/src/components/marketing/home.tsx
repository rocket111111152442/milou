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
import { HomeDemo } from "./home-demo";

const H2 = "font-display text-[30px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[40px]";

/* ——————————————————————————— 1. Premier écran ——————————————————————————— */

export function HomeHero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -left-24 -top-24 size-[460px] animate-blob-a rounded-full bg-cyan/25 blur-3xl" />
        <div className="absolute -right-20 top-0 size-[520px] animate-blob-b rounded-full bg-violet/20 blur-3xl" />
        <div className="absolute bottom-[-180px] left-1/3 size-[480px] animate-blob-c rounded-full bg-pink/15 blur-3xl" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1.5 animate-gradient-pan bg-waverti-gradient-animated" />
      <Container className="relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
        <div className="flex flex-col items-start">
          <h1 id="hero-title" className="text-balance font-display text-[40px] font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-[56px] lg:text-[62px]">
            Un prix baisse. Une place se libère.{" "}
            <span className="animate-gradient-pan bg-waverti-gradient-animated bg-clip-text text-transparent">Vous êtes prévenu.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            Choisissez une page à suivre. Waverti la vérifie à votre place et vous avertit quand ce que vous attendez arrive.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/inscription">
                Commencer <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Link href="#comment-ca-marche" className="text-center text-sm font-semibold text-ink underline-offset-4 hover:underline sm:ml-2">
              Voir comment ça marche
            </Link>
          </div>
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
    <section id="comment-ca-marche" aria-labelledby="how-title" className="scroll-mt-20 pt-8 pb-16 sm:pt-10 sm:pb-20">
      <Container>
        <div className="max-w-2xl">
          <h2 id="how-title" className={H2}>
            Comment ça marche
          </h2>
          <p className="mt-3 text-lg text-ink-soft">Trois questions, et Waverti s'occupe des vérifications.</p>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i * 0.1} className="relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-line bg-white p-6 transition-transform duration-300 hover:-translate-y-1">
              <div className="flex items-center gap-3">
                <span className={cn("grid size-12 place-items-center rounded-2xl [&_svg]:size-6", s.tint)} aria-hidden="true">
                  {s.icon}
                </span>
                <span className="font-display text-sm font-bold text-muted-fg">Étape {s.n}</span>
              </div>
              <h3 className="font-display text-xl font-bold">{s.q}</h3>
              <p className="text-ink-soft">{s.a}</p>
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
    <section id="usages" aria-labelledby="uses-title" className="bg-surface py-16 sm:py-20">
      <Container>
        <h2 id="uses-title" className={H2}>
          Ce que vous pouvez confier à Waverti
        </h2>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {USES.map((u, i) => (
            <Reveal as="li" key={u.title} delay={i * 0.1} className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-soft transition-transform duration-300 hover:-translate-y-1">
              <span className={cn("grid size-14 place-items-center rounded-2xl bg-gradient-to-br text-white [&_svg]:size-7", u.tint)} aria-hidden="true">
                {u.icon}
              </span>
              <h3 className="font-display text-xl font-bold">{u.title}</h3>
              <p className="text-ink-soft">{u.goal}</p>
              <p className="mt-auto rounded-2xl bg-surface p-3 text-sm font-medium">{u.result}</p>
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
    <section id="business" aria-labelledby="business-title" className="py-16 sm:py-20">
      <Container>
        <div className="grid gap-8 rounded-3xl border border-line bg-white p-6 sm:p-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="flex flex-col items-start">
            <p className="text-sm font-semibold text-violet">Waverti Business</p>
            <h2 id="business-title" className="mt-2 font-display text-[28px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[34px]">
              Soyez le premier informé quand votre site a un problème.
            </h2>
            <p className="mt-3 text-ink-soft">Toutes les fonctions Pro, plus la surveillance de votre site professionnel.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild variant="secondary">
                <Link href="/entreprises">Découvrir Waverti Business</Link>
              </Button>
              <span className="text-sm text-muted-fg">49,99 € par mois TTC</span>
            </div>
          </div>
          <ul className="flex flex-col gap-3">
            {BUSINESS.map((b) => (
              <li key={b.title} className="flex items-center gap-3 text-ink-soft [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-violet">
                <span aria-hidden="true">{b.icon}</span>
                {b.title}
              </li>
            ))}
          </ul>
        </div>
      </Container>
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
              <Reveal as="li" key={id} delay={idx * 0.08} className={cn("flex flex-col rounded-3xl bg-white p-6 transition-transform duration-300 hover:-translate-y-1", highlighted ? "border-gradient shadow-lift" : "border border-line")}>
                <h3 className="font-display text-lg font-bold">{p.name}</h3>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-extrabold tabular-nums">{formatCents(p.priceCents)}</span>
                  <span className="text-sm text-muted-fg">/ mois</span>
                </p>
                <ul className="mt-4 flex flex-col gap-1.5 text-sm text-ink-soft">
                  <li>{p.maxMonitors} suivis</li>
                  <li className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-fg" aria-hidden="true" /> Vérification {formatInterval(p.pageIntervalMinutes)}
                  </li>
                  <li>{p.maxWebTopics} sujets de recherche sur Internet</li>
                  {p.businessSitesIncluded > 0 ? <li className="font-medium text-ink">+ surveillance de votre site</li> : null}
                </ul>
                <Button asChild variant={highlighted ? "primary" : "secondary"} className="mt-6">
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
    <section aria-labelledby="cta-title" className="py-16 sm:py-20">
      <Container>
        <div className="relative overflow-hidden rounded-[32px] bg-waverti-gradient p-[1px]">
          <div className="flex flex-col items-center gap-5 rounded-[31px] bg-white px-6 py-12 text-center sm:py-16">
            <LogoMark className="size-14" />
            <h2 id="cta-title" className="max-w-2xl text-balance font-display text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[44px]">
              Arrêtez de vérifier. <span className="animate-gradient-pan bg-waverti-gradient-animated bg-clip-text text-transparent">Soyez prévenu.</span>
            </h2>
            <Button asChild size="lg">
              <Link href="/inscription">
                Commencer <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <p className="text-[13px] text-muted-fg">Essai gratuit de 3 jours, carte demandée, puis à partir de 9,99 € par mois.</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
