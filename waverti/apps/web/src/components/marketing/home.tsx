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
import { ExampleAlert } from "@/components/visual/example-alert";
import { HomeDemo } from "./home-demo";

const H2 = "font-display text-[30px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[40px]";

/* ——————————————————————————— 1. Premier écran ——————————————————————————— */

export function HomeHero() {
  return (
    <section aria-labelledby="hero-title" className="relative px-3 pb-4 pt-2 sm:px-5">
      <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[28px] border-2 border-ink bg-[#f1ece1] text-ink">
        <div className="relative grid items-center gap-10 px-6 py-14 sm:px-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6 lg:py-20">
          <div className="flex flex-col items-start">
            <p className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide">
              <span aria-hidden="true" className="size-2 rounded-full bg-[#14946a]" />
              Suivi de prix, de stock et de pages
            </p>
            <h1 id="hero-title" className="mt-6 text-balance font-display text-[42px] font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-[58px] lg:text-[64px]">
              Un prix baisse. Une place se libère.{" "}
              <span className="px-1 [box-decoration-break:clone] [background:linear-gradient(transparent_60%,#ffd84d_60%,#ffd84d_94%,transparent_94%)]">Vous êtes prévenu.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Choisissez une page à suivre. Waverti la vérifie à votre place et vous avertit quand ce que vous attendez arrive.
            </p>
            <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link
                href="/inscription"
                className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full border-2 border-ink bg-ink px-8 text-base font-semibold text-white shadow-[4px_4px_0_0_#245bff] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue motion-reduce:hover:translate-y-0"
              >
                Commencer <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
              <Link href="#comment-ca-marche" className="text-center text-sm font-semibold underline underline-offset-4 sm:ml-3">
                Voir comment ça marche
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              <li className="flex items-center gap-2"><Clock className="size-4" aria-hidden="true" /> Vérifications par nos serveurs</li>
              <li className="flex items-center gap-2"><ShieldCheck className="size-4" aria-hidden="true" /> Résiliable en ligne</li>
              <li className="flex items-center gap-2"><Bell className="size-4" aria-hidden="true" /> Alerte seulement si ça change</li>
            </ul>
          </div>
          <div>
            <ExampleAlert />
            <p className="mt-1 text-center text-xs text-ink-soft">Illustration : un exemple, pas des données réelles.</p>
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
            <span className="text-2xl text-ink">✦</span>
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
                i === 0 ? "border-2 border-ink bg-[#ffd84d] text-ink lg:col-span-2 lg:row-span-2 lg:p-10" : "border border-line bg-white shadow-soft",
              )}
            >
              <span aria-hidden="true" className={cn("pointer-events-none absolute -right-6 -top-6 opacity-10 [&_svg]:size-44", i === 0 ? "text-ink" : "hidden")}>
                {u.icon}
              </span>
              <span className={cn("grid size-14 place-items-center rounded-2xl border-2 border-ink bg-white text-ink [&_svg]:size-7")} aria-hidden="true">
                {u.icon}
              </span>
              <h3 className={cn("font-display font-bold tracking-[-0.02em]", i === 0 ? "text-3xl sm:text-4xl" : "text-xl")}>{u.title}</h3>
              <p className={cn(i === 0 ? "max-w-md text-lg text-ink" : "text-ink-soft")}>{u.goal}</p>
              {i === 0 ? (
                <div aria-hidden="true" className="relative my-2 hidden flex-1 lg:block">
                  <svg viewBox="0 0 520 170" className="size-full max-h-[220px]" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="0" y1="112" x2="520" y2="112" stroke="#111118" strokeWidth="1.5" strokeDasharray="5 7" />
                    <text x="6" y="104" fill="#111118" fontSize="12" fontFamily="ui-monospace, monospace">votre seuil</text>
                    <path d="M0 40 L70 46 L130 36 L190 52 L250 44 L310 70 L370 66 L430 138 L520 142" stroke="#111118" strokeOpacity="0.35" strokeWidth="3" />
                    <path d="M0 40 L70 46 L130 36 L190 52 L250 44 L310 70 L370 66 L430 138 L520 142" stroke="#111118" strokeWidth="4" />
                    <circle cx="430" cy="138" r="8" fill="#245bff" stroke="#111118" strokeWidth="3" />
                  </svg>
                  <p className="text-[11px] text-ink">Illustration : un prix qui passe sous le seuil.</p>
                </div>
              ) : null}
              <p className={cn("mt-auto rounded-2xl p-4 text-sm font-medium", i === 0 ? "border-2 border-ink bg-white text-ink" : "bg-surface")}>{u.result}</p>
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
      <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[28px] border-2 border-ink bg-ink p-6 text-white sm:p-12">
        <div className="relative grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="flex flex-col items-start">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#ffd84d]">Waverti Business</p>
            <h2 id="business-title" className="mt-3 font-display text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[42px]">
              Soyez le premier informé quand votre site a un problème.
            </h2>
            <p className="mt-4 text-lg text-white/85">Toutes les fonctions Pro, plus la surveillance de votre site professionnel.</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link href="/entreprises" className="inline-flex h-12 items-center justify-center rounded-full bg-[#ffd84d] px-6 text-sm font-bold text-ink hover:bg-[#ffe27a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Découvrir Waverti Business
              </Link>
              <span className="text-sm text-white/75">49,99 € par mois TTC</span>
            </div>
          </div>
          <div>
            <div aria-hidden="true" className="rounded-2xl border-2 border-white/30 p-5">
              <div className="flex h-12 items-end gap-1">
                {Array.from({ length: 36 }, (_, i) => (
                  <span key={i} className={cn("flex-1 rounded-sm", i === 23 ? "h-7 bg-[#ed6a5a]" : "h-full bg-[#4ade80]")} />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-white/70">Illustration : l'historique d'un site surveillé (36 contrôles, un incident).</p>
            </div>
            <ul className="mt-6 flex flex-col gap-3">
              {BUSINESS.map((b) => (
                <li key={b.title} className="flex items-center gap-3 text-white/90 [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-[#ffd84d]">
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
              <Reveal as="li" key={id} delay={idx * 0.08} className={cn("flex flex-col rounded-[28px] p-6 transition-transform duration-300 hover:-translate-y-1", highlighted ? "border-2 border-ink bg-[#ffd84d] text-ink shadow-[6px_6px_0_0_#111118]" : "border border-line bg-white")}>
                {highlighted ? <span className="mb-3 w-fit rounded-md border-2 border-ink bg-white px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">Le plus choisi</span> : null}
                <h3 className="font-display text-lg font-bold">{p.name}</h3>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold tabular-nums">{formatCents(p.priceCents)}</span>
                  <span className={cn("text-sm", highlighted ? "text-ink" : "text-muted-fg")}>/ mois</span>
                </p>
                <ul className={cn("mt-4 flex flex-col gap-1.5 text-sm", highlighted ? "text-ink" : "text-ink-soft")}>
                  <li>{p.maxMonitors} suivis</li>
                  <li className="flex items-center gap-1.5">
                    <Clock className="size-3.5" aria-hidden="true" /> Vérification {formatInterval(p.pageIntervalMinutes)}
                  </li>
                  <li>{p.maxWebTopics} sujets de recherche sur Internet</li>
                  {p.businessSitesIncluded > 0 ? <li className="font-medium text-ink">+ surveillance de votre site</li> : null}
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
      <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[28px] border-2 border-ink bg-[#ffd84d] text-ink">
        <div className="relative flex flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
          <LogoMark className="size-14" />
          <h2 id="cta-title" className="max-w-3xl text-balance font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[56px]">
            Arrêtez de vérifier. Soyez prévenu.
          </h2>
          <Link
            href="/inscription"
            className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full border-2 border-ink bg-ink px-9 text-base font-semibold text-white shadow-[4px_4px_0_0_#245bff] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue motion-reduce:hover:translate-y-0"
          >
            Commencer <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
          <p className="text-[13px] text-ink">Essai gratuit de 3 jours, carte demandée, puis à partir de 9,99 € par mois.</p>
        </div>
      </div>
    </section>
  );
}
