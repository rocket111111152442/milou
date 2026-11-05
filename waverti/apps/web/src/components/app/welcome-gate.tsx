import { ArrowDown, ArrowRight, BellRing, CreditCard, ScanSearch, Sparkles, MousePointerClick } from "lucide-react";
import { ExampleAlert } from "@/components/visual/example-alert";

/** Premier écran d'un compte sans formule : accueil, promesse, accès direct au choix de la formule. */
export function WelcomeHero({ name, trialEligible, billing }: { name: string | null; trialEligible: boolean; billing: boolean }) {
  return (
    <section aria-labelledby="welcome-title" className="relative overflow-hidden rounded-[28px] border-2 border-ink bg-[#f1ece1] text-ink">
      <div className="relative grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:p-14">
        <div className="flex flex-col items-start gap-5">
          {trialEligible && billing ? (
            <span className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-[#ffd84d] px-3 py-1 text-xs font-bold uppercase tracking-wide">
              <Sparkles className="size-3.5" aria-hidden="true" /> 3 jours d'essai gratuit
            </span>
          ) : null}
          <h1 id="welcome-title" className="text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
            Bienvenue{name ? `, ${name}` : ""}.{" "}
            <span className="px-1 [box-decoration-break:clone] [background:linear-gradient(transparent_60%,#ffd84d_60%,#ffd84d_94%,transparent_94%)]">Votre espace est prêt.</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-ink-soft">
            {billing
              ? "Il ne manque qu'une formule pour l'activer. Choisissez-la en quelques clics : le reste du mode d'emploi se trouve juste en dessous."
              : "Les paiements ne sont pas encore ouverts : vous pouvez découvrir ce que Waverti proposera, sans qu'aucune donnée bancaire ne soit demandée."}
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <a href="#formules" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink px-6 text-sm font-semibold text-white shadow-[4px_4px_0_0_#245bff] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue motion-reduce:hover:translate-y-0">
              Choisir ma formule <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <a href="#mode-emploi" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-ink px-5 text-sm font-semibold hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">
              Voir le mode d'emploi <ArrowDown className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
        <div>
          <ExampleAlert />
          <p className="mt-1 text-center text-xs text-ink-soft">Illustration : un exemple, aucune donnée réelle.</p>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: <CreditCard />, title: "Choisissez une formule", text: "Quatre formules, résiliables en ligne. Un essai gratuit de 3 jours est proposé quand votre compte y a droit." },
  { icon: <MousePointerClick />, title: "Créez une surveillance", text: "Dites ce que vous voulez suivre (un prix, un stock, une page), collez l'adresse et choisissez le changement à détecter." },
  { icon: <ScanSearch />, title: "Waverti vérifie pour vous", text: "Les contrôles sont faits par nos serveurs, même ordinateur éteint, à la fréquence de votre formule." },
  { icon: <BellRing />, title: "Recevez l'alerte", text: "Dans Waverti, par e-mail ou sur votre ordinateur, avec la raison exacte de l'alerte." },
];

export function HowItWorks() {
  return (
    <section id="mode-emploi" aria-labelledby="howto-title" className="flex scroll-mt-24 flex-col gap-5">
      <div>
        <h2 id="howto-title" className="font-display text-xl font-semibold">
          Mode d'emploi en quatre étapes
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Vous n'avez rien à installer pour commencer : tout se passe depuis ce site.</p>
      </div>
      <ol className="relative grid gap-4 md:grid-cols-4">
        <span aria-hidden="true" className="absolute left-[12%] right-[12%] top-[34px] hidden h-0 border-t-2 border-dashed border-ink/40 md:block" />
        {STEPS.map((s, i) => (
          <li key={s.title} className="card-glass relative flex flex-col gap-3 rounded-2xl p-5 shadow-[var(--shadow-card)]">
            <span className="relative grid size-12 place-items-center rounded-2xl border-2 border-ink bg-[#ffd84d] text-ink shadow-[3px_3px_0_0_#111118] [&_svg]:size-5" aria-hidden="true">
              {s.icon}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Étape {i + 1}</span>
            <h3 className="font-display text-base font-bold leading-snug">{s.title}</h3>
            <p className="text-sm leading-relaxed text-ink-soft">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
