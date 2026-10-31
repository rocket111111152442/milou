/**
 * Règles de surveillance personnalisées (moteur de règles côté serveur).
 *
 * Une règle combine des conditions élémentaires (« atomes ») avec ET / OU, des groupes, des exclusions et des
 * options de fiabilité (confirmation, délai minimal entre deux alertes, retour à la normale). Elle est évaluée
 * UNIQUEMENT côté serveur, de façon déterministe : aucun code fourni par l'utilisateur n'est exécuté (pas de
 * JavaScript, pas d'expression régulière libre — seulement des termes avec joker « * » bornés).
 *
 * Chaque atome correspond à une donnée réellement collectée par l'extracteur (prix, disponibilité, liens, titres,
 * documents, dates, éléments de catalogue, tableaux, formulaires, statut HTTP, temps de réponse).
 */
import { z } from "zod";

const term = z.string().trim().min(1).max(120);
const terms = z.array(term).min(1).max(10);
const optionalContains = z.string().trim().max(120).optional();
const money = z.number().positive().max(10_000_000);

export const ruleAtomSchema = z.discriminatedUnion("type", [
  // ——— Prix ———
  z.object({ type: z.literal("price_below"), value: money, orEqual: z.boolean().default(false), currency: z.string().length(3).default("EUR") }),
  z.object({ type: z.literal("price_above"), value: money, orEqual: z.boolean().default(false), currency: z.string().length(3).default("EUR") }),
  z.object({
    type: z.literal("price_drop"),
    minPercent: z.number().min(0).max(95).default(0),
    minAmount: z.number().min(0).max(10_000_000).default(0),
    /** previous : par rapport au contrôle précédent ; reference : par rapport au prix relevé à la création. */
    reference: z.enum(["previous", "reference"]).default("previous"),
  }),
  z.object({
    type: z.literal("price_rise"),
    minPercent: z.number().min(0).max(1000).default(0),
    minAmount: z.number().min(0).max(10_000_000).default(0),
    reference: z.enum(["previous", "reference"]).default("previous"),
  }),
  /** Prix barré affiché par le site (prix de référence supérieur au prix actuel). */
  z.object({ type: z.literal("promotion") }),
  // ——— Produits ———
  z.object({ type: z.literal("stock_is"), state: z.enum(["in_stock", "out_of_stock", "preorder"]) }),
  z.object({ type: z.literal("stock_changed") }),
  z.object({ type: z.literal("item_added"), contains: optionalContains }),
  z.object({ type: z.literal("item_removed"), contains: optionalContains }),
  // ——— Pages ———
  z.object({ type: z.literal("page_changed"), sensitivity: z.enum(["any", "significant"]).default("significant") }),
  z.object({ type: z.literal("title_changed") }),
  z.object({ type: z.literal("heading_added"), contains: optionalContains }),
  z.object({ type: z.literal("link_added"), contains: optionalContains }),
  z.object({ type: z.literal("link_removed"), contains: optionalContains }),
  z.object({ type: z.literal("table_changed") }),
  /** L'élément ciblé par le sélecteur de la surveillance est présent sur la page. */
  z.object({ type: z.literal("element_present") }),
  z.object({ type: z.literal("form_present") }),
  // ——— Mots-clés ———
  z.object({
    type: z.literal("text_match"),
    terms,
    mode: z.enum(["all", "any"]).default("any"),
    wholeWord: z.boolean().default(false),
    caseSensitive: z.boolean().default(false),
  }),
  z.object({ type: z.literal("text_absent"), terms, wholeWord: z.boolean().default(false), caseSensitive: z.boolean().default(false) }),
  z.object({ type: z.literal("sentence_changed"), term }),
  // ——— Événements / documents ———
  z.object({ type: z.literal("date_added"), futureOnly: z.boolean().default(true) }),
  z.object({ type: z.literal("document_added"), contains: optionalContains }),
  z.object({ type: z.literal("document_removed"), contains: optionalContains }),
  z.object({ type: z.literal("document_link_changed") }),
  // ——— Disponibilité ———
  z.object({ type: z.literal("site_down"), includeHttpErrors: z.boolean().default(true) }),
  z.object({ type: z.literal("slow_response"), ms: z.number().int().min(300).max(60_000) }),
  z.object({ type: z.literal("redirect_changed") }),
]);
export type RuleAtom = z.infer<typeof ruleAtomSchema>;
export type RuleAtomType = RuleAtom["type"];

