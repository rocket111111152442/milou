"use client";
/**
 * Constructeur visuel de règles : conditions, ET / OU, groupes, exclusions, seuils, options de fiabilité.
 * Ne produit que des règles structurées (validées ensuite par le serveur) : aucun code n'est saisi.
 */
import * as React from "react";
import { Plus, Trash, Layers } from "lucide-react";
import { describeRule, ruleAtomSchema, ruleConditionSchema, type RuleAtom, type RuleAtomType, type RuleConditionInput } from "@waverti/types";
import { cn } from "../lib/cn";
import { Button } from "../components/button";
import { Checkbox, Switch } from "../components/controls";
import { Input, Label, Select } from "../components/form";

export interface AtomDef {
  type: RuleAtomType;
  label: string;
  group: "Prix" | "Produit et listes" | "Contenu de la page" | "Mots-clés" | "Dates et documents" | "Disponibilité";
  make: () => RuleAtom;
}

export const ATOM_DEFS: AtomDef[] = [
  { type: "price_below", label: "Prix inférieur à…", group: "Prix", make: () => ({ type: "price_below", value: 100, orEqual: false, currency: "EUR" }) },
  { type: "price_above", label: "Prix supérieur à…", group: "Prix", make: () => ({ type: "price_above", value: 100, orEqual: false, currency: "EUR" }) },
  { type: "price_drop", label: "Baisse de prix", group: "Prix", make: () => ({ type: "price_drop", minPercent: 0, minAmount: 0, reference: "previous" }) },
  { type: "price_rise", label: "Hausse de prix", group: "Prix", make: () => ({ type: "price_rise", minPercent: 0, minAmount: 0, reference: "previous" }) },
  { type: "promotion", label: "Prix barré affiché par le site", group: "Prix", make: () => ({ type: "promotion" }) },
  { type: "stock_is", label: "Disponibilité du produit", group: "Produit et listes", make: () => ({ type: "stock_is", state: "in_stock" }) },
  { type: "stock_changed", label: "La disponibilité change", group: "Produit et listes", make: () => ({ type: "stock_changed" }) },
  { type: "item_added", label: "Nouvel élément dans la liste (produit, offre, événement…)", group: "Produit et listes", make: () => ({ type: "item_added" }) },
  { type: "item_removed", label: "Élément retiré de la liste", group: "Produit et listes", make: () => ({ type: "item_removed" }) },
  { type: "page_changed", label: "Le contenu change", group: "Contenu de la page", make: () => ({ type: "page_changed", sensitivity: "significant" }) },
  { type: "title_changed", label: "Le titre de la page change", group: "Contenu de la page", make: () => ({ type: "title_changed" }) },
  { type: "heading_added", label: "Nouvelle rubrique (titre de section)", group: "Contenu de la page", make: () => ({ type: "heading_added" }) },
  { type: "link_added", label: "Nouveau lien", group: "Contenu de la page", make: () => ({ type: "link_added" }) },
  { type: "link_removed", label: "Lien supprimé", group: "Contenu de la page", make: () => ({ type: "link_removed" }) },
  { type: "table_changed", label: "Un tableau change", group: "Contenu de la page", make: () => ({ type: "table_changed" }) },
  { type: "element_present", label: "L'élément ciblé est présent", group: "Contenu de la page", make: () => ({ type: "element_present" }) },
  { type: "form_present", label: "Formulaire ou bouton d'inscription / réservation", group: "Contenu de la page", make: () => ({ type: "form_present" }) },
  { type: "text_match", label: "La page contient…", group: "Mots-clés", make: () => ({ type: "text_match", terms: [""], mode: "any", wholeWord: false, caseSensitive: false }) },
  { type: "text_absent", label: "La page ne contient pas…", group: "Mots-clés", make: () => ({ type: "text_absent", terms: [""], wholeWord: false, caseSensitive: false }) },
  { type: "sentence_changed", label: "Une phrase contenant… est modifiée", group: "Mots-clés", make: () => ({ type: "sentence_changed", term: "" }) },
  { type: "date_added", label: "Nouvelle date annoncée", group: "Dates et documents", make: () => ({ type: "date_added", futureOnly: true }) },
  { type: "document_added", label: "Nouveau document (PDF, Word…)", group: "Dates et documents", make: () => ({ type: "document_added" }) },
  { type: "document_removed", label: "Document retiré", group: "Dates et documents", make: () => ({ type: "document_removed" }) },
  { type: "document_link_changed", label: "Lien de téléchargement modifié", group: "Dates et documents", make: () => ({ type: "document_link_changed" }) },
  { type: "site_down", label: "Site inaccessible ou en erreur", group: "Disponibilité", make: () => ({ type: "site_down", includeHttpErrors: true }) },
  { type: "slow_response", label: "Temps de réponse trop élevé", group: "Disponibilité", make: () => ({ type: "slow_response", ms: 3000 }) },
  { type: "redirect_changed", label: "Redirection inattendue", group: "Disponibilité", make: () => ({ type: "redirect_changed" }) },
];
const DEF = new Map(ATOM_DEFS.map((d) => [d.type, d]));
const GROUPS = [...new Set(ATOM_DEFS.map((d) => d.group))];

