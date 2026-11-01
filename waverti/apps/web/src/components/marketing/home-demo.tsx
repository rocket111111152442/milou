"use client";
/**
 * Démonstration du fonctionnement (premier écran). Clairement étiquetée « Exemple de fonctionnement » :
 * aucune donnée réelle, aucun compte, aucun prix réel d'un commerçant.
 */
import * as React from "react";
import { BellRing, Calculator, Check, Sofa, Ticket } from "lucide-react";
import { cn } from "@waverti/ui";

export interface DemoExample {
  id: string;
  tab: string;
  icon: React.ReactNode;
  tint: string;
  follow: string;
  source: string;
  when: string;
  frequency: string;
  checks: Array<{ time: string; value: string; hit?: boolean }>;
  alert: { title: string; body: string };
}

export const DEMO_EXAMPLES: DemoExample[] = [
  {
    id: "prix",
    tab: "Un prix",
    icon: <Calculator />,
    tint: "from-blue to-violet",
    follow: "Calculatrice NumWorks",
    source: "La fiche produit que vous avez choisie",
    when: "Le prix passe sous 100 €",
    frequency: "Vérification toutes les 6 heures (formule Plus)",
    checks: [
      { time: "9 h 00", value: "109,90 € — rien à signaler" },
      { time: "15 h 00", value: "94,90 € — sous 100 €", hit: true },
    ],
    alert: { title: "Prix sous 100 €", body: "Calculatrice NumWorks : 94,90 € au lieu de 109,90 €." },
  },
  {
    id: "billets",
    tab: "Une billetterie",
    icon: <Ticket />,
    tint: "from-violet to-pink",
    follow: "Billets de concert",
    source: "La page de billetterie que vous avez choisie",
    when: "La vente ouvre (bouton « Réserver » ou mention « en vente »)",
    frequency: "Vérification toutes les 2 heures (formule Pro)",
    checks: [
      { time: "9 h 00", value: "« Mise en vente prochainement »" },
      { time: "11 h 00", value: "Bouton « Réserver » apparu", hit: true },
    ],
    alert: { title: "La billetterie est ouverte", body: "Billets de concert : un bouton « Réserver » est apparu sur la page." },
  },
  {
    id: "stock",
    tab: "Un retour en stock",
    icon: <Sofa />,
    tint: "from-cyan to-blue",
    follow: "Canapé convertible",
    source: "La fiche produit que vous avez choisie",
    when: "Le produit revient en stock",
    frequency: "Vérification toutes les heures (formule Max)",
    checks: [
      { time: "9 h 00", value: "« Rupture de stock »" },
      { time: "10 h 00", value: "« En stock »", hit: true },
    ],
    alert: { title: "De nouveau en stock", body: "Canapé convertible : le produit est de nouveau disponible." },
  },
];

/** Évite les coupures disgracieuses « 100 / € » ou « 9 h / 00 » sur téléphone. */
function nbsp(text: string): string {
  return text.replace(/(\d) (€|h)/g, "$1\u00a0$2").replace(/ h (\d)/g, "\u00a0h\u00a0$1");
}

export function HomeDemo() {
  const [active, setActive] = React.useState(0);
  const ex = DEMO_EXAMPLES[active]!;
  const tabs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : DEMO_EXAMPLES.length - 1)) % DEMO_EXAMPLES.length;
    setActive(next);
    tabs.current[next]?.focus();
  };
  return (
    <div className="relative rounded-[28px] border border-line bg-white p-4 shadow-lift sm:p-6" aria-labelledby="demo-label">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="demo-label" className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink-soft">
          <span className="size-1.5 rounded-full bg-waverti-gradient" aria-hidden="true" />
          Exemple de fonctionnement
        </p>
        <div role="tablist" aria-label="Choisir un exemple" className="flex gap-1 rounded-full bg-surface p-1">
          {DEMO_EXAMPLES.map((e, i) => (
            <button
              key={e.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              id={`demo-tab-${e.id}`}
              aria-selected={i === active}
              aria-controls="demo-panel"
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(k) => onKey(k, i)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue",
                i === active ? "bg-ink text-white" : "text-ink-soft hover:bg-white",
              )}
            >
              {e.tab}
            </button>
          ))}
        </div>
      </div>

      <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${ex.id}`} key={ex.id} className="animate-fade-up mt-5 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-soft [&_svg]:size-7", ex.tint)} aria-hidden="true">
            {ex.icon}
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold leading-tight">{ex.follow}</p>
            <p className="text-sm text-muted-fg">{ex.source}</p>
          </div>
        </div>
        <dl className="grid gap-2 rounded-2xl bg-surface p-4 text-sm sm:grid-cols-[110px_1fr]">
          <dt className="font-medium text-muted-fg">Prévenu quand</dt>
          <dd className="font-semibold">{nbsp(ex.when)}</dd>
          <dt className="font-medium text-muted-fg">Rythme</dt>
          <dd>{ex.frequency}</dd>
        </dl>
        <ol className="flex flex-col gap-2" aria-label="Vérifications de l'exemple">
          {ex.checks.map((c) => (
            <li key={c.time} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm", c.hit ? "border-violet/30 bg-violet/5" : "border-line")}>
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px]", c.hit ? "bg-violet text-white" : "bg-surface-strong text-ink-soft")} aria-hidden="true">
                {c.hit ? <BellRing className="size-3.5" /> : <Check className="size-3.5" />}
              </span>
              <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                <span className="whitespace-nowrap font-medium tabular-nums">Vérifié à {c.time}</span>
                <span className="text-ink-soft">{nbsp(c.value)}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex items-start gap-3 rounded-2xl bg-ink p-4 text-white">
          <BellRing className="mt-0.5 size-5 shrink-0 text-cyan" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Alerte reçue dans cet exemple</p>
            <p className="font-semibold">{nbsp(ex.alert.title)}</p>
            <p className="text-sm text-white/80">{nbsp(ex.alert.body)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