export const ruleGroupSchema = z.object({
  match: z.enum(["all", "any"]),
  conditions: z.array(ruleAtomSchema).min(1).max(6),
});

export const ruleOptionsSchema = z
  .object({
    /** Délai minimal entre deux alertes (minutes). */
    cooldownMinutes: z.number().int().min(0).max(10_080).default(0),
    /** N'alerter que si la situation est encore observée au contrôle suivant (évite les changements fugaces). */
    confirm: z.boolean().default(false),
    /** Prévenir aussi lorsque la situation revient à la normale (ex. site de nouveau accessible). */
    notifyRecovery: z.boolean().default(false),
  })
  .default({ cooldownMinutes: 0, confirm: false, notifyRecovery: false });

export const ruleConditionSchema = z
  .object({
    type: z.literal("rule"),
    version: z.literal(1).default(1),
    /** Catégorie choisie à la création (affichage uniquement). */
    category: z
      .enum(["price", "product", "page", "keyword", "event", "company", "news", "uptime", "document", "custom"])
      .default("custom"),
    match: z.enum(["all", "any"]).default("all"),
    conditions: z.array(ruleAtomSchema).max(8).default([]),
    groups: z.array(ruleGroupSchema).max(3).default([]),
    /** Termes d'exclusion : un élément (ou une page) qui les contient ne déclenche pas d'alerte. */
    exclude: z.array(term).max(10).default([]),
    options: ruleOptionsSchema,
  })
  .superRefine((r, ctx) => {
    const all = [...r.conditions, ...r.groups.flatMap((g) => g.conditions)];
    if (all.length === 0) ctx.addIssue({ code: "custom", message: "Ajoutez au moins une condition." });
    if (all.length > 12) ctx.addIssue({ code: "custom", message: "12 conditions au maximum par règle." });
    const uptime = all.filter((a) => UPTIME_ATOMS.has(a.type));
    if (uptime.length && uptime.length !== all.length && r.match === "all") {
      ctx.addIssue({
        code: "custom",
        message: "Les conditions de disponibilité (site inaccessible, lenteur, redirection) ne peuvent pas être combinées avec « ET » à des conditions sur le contenu : quand le site est inaccessible, son contenu n'est pas lisible.",
      });
    }
    const doubles = new Set<string>();
    for (const a of all) {
      const key = JSON.stringify(a);
      if (doubles.has(key)) ctx.addIssue({ code: "custom", message: "Une même condition apparaît deux fois." });
      doubles.add(key);
    }
  });
export type RuleCondition = z.infer<typeof ruleConditionSchema>;
export type RuleConditionInput = z.input<typeof ruleConditionSchema>;

export const UPTIME_ATOMS: ReadonlySet<RuleAtomType> = new Set(["site_down", "slow_response", "redirect_changed"]);
/** Atomes « événement » : vrais uniquement au contrôle où l'événement est observé. */
export const EVENT_ATOMS: ReadonlySet<RuleAtomType> = new Set([
  "stock_changed",
  "item_added",
  "item_removed",
  "page_changed",
  "title_changed",
  "heading_added",
  "link_added",
  "link_removed",
  "table_changed",
  "sentence_changed",
  "date_added",
  "document_added",
  "document_removed",
  "document_link_changed",
  "redirect_changed",
]);

export function ruleAtoms(r: Pick<RuleCondition, "conditions" | "groups">): RuleAtom[] {
  return [...r.conditions, ...r.groups.flatMap((g) => g.conditions)];
}

const STOCK_LABEL = { in_stock: "en stock", out_of_stock: "en rupture de stock", preorder: "en précommande" } as const;