const num = (v: string, fallback = 0) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};
const splitTerms = (v: string) => v.split(/[,\n;]+/).map((t) => t.trim()).slice(0, 10);

function TypeSelect({ id, value, onChange }: { id: string; value: RuleAtomType; onChange: (t: RuleAtomType) => void }) {
  return (
    <Select id={id} aria-label="Type de condition" value={value} onChange={(e) => onChange(e.target.value as RuleAtomType)} className="min-w-0 sm:max-w-80">
      {GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {ATOM_DEFS.filter((d) => d.group === g).map((d) => (
            <option key={d.type} value={d.type}>
              {d.label}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

/** Paramètres d'une condition (seulement ceux utiles au type choisi). */
function AtomParams({ atom, onChange, uid }: { atom: RuleAtom; onChange: (a: RuleAtom) => void; uid: string }) {
  const small = "h-9 text-sm";
  switch (atom.type) {
    case "price_below":
    case "price_above":
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor={`${uid}-v`} className="sr-only">
            Montant en euros
          </Label>
          <div className="flex items-center gap-1.5">
            <Input id={`${uid}-v`} inputMode="decimal" className={cn(small, "w-28")} value={String(atom.value)} onChange={(e) => onChange({ ...atom, value: num(e.target.value, atom.value) })} />
            <span className="text-sm text-muted-fg">€</span>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={atom.orEqual} onCheckedChange={(v) => onChange({ ...atom, orEqual: v === true })} /> ou égal
          </label>
        </div>
      );
    case "price_drop":
    case "price_rise":
      return (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-fg">d'au moins</span>
          <Input aria-label="Pourcentage minimal" inputMode="decimal" className={cn(small, "w-20")} value={String(atom.minPercent)} onChange={(e) => onChange({ ...atom, minPercent: Math.max(0, num(e.target.value)) })} />
          <span>%</span>
          <span className="text-muted-fg">et</span>
          <Input aria-label="Montant minimal en euros" inputMode="decimal" className={cn(small, "w-20")} value={String(atom.minAmount)} onChange={(e) => onChange({ ...atom, minAmount: Math.max(0, num(e.target.value)) })} />
          <span>€</span>
          <Select aria-label="Référence" className={cn(small, "w-auto")} value={atom.reference} onChange={(e) => onChange({ ...atom, reference: e.target.value as "previous" | "reference" })}>
            <option value="previous">par rapport au contrôle précédent</option>
            <option value="reference">par rapport au prix de départ</option>
          </Select>
        </div>
      );
    case "stock_is":
      return (
        <Select aria-label="État du stock" className={cn(small, "w-auto")} value={atom.state} onChange={(e) => onChange({ ...atom, state: e.target.value as typeof atom.state })}>
          <option value="in_stock">en stock</option>
          <option value="out_of_stock">en rupture</option>
          <option value="preorder">en précommande</option>
        </Select>
      );
    case "item_added":
    case "item_removed":
    case "link_added":
    case "link_removed":
    case "document_added":
    case "document_removed":
    case "heading_added":
      return (
        <Input
          aria-label="Contenant (facultatif)"
          placeholder="Contenant… (facultatif)"
          className={cn(small, "sm:max-w-64")}
          maxLength={120}
          value={atom.contains ?? ""}
          onChange={(e) => onChange({ ...atom, contains: e.target.value || undefined })}
        />
      );
    case "page_changed":
      return (
        <Select aria-label="Sensibilité" className={cn(small, "w-auto")} value={atom.sensitivity} onChange={(e) => onChange({ ...atom, sensitivity: e.target.value as "any" | "significant" })}>
          <option value="significant">changement significatif</option>
          <option value="any">toute modification</option>
        </Select>
      );
    case "text_match":
    case "text_absent":
      return (
        <div className="flex flex-col gap-2">
          <Input
            aria-label="Mots ou expressions, séparés par des virgules"
            placeholder="Mots ou expressions, séparés par des virgules (joker : *)"
            className={small}
            value={atom.terms.join(", ")}
            onChange={(e) => onChange({ ...atom, terms: splitTerms(e.target.value) })}
          />
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {atom.type === "text_match" ? (
              <Select aria-label="Correspondance" className={cn(small, "w-auto")} value={atom.mode} onChange={(e) => onChange({ ...atom, mode: e.target.value as "all" | "any" })}>
                <option value="any">au moins un (OU)</option>
                <option value="all">tous (ET)</option>
              </Select>
            ) : null}
            <label className="flex items-center gap-2">
              <Checkbox checked={atom.wholeWord} onCheckedChange={(v) => onChange({ ...atom, wholeWord: v === true })} /> Mots entiers
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={atom.caseSensitive} onCheckedChange={(v) => onChange({ ...atom, caseSensitive: v === true })} /> Respecter la casse
            </label>
          </div>
        </div>
      );
    case "sentence_changed":
      return <Input aria-label="Mot contenu dans la phrase" placeholder="Mot contenu dans la phrase" className={cn(small, "sm:max-w-64")} value={atom.term} onChange={(e) => onChange({ ...atom, term: e.target.value })} />;
    case "date_added":
      return (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={atom.futureOnly} onCheckedChange={(v) => onChange({ ...atom, futureOnly: v === true })} /> Dates à venir uniquement
        </label>
      );
    case "site_down":
      return (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={atom.includeHttpErrors} onCheckedChange={(v) => onChange({ ...atom, includeHttpErrors: v === true })} /> Compter aussi les erreurs HTTP (404, 500…)
        </label>
      );
    case "slow_response":
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-fg">au-delà de</span>
          <Input aria-label="Seuil en millisecondes" inputMode="numeric" className={cn(small, "w-24")} value={String(atom.ms)} onChange={(e) => onChange({ ...atom, ms: Math.round(num(e.target.value, atom.ms)) })} />
          <span>ms</span>
        </div>
      );
    default:
      return null;
  }
}

function AtomRow({ atom, onChange, onRemove, uid, canRemove }: { atom: RuleAtom; onChange: (a: RuleAtom) => void; onRemove: () => void; uid: string; canRemove: boolean }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line bg-white p-3 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <TypeSelect id={`${uid}-type`} value={atom.type} onChange={(t) => onChange(DEF.get(t)!.make())} />
        <div className="min-w-0 flex-1">
          <AtomParams atom={atom} onChange={onChange} uid={uid} />
        </div>
      </div>
      {canRemove ? (
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer cette condition" onClick={onRemove} className="self-end sm:self-start">
          <Trash aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
}

function MatchToggle({ value, onChange, label }: { value: "all" | "any"; onChange: (v: "all" | "any") => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-white p-0.5 text-xs font-medium">
      {(
        [
          ["all", "Toutes (ET)"],
          ["any", "Au moins une (OU)"],
        ] as const
      ).map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("rounded-full px-3 py-1.5 transition-colors", value === v ? "bg-ink text-white" : "text-ink-soft hover:bg-surface")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export interface EditableRule {
  category?: RuleConditionInput["category"];
  match: "all" | "any";
  conditions: RuleAtom[];
  groups: Array<{ match: "all" | "any"; conditions: RuleAtom[] }>;
  exclude: string[];
  options: { cooldownMinutes: number; confirm: boolean; notifyRecovery: boolean };
}

/** Complète les valeurs par défaut (les modèles peuvent laisser des champs à saisir, ex. un mot vide). */
function atomWithDefaults(a: unknown): RuleAtom {
  const parsed = ruleAtomSchema.safeParse(a);
  if (parsed.success) return parsed.data;
  const base = DEF.get((a as { type: RuleAtomType }).type)?.make();
  return { ...(base ?? {}), ...(a as object) } as RuleAtom;
}

export function normalizeRule(r: RuleConditionInput): EditableRule {
  return {
    category: r.category ?? "custom",
    match: r.match ?? "all",
    conditions: (r.conditions ?? []).map(atomWithDefaults),
    groups: (r.groups ?? []).map((g) => ({ match: g.match, conditions: g.conditions.map(atomWithDefaults) })),
    exclude: r.exclude ?? [],
    options: { cooldownMinutes: 0, confirm: false, notifyRecovery: false, ...(r.options ?? {}) },
  };
}

/** Valide la règle comme le fera le serveur ; renvoie un message lisible ou null. */
export function ruleProblem(r: EditableRule): string | null {
  const cleaned = { type: "rule" as const, ...r };
  const parsed = ruleConditionSchema.safeParse(cleaned);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  if (issue?.path.includes("terms") || issue?.path.includes("term")) return "Indiquez le ou les mots recherchés.";
  return issue?.message && !/^(Invalid|Too)/.test(issue.message) ? issue.message : "Vérifiez les valeurs des conditions.";
}

export function RuleBuilder({ value, onChange, id = "rb" }: { value: EditableRule; onChange: (r: EditableRule) => void; id?: string }) {
  const total = value.conditions.length + value.groups.reduce((n, g) => n + g.conditions.length, 0);
  const set = (patch: Partial<EditableRule>) => onChange({ ...value, ...patch });
  const problem = ruleProblem(value);
  const summary = problem ? [] : describeRule(ruleConditionSchema.parse({ type: "rule", ...value }));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">M'alerter quand</p>
        <MatchToggle value={value.match} onChange={(match) => set({ match })} label="Combinaison des conditions" />
      </div>
      <ul className="flex flex-col gap-2" aria-label="Conditions">
        {value.conditions.map((a, i) => (
          <AtomRow
            key={i}
            uid={`${id}-c${i}`}
            atom={a}
            canRemove={total > 1}
            onChange={(na) => set({ conditions: value.conditions.map((x, j) => (j === i ? na : x)) })}
            onRemove={() => set({ conditions: value.conditions.filter((_, j) => j !== i) })}
          />
        ))}
      </ul>
      {value.groups.map((g, gi) => (
        <fieldset key={gi} className="flex flex-col gap-2 rounded-xl border border-dashed border-line-strong bg-surface p-3">
          <legend className="sr-only">Groupe {gi + 1}</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink-soft">
              {value.match === "all" ? "ET" : "OU"} groupe {gi + 1}
            </span>
            <div className="flex items-center gap-2">
              <MatchToggle value={g.match} label={`Combinaison du groupe ${gi + 1}`} onChange={(m) => set({ groups: value.groups.map((x, j) => (j === gi ? { ...x, match: m } : x)) })} />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Supprimer le groupe ${gi + 1}`} onClick={() => set({ groups: value.groups.filter((_, j) => j !== gi) })}>
                <Trash aria-hidden="true" />
              </Button>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {g.conditions.map((a, i) => (
              <AtomRow
                key={i}
                uid={`${id}-g${gi}-${i}`}
                atom={a}
                canRemove={g.conditions.length > 1}
                onChange={(na) => set({ groups: value.groups.map((x, j) => (j === gi ? { ...x, conditions: x.conditions.map((y, k) => (k === i ? na : y)) } : x)) })}
                onRemove={() => set({ groups: value.groups.map((x, j) => (j === gi ? { ...x, conditions: x.conditions.filter((_, k) => k !== i) } : x)) })}
              />
            ))}
          </ul>
          {g.conditions.length < 6 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => set({ groups: value.groups.map((x, j) => (j === gi ? { ...x, conditions: [...x.conditions, DEF.get("text_match")!.make()] } : x)) })}
            >
              <Plus aria-hidden="true" /> Condition dans le groupe
            </Button>
          ) : null}
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        {value.conditions.length < 8 && total < 12 ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => set({ conditions: [...value.conditions, DEF.get("page_changed")!.make()] })}>
            <Plus aria-hidden="true" /> Ajouter une condition
          </Button>
        ) : null}
        {value.groups.length < 3 && total < 11 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => set({ groups: [...value.groups, { match: value.match === "all" ? "any" : "all", conditions: [DEF.get("text_match")!.make(), DEF.get("text_match")!.make()] }] })}
          >
            <Layers aria-hidden="true" /> Ajouter un groupe
          </Button>
        ) : null}
      </div>

      <details className="rounded-xl border border-line p-4">
        <summary className="cursor-pointer text-sm font-medium">Exclusions et fiabilité</summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-ex`}>Ne pas alerter si l'élément contient</Label>
            <Input
              id={`${id}-ex`}
              placeholder="ex. : reconditionné, occasion"
              value={value.exclude.join(", ")}
              onChange={(e) => set({ exclude: splitTerms(e.target.value).filter(Boolean) })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={`${id}-confirm`}>Confirmer au contrôle suivant avant d'alerter (évite les changements fugaces)</Label>
            <Switch id={`${id}-confirm`} checked={value.options.confirm ?? false} onCheckedChange={(v) => set({ options: { ...value.options, confirm: v } })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={`${id}-recovery`}>Prévenir aussi lors du retour à la normale</Label>
            <Switch id={`${id}-recovery`} checked={value.options.notifyRecovery ?? false} onCheckedChange={(v) => set({ options: { ...value.options, notifyRecovery: v } })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-cooldown`}>Délai minimal entre deux alertes</Label>
            <Select id={`${id}-cooldown`} value={value.options.cooldownMinutes ?? 0} onChange={(e) => set({ options: { ...value.options, cooldownMinutes: Number(e.target.value) } })} className="max-w-60">
              <option value={0}>Aucun</option>
              <option value={60}>1 heure</option>
              <option value={360}>6 heures</option>
              <option value={1440}>1 jour</option>
              <option value={10080}>7 jours</option>
            </Select>
          </div>
        </div>
      </details>

      {problem ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {problem}
        </p>
      ) : (
        <div className="rounded-xl bg-surface p-4" aria-live="polite">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-fg">En clair</p>
          <ul className="flex flex-col gap-1 text-sm">
            {summary.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
