"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock, PackageSearch, Store } from "lucide-react";
import { Badge, Button, Callout, Field, Input, StepProgress, Tip, cn } from "@waverti/ui";

const STEPS = ["Le produit", "Vos critères", "Résumé"];
const CONDITIONS = [
  { id: "new", label: "Neuf", hint: "Produit jamais utilisé, avec emballage." },
  { id: "refurbished", label: "Reconditionné", hint: "Remis à neuf par un professionnel." },
  { id: "used", label: "Occasion", hint: "Déjà utilisé." },
] as const;
type Condition = (typeof CONDITIONS)[number]["id"];

/**
 * Parcours guidé de recherche d'un produit (3 étapes + résumé).
 * Honnêteté : la recherche automatique dans plusieurs boutiques n'est pas encore ouverte aux utilisateurs
 * (elle attend les droits d'utilisation des résultats de recherche). Le parcours prépare la demande, la résume,
 * et propose dès maintenant la solution qui fonctionne : surveiller la page d'une boutique que l'on connaît.
 */
export function ProductSearchGuide() {
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [condition, setCondition] = React.useState<Condition>("new");
  const [budget, setBudget] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => heading.current?.focus(), [step]);

  function next() {
    if (step === 0 && name.trim().length < 3) {
      setError("Indiquez le nom du produit (3 caractères au moins).");
      return;
    }
    if (step === 1 && budget.trim() && !(Number(budget.replace(",", ".")) > 0)) {
      setError("Le budget doit être un nombre positif, par exemple 150.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(2, s + 1));
  }

  const cond = CONDITIONS.find((c) => c.id === condition)!;
  const budgetNum = Number(budget.replace(",", "."));

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-line/80 bg-white p-5 shadow-[var(--shadow-card)] sm:p-8">
      <StepProgress steps={STEPS} current={step} />

      {step === 0 ? (
        <section className="flex flex-col gap-5" aria-labelledby="ps-h0">
          <div>
            <h2 id="ps-h0" ref={heading} tabIndex={-1} className="font-display text-xl font-semibold outline-none">
              Quel produit cherchez-vous ?
            </h2>
            <p className="text-sm text-muted-fg">Le nom suffit. La marque ou la référence rendent la recherche plus précise.</p>
          </div>
          <Field id="ps-name" label="Nom du produit" required error={error}>
            {(p) => <Input {...p} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Casque Sony WH-1000XM5" />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ps-brand" label="Marque (facultatif)">
              {(p) => <Input {...p} value={brand} maxLength={80} onChange={(e) => setBrand(e.target.value)} placeholder="Ex. : Sony" />}
            </Field>
            <Field id="ps-ref" label="Référence ou code-barres (facultatif)" hint="On la trouve sur l'emballage ou la fiche du produit.">
              {(p) => <Input {...p} value={ref} maxLength={40} onChange={(e) => setRef(e.target.value)} placeholder="Ex. : WH1000XM5" />}
            </Field>
          </div>
          <Tip>Plus le produit est précis (modèle, capacité, couleur), moins vous verrez d'offres qui n'ont rien à voir.</Tip>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="flex flex-col gap-5" aria-labelledby="ps-h1">
          <div>
            <h2 id="ps-h1" ref={heading} tabIndex={-1} className="font-display text-xl font-semibold outline-none">
              Quelles sont vos conditions ?
            </h2>
            <p className="text-sm text-muted-fg">Nous écartons ce qui ne correspond pas : accessoires, autres modèles, offres d'occasion si vous voulez du neuf.</p>
          </div>
          <div role="radiogroup" aria-label="État du produit" className="grid gap-3 sm:grid-cols-3">
            {CONDITIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={condition === c.id}
                onClick={() => setCondition(c.id)}
                className={cn(
                  "flex flex-col gap-1 rounded-2xl border p-4 text-left transition-colors",
                  condition === c.id ? "border-blue bg-info-soft ring-2 ring-blue/20" : "border-line bg-white hover:border-line-strong",
                )}
              >
                <span className="flex items-center justify-between font-medium">
                  {c.label}
                  {condition === c.id ? <Check className="size-4 text-blue" aria-hidden="true" /> : null}
                </span>
                <span className="text-xs text-muted-fg">{c.hint}</span>
              </button>
            ))}
          </div>
          <Field id="ps-budget" label="Budget maximum en euros (facultatif)" error={error} hint="Vous serez prévenu seulement si une offre passe sous ce montant.">
            {(p) => <Input {...p} inputMode="decimal" value={budget} maxLength={9} onChange={(e) => setBudget(e.target.value)} placeholder="Ex. : 250" className="max-w-48" />}
          </Field>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="flex flex-col gap-5" aria-labelledby="ps-h2">
          <div>
            <h2 id="ps-h2" ref={heading} tabIndex={-1} className="font-display text-xl font-semibold outline-none">
              Résumé de votre recherche
            </h2>
            <p className="text-sm text-muted-fg">Vérifiez que tout est correct.</p>
          </div>
          <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm sm:grid-cols-2">
            {[
              ["Produit", name.trim()],
              ["Marque", brand.trim() || "Non précisée"],
              ["Référence", ref.trim() || "Non précisée"],
              ["État", cond.label],
              ["Budget", budgetNum > 0 ? `${budgetNum.toLocaleString("fr-FR")} € maximum` : "Aucune limite"],
              ["Devise et pays", "Euros · France"],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-4 py-3">
                <dt className="text-xs text-muted-fg">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <Callout tone="info" icon={<Clock />} title="La comparaison automatique entre boutiques arrive bientôt">
            Nous finalisons les autorisations nécessaires pour chercher dans plusieurs boutiques. Votre demande n'est donc pas encore envoyée : rien n'est enregistré à cette étape.
          </Callout>

          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
                <Store className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-medium">Dès aujourd'hui : suivez le prix dans une boutique</p>
                <p className="text-sm text-muted-fg">Collez l'adresse de la page du produit : vous êtes prévenu à chaque baisse ou retour en stock.</p>
              </div>
            </div>
            <Button asChild variant="primary" className="shrink-0">
              <Link href="/app/surveillances/nouvelle?categorie=price">
                Surveiller une page <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-fg">
            <Badge tone="outline">
              <PackageSearch aria-hidden="true" /> Recherche multi-boutiques
            </Badge>
            <span>en préparation</span>
          </div>
        </section>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-line/70 pt-5">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => { setError(null); setStep((s) => s - 1); }}>
            <ArrowLeft aria-hidden="true" /> Retour
          </Button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <Button type="button" variant="primary" onClick={next}>
            Continuer <ArrowRight aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