function eur(n: number, currency = "EUR"): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${currency === "EUR" ? "€" : currency}`;
}
const q = (s: string) => `« ${s} »`;
const containsSuffix = (c?: string) => (c ? ` contenant ${q(c)}` : "");

/** Description en français d'une condition élémentaire (résumé avant création, détail d'une surveillance). */
export function describeAtom(a: RuleAtom): string {
  switch (a.type) {
    case "price_below":
      return `Le prix est ${a.orEqual ? "inférieur ou égal" : "inférieur"} à ${eur(a.value, a.currency)}`;
    case "price_above":
      return `Le prix est ${a.orEqual ? "supérieur ou égal" : "supérieur"} à ${eur(a.value, a.currency)}`;
    case "price_drop":
    case "price_rise": {
      const verb = a.type === "price_drop" ? "baisse" : "augmente";
      const parts = [a.minPercent > 0 ? `d'au moins ${a.minPercent} %` : null, a.minAmount > 0 ? `d'au moins ${eur(a.minAmount)}` : null].filter(Boolean);
      const ref = a.reference === "reference" ? "par rapport au prix relevé à la création" : "par rapport au contrôle précédent";
      return `Le prix ${verb}${parts.length ? ` ${parts.join(" et ")}` : ""} ${ref}`;
    }
    case "promotion":
      return "Le site affiche un prix barré (prix de référence supérieur au prix actuel)";
    case "stock_is":
      return `Le produit est ${STOCK_LABEL[a.state]}`;
    case "stock_changed":
      return "La disponibilité du produit change";
    case "item_added":
      return `Un nouvel élément apparaît dans la liste${containsSuffix(a.contains)}`;
    case "item_removed":
      return `Un élément disparaît de la liste${containsSuffix(a.contains)}`;
    case "page_changed":
      return a.sensitivity === "any" ? "Le contenu change (même légèrement)" : "Le contenu change de façon significative (plus de 2 %)";
    case "title_changed":
      return "Le titre de la page change";
    case "heading_added":
      return `Une nouvelle rubrique (titre de section) apparaît${containsSuffix(a.contains)}`;
    case "link_added":
      return `Un nouveau lien apparaît${containsSuffix(a.contains)}`;
    case "link_removed":
      return `Un lien disparaît${containsSuffix(a.contains)}`;
    case "table_changed":
      return "Un tableau de la page change";
    case "element_present":
      return "L'élément ciblé est présent sur la page";
    case "form_present":
      return "Un formulaire d'inscription ou de réservation est présent";
    case "text_match": {
      const list = a.terms.map(q).join(a.mode === "all" ? " et " : " ou ");
      return `La page contient ${list}${a.wholeWord ? " (mots entiers)" : ""}${a.caseSensitive ? " (casse respectée)" : ""}`;
    }
    case "text_absent":
      return `La page ne contient pas ${a.terms.map(q).join(" ni ")}`;
    case "sentence_changed":
      return `Une phrase contenant ${q(a.term)} est modifiée`;
    case "date_added":
      return a.futureOnly ? "Une nouvelle date à venir apparaît" : "Une nouvelle date apparaît";
    case "document_added":
      return `Un nouveau document (PDF, Word, Excel…) est publié${containsSuffix(a.contains)}`;
    case "document_removed":
      return `Un document disparaît${containsSuffix(a.contains)}`;
    case "document_link_changed":
      return "Le lien de téléchargement d'un document change";
    case "site_down":
      return `Le site est inaccessible${a.includeHttpErrors ? " ou répond par une erreur" : ""} (confirmé sur 2 contrôles)`;
    case "slow_response":
      return `Le temps de réponse dépasse ${a.ms} ms (confirmé sur 2 contrôles)`;
    case "redirect_changed":
      return "La page redirige vers une autre adresse qu'auparavant";
  }
}

/** Résumé lisible d'une règle complète (une ligne par élément). */
export function describeRule(r: RuleCondition): string[] {
  const joiner = r.match === "all" ? "ET" : "OU";
  const lines = r.conditions.map((a, i) => `${i === 0 ? "" : `${joiner} `}${describeAtom(a)}`);
  r.groups.forEach((g, gi) => {
    const inner = g.conditions.map(describeAtom).join(g.match === "all" ? " ET " : " OU ");
    lines.push(`${lines.length === 0 && gi === 0 ? "" : `${joiner} `}(${inner})`);
  });
  if (r.exclude.length) lines.push(`Sauf si ${r.exclude.map(q).join(" ou ")} figure dans l'élément concerné`);
  if (r.options.confirm) lines.push("Alerte uniquement si la situation est confirmée au contrôle suivant");
  if (r.options.cooldownMinutes > 0) lines.push(`Au plus une alerte toutes les ${formatMinutes(r.options.cooldownMinutes)}`);
  if (r.options.notifyRecovery) lines.push("Prévenir aussi lors du retour à la normale");
  return lines;
}

function formatMinutes(m: number): string {
  if (m % 1440 === 0) return `${m / 1440} jour${m >= 2880 ? "s" : ""}`;
  if (m % 60 === 0) return `${m / 60} h`;
  return `${m} min`;
}
