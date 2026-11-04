"use client";
/**
 * Création d'une surveillance en 4 étapes : catégorie → configuration → résumé → création.
 * Toute la validation est refaite côté serveur (quotas, fréquence, faisabilité de la règle) : ce composant guide
 * l'utilisateur mais n'est jamais une barrière de sécurité. Rien n'est présenté comme disponible s'il ne l'est pas.
 */
import * as React from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Building,
  CalendarDays,
  FileText,
  Globe,
  Lock,
  MousePointerClick,
  Newspaper,
  Package,
  ScanSearch,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Type,
  WandSparkles,
} from "lucide-react";
import {
  describeRule,
  formatInterval,
  formatPrice,
  parseRuleRequest,
  ruleAtoms,
  ruleConditionSchema,
  supportsBrowserCondition,
  type CreateMonitorInput,
  type PageAnalysis,
  type RuleConditionInput,
  type RuleSuggestion,
  type WebTopicIntent,
} from "@waverti/types";
import { cn } from "../lib/cn";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { Callout } from "../components/feedback";
import { StepProgress, Tip } from "../components/blocks";
import { Checkbox, Switch } from "../components/controls";
import { Field, Input, Label, Select, Textarea } from "../components/form";
import type { FormEntitlements, PreviewResult, SubmitResult, TopicPlan } from "./monitor-form";
import { normalizeRule, RuleBuilder, ruleProblem, type EditableRule } from "./rule-builder";

export interface WizardEntitlements extends FormEntitlements {
  planName: string | null;
  maxMonitors: number;
  businessSites: number;
}

export interface PageBlockOption {
  selector: string;
  label: string;
  sample: string;
  kind: string;
}

export interface AnalysisResult extends PreviewResult {
  analysis?: PageAnalysis;
  suggestions?: RuleSuggestion[];
  blocks?: PageBlockOption[];
}

type BrowserMonitoringReading = Pick<PageAnalysis, "price" | "currency" | "availability"> & { observedAt: string };

type CategoryId = NonNullable<RuleConditionInput["category"]>;
type WizardExecutionMode = "auto" | "browser_only";

interface Goal {
  id: string;
  title: string;
  desc: string;
  /** Règle de départ (ajustable dans le constructeur). */
  rule?: () => RuleConditionInput;
  /** Recherche élargie sur Internet (moteur de recherche) au lieu d'une page. */
  topic?: WebTopicIntent;
  needsZone?: boolean;
  /** Fonction réservée à l'offre Business (configurée dans l'espace Business). */
  business?: boolean;
}

interface Category {
  id: CategoryId;
  title: string;
  desc: string;
  icon: React.ReactNode;
  goals: Goal[];
  /** Ce que l'utilisateur doit fournir. */
  target: string;
  expected: string;
}

const R = (category: CategoryId, conditions: RuleConditionInput["conditions"], extra: Partial<RuleConditionInput> = {}) => (): RuleConditionInput => ({
  type: "rule",
  category,
  conditions,
  ...extra,
});
const OPEN_TERMS = ["inscriptions ouvertes", "inscription ouverte", "s'inscrire", "je m'inscris"];
const TICKET_TERMS = ["billetterie ouverte", "acheter des billets", "réserver", "en vente"];

export const CATEGORIES: Category[] = [
  {
    id: "price",
    title: "Prix",
    desc: "Baisse, hausse, seuil, réduction, prix barré.",
    icon: <Tag />,
    target: "l'adresse d'une fiche produit",
    expected: "Une alerte quand le prix relevé sur la page remplit la condition — pas à chaque contrôle tant qu'il reste identique.",
    goals: [
      { id: "below", title: "Prix inférieur à une valeur", desc: "Ex. : sous 200 €.", rule: R("price", [{ type: "price_below", value: 200 }]) },
      { id: "target", title: "Prix atteignant une valeur cible", desc: "Inférieur ou égal au montant choisi.", rule: R("price", [{ type: "price_below", value: 100, orEqual: true }]) },
      { id: "drop", title: "Toute baisse de prix", desc: "Par rapport au contrôle précédent.", rule: R("price", [{ type: "price_drop" }]) },
      { id: "drop-pct", title: "Réduction d'au moins X %", desc: "Par rapport au prix relevé à la création.", rule: R("price", [{ type: "price_drop", minPercent: 15, reference: "reference" }]) },
      { id: "variation", title: "Variation d'au moins X €", desc: "Baisse ou hausse.", rule: R("price", [{ type: "price_drop", minAmount: 10 }, { type: "price_rise", minAmount: 10 }], { match: "any" }) },
      { id: "rise", title: "Hausse de prix", desc: "Par rapport au contrôle précédent.", rule: R("price", [{ type: "price_rise" }]) },
      { id: "above", title: "Prix supérieur à une valeur", desc: "Ex. : revente, budget dépassé.", rule: R("price", [{ type: "price_above", value: 100 }]) },
      { id: "promo", title: "Prix barré affiché", desc: "Seulement si le site affiche lui-même un prix de référence barré.", rule: R("price", [{ type: "promotion" }]) },
    ],
  },
  {
    id: "product",
    title: "Produits",
    desc: "Stock, nouveautés, variantes, catalogue.",
    icon: <Package />,
    target: "l'adresse d'un produit ou d'une page de catégorie / catalogue",
    expected: "Une alerte par changement réel. Un produit déjà vu qui réapparaît n'est pas signalé comme nouveau ; publicités et recommandations sont ignorées.",
    goals: [
      { id: "back", title: "Retour en stock", desc: "Le produit redevient disponible.", rule: R("product", [{ type: "stock_is", state: "in_stock" }]) },
      { id: "out", title: "Rupture de stock", desc: "Le produit devient indisponible.", rule: R("product", [{ type: "stock_is", state: "out_of_stock" }]) },
      { id: "avail", title: "Changement de disponibilité", desc: "En stock, rupture, précommande.", rule: R("product", [{ type: "stock_changed" }]) },
      { id: "new", title: "Nouveau produit dans une catégorie", desc: "Sur une page de catégorie ou de catalogue que vous indiquez.", rule: R("product", [{ type: "item_added" }]) },
      { id: "model", title: "Nouveau modèle ou variante", desc: "Nouvel élément dont le nom contient un mot (ex. « Pro »).", rule: R("product", [{ type: "item_added", contains: "" }]) },
      { id: "catalog", title: "Modification du catalogue", desc: "Produit ajouté ou retiré.", rule: R("product", [{ type: "item_added" }, { type: "item_removed" }], { match: "any" }) },
      { id: "specs", title: "Changement de caractéristiques", desc: "Tableau ou zone des caractéristiques modifié.", rule: R("product", [{ type: "page_changed", sensitivity: "any" }]), needsZone: true },
    ],
  },
  {
    id: "page",
    title: "Pages web",
    desc: "Contenu, titre, section, liens, tableaux.",
    icon: <Globe />,
    target: "l'adresse de la page",
    expected: "Une alerte avec un exemple de ce qui a changé. Horloges, publicités, bandeaux de cookies et menus sont ignorés.",
    goals: [
      { id: "any", title: "Modification générale", desc: "Changements significatifs du contenu.", rule: R("page", [{ type: "page_changed" }]) },
      { id: "section", title: "Modification d'une section précise", desc: "Choisissez la zone après l'analyse de la page.", rule: R("page", [{ type: "page_changed", sensitivity: "any" }]), needsZone: true },
      { id: "title", title: "Modification du titre", desc: "Titre de la page.", rule: R("page", [{ type: "title_changed" }]) },
      { id: "paragraph", title: "Modification d'un paragraphe", desc: "Phrase contenant un mot que vous indiquez.", rule: R("page", [{ type: "sentence_changed", term: "" }]) },
      { id: "link-add", title: "Ajout d'un nouveau lien", desc: "Dans le contenu principal.", rule: R("page", [{ type: "link_added" }]) },
      { id: "link-del", title: "Suppression d'un lien", desc: "Dans le contenu principal.", rule: R("page", [{ type: "link_removed" }]) },
      { id: "element", title: "Apparition d'un élément identifié", desc: "Bouton, bloc ou mention : choisissez l'élément.", rule: R("page", [{ type: "element_present" }]), needsZone: true },
      { id: "heading", title: "Nouvelle rubrique", desc: "Nouveau titre de section.", rule: R("page", [{ type: "heading_added" }]) },
      { id: "table", title: "Modification d'un tableau", desc: "Tarifs, horaires, résultats…", rule: R("page", [{ type: "table_changed" }]) },
    ],
  },
  {
    id: "keyword",
    title: "Mots-clés",
    desc: "Apparition, disparition, phrase exacte, ET / OU.",
    icon: <Type />,
    target: "l'adresse de la page à lire",
    expected: "Une alerte quand le texte apparaît (ou disparaît), puis plus rien tant que la situation ne change pas.",
    goals: [
      { id: "appear", title: "Apparition d'un mot", desc: "Ex. : « inscription ».", rule: R("keyword", [{ type: "text_match", terms: [""], wholeWord: true }]) },
      { id: "disappear", title: "Disparition d'un mot", desc: "Ex. : « complet ».", rule: R("keyword", [{ type: "text_absent", terms: [""] }]) },
      { id: "phrase", title: "Apparition d'une phrase exacte", desc: "La phrase entière, telle quelle.", rule: R("keyword", [{ type: "text_match", terms: [""] }]) },
      { id: "any", title: "Une expression parmi plusieurs", desc: "Au moins une (OU).", rule: R("keyword", [{ type: "text_match", terms: ["", ""], mode: "any" }]) },
      { id: "all", title: "Plusieurs mots en même temps", desc: "Tous présents (ET).", rule: R("keyword", [{ type: "text_match", terms: ["", ""], mode: "all" }]) },
      { id: "zone", title: "Mot dans une section précise", desc: "Choisissez la zone après l'analyse.", rule: R("keyword", [{ type: "text_match", terms: [""] }]), needsZone: true },
      { id: "sentence", title: "Modification d'une phrase existante", desc: "Phrase contenant un mot donné.", rule: R("keyword", [{ type: "sentence_changed", term: "" }]) },
    ],
  },
  {
    id: "event",
    title: "Événements",
    desc: "Inscriptions, billetterie, nouvelles dates.",
    icon: <CalendarDays />,
    target: "la page officielle de l'événement, de la billetterie ou du calendrier",
    expected: "Une alerte quand la page annonce l'ouverture ou de nouvelles dates. Waverti ne connaît pas le nombre de places en temps réel.",
    goals: [
      { id: "signup", title: "Ouverture des inscriptions", desc: "Formulaire ou mention « inscriptions ouvertes ».", rule: R("event", [{ type: "form_present" }, { type: "text_match", terms: OPEN_TERMS }], { match: "any" }) },
      { id: "tickets", title: "Ouverture d'une billetterie", desc: "Mention de mise en vente ou bouton de réservation.", rule: R("event", [{ type: "text_match", terms: TICKET_TERMS }, { type: "form_present" }], { match: "any", exclude: ["bientôt", "prochainement"] }) },
      { id: "dates", title: "Nouvelles dates", desc: "Une date à venir apparaît.", rule: R("event", [{ type: "date_added" }]) },
      { id: "places", title: "Places de nouveau disponibles", desc: "La mention « complet » disparaît.", rule: R("event", [{ type: "text_absent", terms: ["complet", "épuisé", "sold out"] }]) },
      { id: "calendar", title: "Publication d'un calendrier", desc: "Nouveau document ou nouvelles dates.", rule: R("event", [{ type: "document_added" }, { type: "date_added" }], { match: "any" }) },
      { id: "session", title: "Nouvelle session ou nouvel événement", desc: "Nouvel élément dans la liste.", rule: R("event", [{ type: "item_added" }]) },
      { id: "booking", title: "Ouverture d'une réservation", desc: "Un formulaire ou bouton de réservation apparaît.", rule: R("event", [{ type: "form_present" }]) },
    ],
  },
  {
    id: "company",
    title: "Entreprises",
    desc: "Offres d'emploi, annonces, produits, pages officielles.",
    icon: <Building />,
    target: "une page de l'entreprise (carrières, actualités, catalogue)",
    expected: "Une alerte pour chaque nouvelle offre ou publication sur la page, sans doublon.",
    goals: [
      { id: "jobs", title: "Nouvelle offre d'emploi", desc: "Sur la page carrières de l'entreprise.", rule: R("company", [{ type: "item_added" }]) },
      { id: "news", title: "Nouvelle annonce ou publication", desc: "Sur la page d'actualités de l'entreprise.", rule: R("company", [{ type: "item_added" }, { type: "heading_added" }], { match: "any" }) },
      { id: "product", title: "Nouveau produit", desc: "Sur la page catalogue.", rule: R("company", [{ type: "item_added" }]) },
      { id: "catalog", title: "Modification d'un catalogue", desc: "Élément ajouté ou retiré.", rule: R("company", [{ type: "item_added" }, { type: "item_removed" }], { match: "any" }) },
      { id: "official", title: "Mise à jour d'une page officielle", desc: "Changements significatifs.", rule: R("company", [{ type: "page_changed" }]) },
      { id: "service", title: "Annonce d'un nouveau service", desc: "Nouvelle rubrique sur la page.", rule: R("company", [{ type: "heading_added" }]) },
      { id: "web-jobs", title: "Offres de l'entreprise sur Internet", desc: "Recherche élargie (quota de recherches).", topic: "job_offer" },
      { id: "web-news", title: "Information concernant l'entreprise", desc: "Recherche élargie, sources officielles en priorité.", topic: "announcement" },
    ],
  },
  {
    id: "news",
    title: "Actualités",
    desc: "Sujet en langage naturel, sources vérifiées.",
    icon: <Newspaper />,
    target: "votre sujet, en une phrase",
    expected: "Une alerte par nouvelle information, avec sa source. Les annonces officielles sont distinguées des rumeurs ; une même actualité n'est jamais renvoyée deux fois.",
    goals: [
      { id: "announcement", title: "Nouvelle annonce officielle", desc: "Ex. : « Samsung annonce un nouveau Galaxy ».", topic: "announcement" },
      { id: "release", title: "Sortie d'un produit / nouvelle version", desc: "Date de sortie, version d'un logiciel.", topic: "release_date" },
      { id: "publication", title: "Communiqué, réglementation, résultat", desc: "Publication officielle.", topic: "official_publication" },
      { id: "jobs", title: "Offres (emploi, stage)", desc: "Nouvelles offres publiées.", topic: "job_offer" },
      { id: "generic", title: "Toute nouvelle information", desc: "Sur un sujet, une entreprise, un événement.", topic: "generic" },
    ],
  },
  {
    id: "uptime",
    title: "Disponibilité de sites",
    desc: "Panne, erreurs, lenteur, redirection.",
    icon: <Activity />,
    target: "l'adresse d'un site que vous êtes autorisé à surveiller",
    expected: "Une panne n'est signalée qu'après 2 échecs consécutifs ; vous êtes prévenu du retour à la normale. Contrôles depuis un seul emplacement (serveurs Waverti).",
    goals: [
      { id: "down", title: "Site inaccessible ou en erreur", desc: "Avec alerte de retour à la normale.", rule: R("uptime", [{ type: "site_down" }], { options: { notifyRecovery: true } }) },
      { id: "slow", title: "Temps de réponse anormalement élevé", desc: "Confirmé sur 2 contrôles.", rule: R("uptime", [{ type: "slow_response", ms: 3000 }]) },
      { id: "redirect", title: "Redirection inattendue", desc: "La page renvoie ailleurs qu'auparavant.", rule: R("uptime", [{ type: "redirect_changed" }]) },
      { id: "critical", title: "Modification d'une page critique", desc: "Toute modification du contenu.", rule: R("uptime", [{ type: "page_changed", sensitivity: "any" }]) },
      { id: "tls", title: "Certificat HTTPS, contrôles chaque minute, scénario navigateur", desc: "Surveillance professionnelle (offre Business).", business: true },
    ],
  },
  {
    id: "document",
    title: "Documents",
    desc: "PDF modifié, nouvelle version, nouveau document.",
    icon: <FileText />,
    target: "l'adresse d'un PDF, ou de la page qui publie les documents",
    expected: "Une alerte à chaque nouvelle version (empreinte du fichier). Le texte du PDF est comparé quand il est lisible ; fichiers limités à 8 Mo, jamais exécutés.",
    goals: [
      { id: "pdf", title: "Modification d'un PDF / nouvelle version", desc: "Indiquez l'adresse du fichier PDF.", rule: R("document", [{ type: "page_changed", sensitivity: "any" }]) },
      { id: "text", title: "Changement du texte d'un PDF", desc: "Quand le texte est lisible.", rule: R("document", [{ type: "page_changed", sensitivity: "significant" }]) },
      { id: "new", title: "Nouveau document publié sur une page", desc: "PDF, Word, Excel…", rule: R("document", [{ type: "document_added" }]) },
      { id: "new-title", title: "Nouveau document dont le titre contient…", desc: "Ex. : « résultats ».", rule: R("document", [{ type: "document_added", contains: "" }]) },
      { id: "removed", title: "Disparition d'un document", desc: "Retiré de la page.", rule: R("document", [{ type: "document_removed" }]) },
      { id: "link", title: "Modification d'un lien de téléchargement", desc: "Même document, nouvelle adresse.", rule: R("document", [{ type: "document_link_changed" }]) },
    ],
  },
  {
    id: "custom",
    title: "Personnalisée",
    desc: "Vos propres règles : conditions, ET / OU, exclusions.",
    icon: <SlidersHorizontal />,
    target: "l'adresse de la page",
    expected: "Une alerte uniquement quand l'ensemble de vos conditions est rempli, avec l'explication de la raison.",
    goals: [{ id: "builder", title: "Construire ma règle", desc: "Combinez les conditions disponibles.", rule: R("custom", [{ type: "page_changed" }]) }],
  },
];
const CAT = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Objectif proposé par défaut pour une catégorie : le premier qui est disponible dans la formule et se crée depuis l'assistant. */
function defaultGoal(id: CategoryId, topicsAllowed: boolean): Goal {
  const c = CAT.get(id)!;
  return c.goals.find((g) => !g.business && (!g.topic || topicsAllowed)) ?? c.goals[0]!;
}

function intervalOptions(min: number): number[] {
  const base = [60, 120, 240, 360, 720, 1440, 2880, 10080];
  return [...new Set([min, ...base.filter((m) => m > min)])].sort((a, b) => a - b);
}

function isAmazonProductUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)amazon\.(?:com|fr|de|it|es|ca|nl|se|pl|be|ie|in|sg|ae|sa|eg|co\.uk|co\.jp|com\.(?:au|be|br|mx|tr))$/.test(host);
  } catch {
    return false;
  }
}

function availabilityLabel(value: string | undefined): string | null {
  switch (value) {
    case "in_stock": return "Disponible";
    case "out_of_stock": return "Rupture";
    case "preorder": return "Précommande";
    default: return null;
  }
}

function browserPageHref(value: string): string | null {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

const STEPS = ["Que surveiller", "Site ou produit", "Changement", "Alertes", "Activation"] as const;

/** Une couleur d'icône par catégorie : repère visuel sans dépendre du texte. */
const CATEGORY_TILE = [
  "bg-[linear-gradient(135deg,#1d3fd6,#3b6bff)] text-white",
  "bg-[linear-gradient(135deg,#5a2de0,#8a3bff)] text-white",
  "bg-[linear-gradient(135deg,#0b7350,#14946a)] text-white",
  "bg-[linear-gradient(135deg,#8a3b00,#c26a00)] text-white",
  "bg-[linear-gradient(135deg,#a8142d,#d4304a)] text-white",
] as const;
/** Fond de chaque tuile de catégorie : teinte douce assortie à son icône (texte sombre dessus, contraste ≥ 12:1). */
const CATEGORY_SURFACE = [
  "border-blue/15 bg-[linear-gradient(160deg,#dfe8ff,#f1f5ff)] hover:border-blue/40",
  "border-violet/15 bg-[linear-gradient(160deg,#ece0ff,#f7f1ff)] hover:border-violet/40",
  "border-success/15 bg-[linear-gradient(160deg,#d9f3e8,#eef9f4)] hover:border-success/40",
  "border-warning/20 bg-[linear-gradient(160deg,#ffe9c2,#fff6e3)] hover:border-warning/40",
  "border-danger/15 bg-[linear-gradient(160deg,#ffdce2,#fff0f2)] hover:border-danger/40",
] as const;

export function MonitorWizard({
  entitlements,
  onPreview,
  onPlanTopic,
  onSubmit,
  upgradeHref,
  businessHref,
  initialCategory,
  initialUrl,
  browserExtensionHref,
  browserMonitoringUrl,
  browserMonitoringReading,
  browserMonitoringAvailable = false,
}: {
  entitlements: WizardEntitlements;
  onPreview: (url: string, cssSelector?: string) => Promise<AnalysisResult>;
  onPlanTopic: (request: string, officialDomains: string[]) => Promise<TopicPlan | null>;
  onSubmit: (input: CreateMonitorInput) => Promise<SubmitResult>;
  upgradeHref?: string;
  businessHref?: string;
  initialCategory?: CategoryId;
  initialUrl?: string;
  browserExtensionHref?: string;
  browserMonitoringUrl?: string;
  browserMonitoringReading?: BrowserMonitoringReading;
  browserMonitoringAvailable?: boolean;
}) {
  const topicsAllowed = entitlements.maxWebTopics > 0 && entitlements.webIntervalMinutes !== null;
  const [step, setStep] = React.useState(initialCategory ? 1 : 0);
  const [category, setCategory] = React.useState<CategoryId | null>(initialCategory ?? null);
  // Arrivée directe sur une catégorie (lien, bouton) : l'objectif par défaut est présélectionné, comme après un clic sur la tuile.
  const initialGoal = initialCategory ? defaultGoal(initialCategory, topicsAllowed) : null;
  const [goalId, setGoalId] = React.useState<string | null>(initialGoal?.id ?? null);
  const [rule, setRule] = React.useState<EditableRule>(
    initialGoal?.rule && initialCategory
      ? normalizeRule({ ...initialGoal.rule(), category: initialCategory })
      : normalizeRule({ type: "rule", conditions: [{ type: "page_changed" }] }),
  );
  const [assistant, setAssistant] = React.useState("");
  const [assistantNotes, setAssistantNotes] = React.useState<string[]>([]);
  const [url, setUrl] = React.useState(initialUrl ?? "");
  const [executionMode, setExecutionMode] = React.useState<WizardExecutionMode | null>(
    browserMonitoringUrl
      ? browserMonitoringAvailable && initialUrl?.trim() === browserMonitoringUrl ? "browser_only" : "auto"
      : "auto",
  );
  const [selector, setSelector] = React.useState("");
  const [preview, setPreview] = React.useState<AnalysisResult | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [previewAcknowledged, setPreviewAcknowledged] = React.useState(false);
  const previewRequest = React.useRef(0);
  const [request, setRequest] = React.useState("");
  const [domains, setDomains] = React.useState("");
  const [plan, setPlan] = React.useState<TopicPlan | null>(null);
  const [planning, setPlanning] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [requireOfficial, setRequireOfficial] = React.useState(true);
  const [customName, setCustomName] = React.useState<string | null>(null);
  const [notifyEmail, setNotifyEmail] = React.useState(entitlements.emailAlerts);
  const [notifyDesktop, setNotifyDesktop] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  /** Nature de la cible saisie à l'étape 2 (« page » ou « sujet ») : si l'objectif choisi ensuite en demande une autre, on la redemande. */
  const [targetKind, setTargetKind] = React.useState<"page" | "topic" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [stepError, setStepError] = React.useState<string | null>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const urlRef = React.useRef<HTMLInputElement>(null);

  const cat = category ? CAT.get(category)! : null;
  const goal = cat?.goals.find((g) => g.id === goalId) ?? null;
  const isTopic = !!goal?.topic || category === "news";
  const name = customName ?? (isTopic ? subject || request : (preview?.observation?.title ?? url)).slice(0, 100);
  const minInterval = isTopic ? (entitlements.webIntervalMinutes ?? 1440) : entitlements.pageIntervalMinutes;
  const [interval, setIntervalValue] = React.useState<number>(minInterval);
  React.useEffect(() => setIntervalValue(minInterval), [minInterval]);
  React.useEffect(() => {
    headingRef.current?.focus();
  }, [step]);
  React.useEffect(() => setPreviewAcknowledged(false), [url, selector, rule, preview, executionMode, browserMonitoringReading]);

  const parsedDomains = domains
    .split(/[,\s]+/)
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
    .filter(Boolean)
    .slice(0, 5);

  function chooseCategory(id: CategoryId) {
    setCategory(id);
    pickGoal(defaultGoal(id, topicsAllowed), id);
    setStep(1);
  }

  function pickGoal(g: Goal, catId: CategoryId | null = category) {
    setGoalId(g.id);
    if (g.rule) setRule(normalizeRule({ ...g.rule(), category: catId ?? "custom" }));
    setStepError(null);
  }

  function interpret() {
    const text = assistant.trim();
    if (text.length < 5) return;
    const r = parseRuleRequest(text);
    if (r.rule) {
      setCategory("custom");
      setGoalId("builder");
      setRule(normalizeRule(r.rule));
      setAssistantNotes(r.notes);
      setStep(1);
    } else if (topicsAllowed) {
      setCategory("news");
      setGoalId("generic");
      setRequest(text);
      setAssistantNotes(["Aucune condition de page reconnue : votre demande est préparée comme une recherche d'actualités. Vous pouvez aussi choisir une catégorie."]);
      setStep(1);
    } else {
      setAssistantNotes(r.notes);
    }
  }

  function changeUrl(nextUrl: string) {
    setUrl(nextUrl);
    if (nextUrl.trim() === url.trim()) return;
    if (executionMode === "browser_only" && nextUrl.trim() !== browserMonitoringUrl) setExecutionMode("auto");
    previewRequest.current += 1;
    setPreview(null);
    setPreviewing(false);
  }

  function chooseAnotherProduct() {
    urlRef.current?.focus();
    urlRef.current?.select();
  }

  async function analysePage() {
    const requestId = ++previewRequest.current;
    setPreviewing(true);
    setPreview(null);
    try {
      const result = await onPreview(url.trim(), selector.trim() || undefined);
      if (requestId === previewRequest.current) setPreview(result);
    } catch {
      if (requestId === previewRequest.current) {
        setPreview({ ok: false, error: { code: "preview_failed", message: "Analyse impossible." } });
      }
    } finally {
      if (requestId === previewRequest.current) setPreviewing(false);
    }
  }

  async function analyseTopic() {
    setPlanning(true);
    const p = await onPlanTopic(request.trim(), parsedDomains);
    setPlanning(false);
    if (p) {
      setPlan(p);
      setSubject(p.condition.subject);
      setRequireOfficial(p.condition.requireOfficial);
    }
  }

  function validateTarget(): string | null {
    if (isTopic) {
      if (!topicsAllowed) return "La recherche sur Internet n'est pas incluse dans votre formule.";
      return request.trim().length < 5 ? "Décrivez le sujet à surveiller (au moins quelques mots)." : null;
    }
    if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(url.trim())) return "Indiquez une adresse complète, commençant par https://";
    return null;
  }

  function validateChange(): string | null {
    if (goal?.business) return "Cette surveillance se configure dans l'espace Business.";
    const t = validateTarget();
    if (t) return t;
    if (!isTopic && goal?.needsZone && !selector.trim()) return "Choisissez la zone ou l'élément à surveiller (analysez la page, ou saisissez un sélecteur CSS).";
    return (isTopic ? null : ruleProblem(rule)) ?? executionProblem;
  }

  function next() {
    const problem = step === 1 ? validateTarget() : step === 2 ? validateChange() : null;
    setStepError(problem);
    if (problem) return;
    if (step === 1) setTargetKind(isTopic ? "topic" : "page");
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function back() {
    setStepError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function buildInput(mode: WizardExecutionMode): CreateMonitorInput {
    const notify = { inapp: true, email: notifyEmail && entitlements.emailAlerts, desktop: notifyDesktop };
    if (isTopic) {
      const intent = goal?.topic ?? plan?.condition.intent ?? "generic";
      return {
        kind: "web_topic",
        name: name.trim() || (subject || request).slice(0, 100),
        request: request.trim(),
        condition: { type: "web_topic", intent, subject: (subject || plan?.condition.subject || request).slice(0, 200), keywords: plan?.condition.keywords ?? [], requireOfficial },
        officialDomains: parsedDomains,
        intervalMinutes: interval,
        notify,
      };
    }
    return {
      kind: "page",
      name: name.trim() || url.trim().slice(0, 100),
      url: url.trim(),
      cssSelector: selector.trim() || undefined,
      renderMode: "auto",
      condition: ruleConditionSchema.parse({ type: "rule", ...rule, category: category ?? "custom" }),
      intervalMinutes: interval,
      executionMode: mode,
      notify,
    };
  }

  async function create() {
    setError(null);
    const problem = validateChange();
    if (problem || !executionMode) {
      setError(problem ?? "Le mode automatique n’est pas disponible pour cette surveillance.");
      return;
    }
    let input: CreateMonitorInput;
    try {
      input = buildInput(executionMode);
    } catch {
      setError("La règle n'est pas valide : revenez à l'étape précédente.");
      return;
    }
    setSubmitting(true);
    const r = await onSubmit(input);
    setSubmitting(false);
    if (!r.ok) setError(r.message ?? "La surveillance n'a pas pu être créée.");
  }

  const obs = preview?.observation;
  const analysis = preview?.analysis;
  const chromeReading = browserMonitoringAvailable && url.trim() === browserMonitoringUrl ? browserMonitoringReading : undefined;
  const browserOnly = executionMode === "browser_only";
  const separateServerPreview = browserOnly || Boolean(chromeReading);
  const serverPriceDetected = obs?.price != null && Boolean(obs.currency);
  const stockLabel = availabilityLabel(obs?.availability);
  const chromeStockLabel = availabilityLabel(chromeReading?.availability);
  const chromePriceDetected = chromeReading?.price != null && Boolean(chromeReading.currency);
  const atoms = ruleAtoms({ conditions: rule.conditions, groups: rule.groups });
  const needsPrice = atoms.some((atom) => atom.type.startsWith("price_") || atom.type === "promotion");
  const needsStock = atoms.some((atom) => atom.type === "stock_is" || atom.type === "stock_changed");
  const missingPrice = needsPrice && !(browserOnly ? chromePriceDetected : serverPriceDetected);
  const missingStock = needsStock && !(browserOnly ? chromeStockLabel : stockLabel);
  const missingSignals = [missingPrice ? "le prix et sa devise" : null, missingStock ? "la disponibilité" : null]
    .filter(Boolean)
    .join(" et ");
  const missingPreviewSignals = [
    !serverPriceDetected && (category === "price" || needsPrice) ? "le prix et sa devise" : null,
    !stockLabel && (category === "price" || category === "product" || needsStock) ? "la disponibilité" : null,
  ].filter(Boolean).join(" et ");
  const completedPreview = browserOnly ? Boolean(chromeReading) : preview !== null && !previewing;
  const needsPreviewConfirmation = !isTopic && completedPreview && Boolean(missingSignals);
  const showProductFallback = !browserOnly && preview !== null && !previewing && Boolean(missingPreviewSignals);
  const browserPage = showProductFallback && browserExtensionHref ? browserPageHref(url) : null;
  const verificationLabel = separateServerPreview ? "Vérifier depuis les serveurs" : "Vérifier la page";
  const detectedElements = category === "price" ? stockLabel ?? "Non détectée sur la page" : [
    analysis?.items.length ? `${analysis.items.length}+ éléments de liste` : null,
    analysis?.documents.length ? `${analysis.documents.length} document(s)` : null,
    analysis?.futureDates.length ? `${analysis.futureDates.length} date(s) à venir` : null,
    analysis?.signupForm ? "formulaire d'inscription" : null,
    stockLabel ? `stock : ${stockLabel.toLowerCase()}` : null,
  ].filter(Boolean).join(" · ") || "contenu textuel";
  const parsedRule = !isTopic && !ruleProblem(rule) ? ruleConditionSchema.parse({ type: "rule", ...rule }) : null;
  const ruleLines = parsedRule ? describeRule(parsedRule) : [];
  const browserUnavailable =
    !browserMonitoringAvailable ? "Reliez et activez l’extension Chrome dans votre compte."
      : url.trim() !== browserMonitoringUrl ? "Autorisez cette adresse exacte depuis l’extension Chrome."
        : !parsedRule || !supportsBrowserCondition(parsedRule) ? "Chrome peut suivre le prix ou le stock d’un produit."
          : selector.trim() ? "Chrome lit la fiche entière. Retirez le sélecteur CSS pour utiliser ce mode." : null;
  const executionProblem = executionMode === "browser_only" ? browserUnavailable : null;
  const usesUptime = atoms.some((a) => a.type === "site_down" || a.type === "slow_response");
  const needsOtherTarget = step === 2 && targetKind !== null && targetKind !== (isTopic ? "topic" : "page");

  /** Saisie de la cible : une adresse (page, produit) ou un sujet à rechercher sur Internet. */
  const targetFields = isTopic ? (
    <div className="flex flex-col gap-5">
      <Field id="wz-request" label="Quel sujet voulez-vous suivre ?" required hint="Ex. : « Préviens-moi lorsque Samsung annonce officiellement un nouveau Galaxy ».">
        {(p) => <Textarea {...p} rows={3} maxLength={500} value={request} onChange={(e) => setRequest(e.target.value)} />}
      </Field>
      <Field id="wz-domains" label="Sites officiels que vous connaissez (facultatif)" hint="Adresses séparées par des virgules. Leurs publications sont considérées comme officielles.">
        {(p) => <Input {...p} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="samsung.com" />}
      </Field>
      <div>
        <Button type="button" variant="secondary" onClick={analyseTopic} loading={planning} disabled={request.trim().length < 5}>
          <Sparkles aria-hidden="true" /> Analyser la demande
        </Button>
      </div>
      {plan ? (
        <div className="flex flex-col gap-3 rounded-xl border border-success/20 bg-tint-green p-4" role="status" aria-live="polite">
          <Field id="wz-subject" label="Sujet retenu" hint="Vérifiez et corrigez si besoin.">
            {(p) => <Input {...p} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />}
          </Field>
          <p className="text-xs text-ink-soft">{plan.queries.length} recherche(s) par vérification, décomptées de votre quota mensuel de recherches.</p>
        </div>
      ) : null}
    </div>
  ) : (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field id="wz-url" label="Adresse de la page" required hint="Copiez l'adresse depuis votre navigateur (elle commence par https://)." className="flex-1">
          {(p) => <Input {...p} ref={urlRef} type="url" inputMode="url" placeholder="https://www.exemple.fr/…" value={url} onChange={(e) => changeUrl(e.target.value)} />}
        </Field>
        {!chromeReading ? (
          <Button type="button" variant="secondary" onClick={analysePage} loading={previewing} disabled={!/^https?:\/\/.+\..+/.test(url.trim())}>
            <ScanSearch aria-hidden="true" /> {verificationLabel}
          </Button>
        ) : null}
      </div>
      {chromeReading ? (
        <Callout tone="info" title="Relevé ponctuel de Chrome" role="status">
          <dl className="mb-2 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs">Prix dans Chrome</dt>
              <dd className="font-medium">{chromeReading.price !== null && chromeReading.currency ? formatPrice(chromeReading.price, chromeReading.currency) : "Non détecté"}</dd>
            </div>
            <div>
              <dt className="text-xs">Disponibilité dans Chrome</dt>
              <dd className="font-medium">{chromeStockLabel ?? "Non détectée"}</dd>
            </div>
          </dl>
          <p className="text-xs">
            Relevé à <time dateTime={chromeReading.observedAt}>{new Date(chromeReading.observedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time>.
            Le suivi automatique utilisera ses propres contrôles après l’activation.
          </p>
        </Callout>
      ) : null}
      {previewing ? <div className="skeleton h-20 rounded-xl" aria-label={separateServerPreview ? "Analyse des serveurs en cours" : "Analyse en cours"} /> : null}
      {preview?.error ? (
        <Callout tone="warning" title={separateServerPreview ? "Vérification ponctuelle côté serveur indisponible" : "Cette page n'a pas pu être lue"} role="status">
          {preview.error.message} {separateServerPreview
            ? "Ce test est indépendant du relevé Chrome."
            : "Vous pouvez tout de même continuer : Waverti réessaiera à chaque vérification."}
        </Callout>
      ) : null}
      {obs && separateServerPreview ? (
        <Callout tone="neutral" title="Vérification ponctuelle par les serveurs" role="status">
          <p>
            Prix côté serveur {obs.price !== null && obs.currency ? formatPrice(obs.price, obs.currency) : "non détecté"}.
            {" "}Disponibilité côté serveur {(stockLabel ?? "non détectée").toLowerCase()}.
          </p>
          <p className="mt-1 text-xs">Ce test est indépendant du relevé Chrome.</p>
        </Callout>
      ) : obs ? (
        <div
          className={cn(
            "grid gap-3 rounded-xl border p-4",
            missingPreviewSignals ? "border-line bg-surface" : "border-success/20 bg-tint-green",
            detectedElements ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
          role="status"
          aria-live="polite"
        >
          <div className="min-w-0">
            <p className="text-xs text-ink-soft">{analysis?.contentKind === "pdf" ? "Document trouvé" : "Page trouvée"}</p>
            <p className="truncate text-sm font-medium">{obs.title ?? "Sans titre"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-soft">Prix repéré</p>
            <p className="font-display text-base font-semibold">
              {obs.price === null ? "Non détecté" : obs.currency ? formatPrice(obs.price, obs.currency) : "Devise non détectée"}
              {obs.price !== null && obs.currency && analysis?.regularPrice && analysis.regularPrice > obs.price ? (
                <span className="ml-2 text-xs font-normal text-ink-soft line-through">{formatPrice(analysis.regularPrice, obs.currency)}</span>
              ) : null}
            </p>
          </div>
          {detectedElements ? (
            <div>
              <p className="text-xs text-ink-soft">{category === "price" ? "Disponibilité" : "Autres éléments repérés"}</p>
              <p className="text-sm">{detectedElements}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {showProductFallback ? (
        <Callout tone="warning" title={separateServerPreview ? "Données manquantes côté serveur" : "Données de la fiche incomplètes"}>
          <p>
            {isAmazonProductUrl(obs?.finalUrl ?? url)
              ? obs
                ? "La version de la fiche Amazon reçue par Waverti est incomplète."
                : "Waverti n’a pas pu lire cette fiche Amazon."
              : "Waverti n’a pas trouvé toutes les données sur cette fiche."}{" "}
            Impossible de confirmer {missingPreviewSignals}.
          </p>
          <p className="mt-2">
            Collez l’adresse directe du produit chez le vendeur, puis cliquez sur « {verificationLabel} ». Une fiche d’un autre
            vendeur correspond à une offre différente.
          </p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={chooseAnotherProduct}>
            Vérifier une autre fiche
          </Button>
          {browserExtensionHref ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
              <p className="font-medium">Le prix ou le stock est visible dans Chrome ?</p>
              <p>
                Ouvrez la fiche dans Chrome et reliez l’extension Waverti à votre compte. Dans l’extension, activez les contrôles,
                puis cliquez sur « Autoriser cette page et ouvrir Waverti ». Vous pourrez ensuite activer la surveillance dans Waverti.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <a className="font-medium text-blue underline underline-offset-4" href={browserExtensionHref} download>
                  Télécharger l’extension Chrome
                </a>
                {browserPage ? (
                  <a className="font-medium text-blue underline underline-offset-4" href={browserPage} target="_blank" rel="noreferrer">
                    Ouvrir la fiche
                  </a>
                ) : null}
              </div>
              <details>
                <summary className="cursor-pointer">Installer l’extension</summary>
                <p className="mt-2">Décompressez le fichier, ouvrez chrome://extensions, activez le mode développeur, puis choisissez « Charger l’extension non empaquetée ». Sélectionnez le dossier décompressé et connectez-vous à Waverti dans Chrome.</p>
              </details>
            </div>
          ) : null}
        </Callout>
      ) : null}
    </div>
  );

  const nav = (props: { onBack: () => void; onNext?: () => void; nextLabel?: string; disabled?: boolean }) => (
    <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-between">
      <Button type="button" variant="ghost" onClick={props.onBack}>
        <ArrowLeft aria-hidden="true" /> Retour
      </Button>
      {props.onNext ? (
        <Button type="button" onClick={props.onNext} disabled={props.disabled}>
          {props.nextLabel ?? "Continuer"} <ArrowRight aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );

  const heading = (id: string, title: string, sub?: React.ReactNode) => (
    <div>
      <h2 id={id} ref={headingRef} tabIndex={-1} className="font-display text-xl font-semibold outline-none">
        {title}
      </h2>
      {sub ? <p className="mt-1 text-sm text-ink-soft">{sub}</p> : null}
    </div>
  );

  const stepError_ = stepError ? (
    <p role="alert" className="text-sm font-medium text-danger">
      {stepError}
    </p>
  ) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-blue" aria-hidden="true">
          Étape {step + 1} sur {STEPS.length} · {STEPS[step]}
        </p>
        <StepProgress steps={[...STEPS]} current={step} />
      </div>

      {step === 0 ? (
        <section className="flex flex-col gap-6" aria-labelledby="wz-h0">
          {heading("wz-h0", "Que souhaitez-vous surveiller ?", "Choisissez un type ci-dessous, ou décrivez simplement ce que vous attendez.")}
          <div className="flex flex-col gap-3 rounded-2xl border border-blue/15 bg-tint-blue p-4">
            <Label htmlFor="wz-assistant" className="flex items-center gap-2">
              <WandSparkles className="size-4" aria-hidden="true" /> Décrivez-le avec vos mots
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="wz-assistant"
                value={assistant}
                maxLength={500}
                onChange={(e) => setAssistant(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    interpret();
                  }
                }}
                placeholder="Ex. : préviens-moi quand ce produit passe sous 100 € et revient en stock"
              />
              <Button type="button" variant="gradient" onClick={interpret} disabled={assistant.trim().length < 5}>
                <Sparkles aria-hidden="true" /> Interpréter
              </Button>
            </div>
            <p className="text-xs text-ink-soft">Waverti traduit votre phrase en réglages, sans service payant. Vous vérifiez tout avant d'activer.</p>
            {assistantNotes.length && step === 0 ? (
              <p role="status" className="text-sm text-ink-soft">
                {assistantNotes.join(" ")}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="list">
            {CATEGORIES.map((c, ci) => {
              const locked = c.id === "news" && !topicsAllowed;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="listitem"
                  disabled={locked}
                  onClick={() => chooseCategory(c.id)}
                  className={cn(
                    "group flex flex-col gap-2 rounded-2xl border p-4 text-left shadow-soft transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue motion-reduce:hover:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70",
                    CATEGORY_SURFACE[ci % CATEGORY_SURFACE.length],
                  )}
                >
                  <span className={cn("grid size-10 place-items-center rounded-xl transition-transform group-hover:scale-105 [&_svg]:size-[18px]", CATEGORY_TILE[ci % CATEGORY_TILE.length])}>{c.icon}</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {c.title}
                    {locked ? <Lock className="size-3.5 text-ink-soft" aria-hidden="true" /> : null}
                  </span>
                  <span className="text-xs leading-snug text-ink-soft">{c.desc}</span>
                  {locked ? <span className="text-xs font-semibold text-ink-soft">Non inclus dans votre formule</span> : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 1 && cat ? (
        <section className="flex flex-col gap-6" aria-labelledby="wz-h1">
          <div className="flex items-start justify-between gap-3">
            {heading("wz-h1", isTopic ? "Quel sujet voulez-vous suivre ?" : "Quel site ou quel produit ?", `Type choisi : ${cat.title}. À indiquer : ${cat.target}.`)}
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep(0)}>
              Changer de type
            </Button>
          </div>
          {assistantNotes.length ? <Callout tone="info">{assistantNotes.join(" ")}</Callout> : null}
          {targetFields}
          {stepError_}
          {nav({ onBack: back, onNext: next })}
        </section>
      ) : null}

      {step === 2 && cat ? (
        <section className="flex flex-col gap-6" aria-labelledby="wz-h2">
          {heading("wz-h2", "Quel changement souhaitez-vous détecter ?", "Choisissez ce qui doit déclencher une alerte.")}
          <Tip>
            <strong className="font-semibold">Ce que vous recevrez :</strong> {cat.expected}
          </Tip>

          {cat.goals.length > 1 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Je veux être prévenu…</legend>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Objectif">
                {cat.goals.map((g) => {
                  const lockedTopic = !!g.topic && !topicsAllowed;
                  const lockedBusiness = !!g.business && entitlements.businessSites === 0;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={goalId === g.id}
                      disabled={lockedTopic}
                      onClick={() => pickGoal(g)}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-xl border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                        goalId === g.id ? "border-gradient" : "border-line bg-white/80 hover:border-line-strong",
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {g.title}
                        {g.topic ? <Badge tone="info">Recherche Internet</Badge> : null}
                        {g.business ? <Badge tone={lockedBusiness ? "neutral" : "gradient"}>{lockedBusiness ? <Lock aria-hidden="true" /> : null} Offre Business</Badge> : null}
                        {lockedTopic ? <Badge tone="neutral">Non inclus dans votre formule</Badge> : null}
                      </span>
                      <span className="text-xs text-ink-soft">{g.desc}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {needsOtherTarget ? (
            <Callout tone="info" title={isTopic ? "Cette option cherche sur Internet" : "Cette option surveille une page"}>
              Précisez {isTopic ? "le sujet à suivre" : "l'adresse de la page"} :
              <div className="mt-3">{targetFields}</div>
            </Callout>
          ) : null}

          {goal?.business ? (
            <Callout tone="info" title="Surveillance professionnelle">
              {entitlements.businessSites > 0 ? (
                <>
                  Certificat HTTPS, contrôles chaque minute et scénario dans le navigateur se configurent dans l'espace Business. Cette surveillance n'est donc pas créée depuis cet assistant.{" "}
                  {businessHref ? (
                    <a className="font-medium text-blue hover:underline" href={businessHref}>
                      Ouvrir l'espace Business
                    </a>
                  ) : null}
                </>
              ) : (
                <>
                  Ces contrôles ne sont pas inclus dans votre formule : ils font partie de l'offre Business.{" "}
                  {upgradeHref ? (
                    <a className="font-medium text-blue hover:underline" href={upgradeHref}>
                      Voir les formules
                    </a>
                  ) : null}
                </>
              )}
            </Callout>
          ) : isTopic ? (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white/80 p-4">
              <Label htmlFor="wz-official">Ne m'alerter que si une source officielle le confirme (pas de rumeur)</Label>
              <Switch id="wz-official" checked={requireOfficial} onCheckedChange={setRequireOfficial} />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {!browserOnly && preview?.suggestions?.length ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Idées pour cette page</p>
                  <div className="flex flex-wrap gap-2">
                    {preview.suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        title={s.description}
                        onClick={() => {
                          setRule(normalizeRule({ ...s.rule, category: category ?? s.category }));
                          setGoalId(null);
                        }}
                        className="rounded-full border border-blue/20 bg-tint-blue px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-blue/50 focus-visible:outline-2 focus-visible:outline-blue"
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Précisez la condition</p>
                <RuleBuilder value={rule} onChange={setRule} id="wz-rb" simple />
              </div>
              <details className="rounded-xl border border-line bg-white/70 p-4" open={goal?.needsZone ? true : undefined}>
                <summary className="cursor-pointer text-sm font-medium">Options avancées : surveiller une partie précise de la page</summary>
                <div className="mt-4 flex flex-col gap-4">
                  {!preview ? (
                    <p className="text-sm text-ink-soft">Utilisez « {verificationLabel} » à l'étape précédente pour obtenir la liste des zones repérées, ou indiquez la zone vous-même ci-dessous.</p>
                  ) : null}
                  {preview?.blocks?.length ? (
                    <div className="flex flex-col gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <MousePointerClick className="size-4" aria-hidden="true" /> Zone à surveiller {goal?.needsZone ? "(obligatoire pour cet objectif)" : "(facultatif)"}
                      </p>
                      <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1" role="radiogroup" aria-label="Zone à surveiller">
                        <ZoneOption checked={!selector} onSelect={() => setSelector("")} title="Toute la page" sample="Contenu principal (menus, publicités et pied de page ignorés)" />
                        {preview.blocks.map((b) => (
                          <ZoneOption key={b.selector} checked={selector === b.selector} onSelect={() => setSelector(b.selector)} title={b.label} sample={b.sample} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <Field id="wz-sel" label="Zone indiquée à la main (sélecteur CSS)" hint="Ex. : #prix-principal, .planning, table.tarifs">
                    {(p) => <Input {...p} value={selector} maxLength={300} onChange={(e) => setSelector(e.target.value)} placeholder="#prix" />}
                  </Field>
                </div>
              </details>
            </div>
          )}
          {!goal?.business && !isTopic ? (
            <Callout tone="info" title="Contrôle automatique">
              Waverti utilise d’abord votre ordinateur ou l’extension Chrome quand ils peuvent lire cette page. Si le contrôle local n’est pas disponible, les serveurs Waverti prennent le relais selon votre formule.
              {executionMode === "browser_only" && browserUnavailable ? <span className="mt-1 block">{browserUnavailable}</span> : null}
            </Callout>
          ) : null}
          {stepError_}
          {nav({ onBack: back, onNext: next, disabled: !!goal?.business })}
        </section>
      ) : null}

      {step === 3 && cat ? (
        <section className="flex flex-col gap-6" aria-labelledby="wz-h3">
          {heading("wz-h3", "Comment souhaitez-vous être prévenu ?", "Vous pourrez le modifier plus tard dans les réglages de la surveillance.")}
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Canaux de notification</legend>
            <label className="flex items-start gap-3 rounded-xl border border-line bg-white/80 p-4 text-sm">
              <Checkbox checked disabled aria-label="Dans l'application (toujours actif)" className="mt-0.5" />
              <span>
                <span className="block font-medium">Dans Waverti</span>
                <span className="text-ink-soft">L'alerte apparaît dans votre liste d'alertes. Toujours actif.</span>
              </span>
            </label>
            <label className={cn("flex items-start gap-3 rounded-xl border border-line bg-white/80 p-4 text-sm", !entitlements.emailAlerts && "opacity-80")}>
              <Checkbox checked={notifyEmail && entitlements.emailAlerts} disabled={!entitlements.emailAlerts} onCheckedChange={(v) => setNotifyEmail(v === true)} className="mt-0.5" />
              <span>
                <span className="block font-medium">Par e-mail</span>
                <span className="text-ink-soft">{entitlements.emailAlerts ? "Un e-mail à l'adresse de votre compte." : "Non inclus dans votre formule."}</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-line bg-white/80 p-4 text-sm">
              <Checkbox checked={notifyDesktop} onCheckedChange={(v) => setNotifyDesktop(v === true)} className="mt-0.5" />
              <span>
                <span className="block font-medium">Sur votre ordinateur</span>
                <span className="text-ink-soft">Nécessite l'application Waverti installée et ouverte.</span>
              </span>
            </label>
          </fieldset>
          <details className="rounded-xl border border-line bg-white/70 p-4">
            <summary className="cursor-pointer text-sm font-medium">Options avancées : fréquence des vérifications</summary>
            <div className="mt-4 max-w-sm">
              <Field id="wz-interval" label="Vérifier" hint={`Le plus souvent possible avec votre formule${entitlements.planName ? ` ${entitlements.planName}` : ""} : ${formatInterval(minInterval)}.`}>
                {(p) => (
                  <Select {...p} value={interval} onChange={(e) => setIntervalValue(Number(e.target.value))}>
                    {intervalOptions(minInterval).map((m) => (
                      <option key={m} value={m}>
                        {formatInterval(m).replace(/^./, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </details>
          {nav({ onBack: back, onNext: next })}
        </section>
      ) : null}

      {step === 4 && cat ? (
        <section className="flex flex-col gap-6" aria-labelledby="wz-h4">
          {heading("wz-h4", "Vérifier et activer", "Relisez le résumé, donnez un nom à votre surveillance, puis activez-la.")}
          <dl className="grid gap-4 rounded-2xl border border-blue/15 bg-tint-blue p-5 sm:grid-cols-[180px_1fr]">
            <dt className="text-sm text-ink-soft">Surveillé</dt>
            <dd className="min-w-0 break-words text-sm font-medium">
              {isTopic ? `Recherche sur Internet : « ${subject || request} »` : url}
              {!isTopic && selector ? <span className="block text-xs font-normal text-ink-soft">Zone : {selector}</span> : null}
            </dd>
            <dt className="text-sm text-ink-soft">Alerte si</dt>
            <dd className="text-sm">
              {isTopic ? (
                <span>Nouvelle information {requireOfficial ? "confirmée par une source officielle" : "probable ou confirmée"} sur ce sujet.</span>
              ) : (
                <ul className="flex flex-col gap-1">
                  {ruleLines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
            </dd>
            <dt className="text-sm text-ink-soft">Vous serez prévenu</dt>
            <dd className="text-sm">{["dans Waverti", notifyEmail && entitlements.emailAlerts ? "par e-mail" : null, notifyDesktop ? "sur votre ordinateur" : null].filter(Boolean).join(", ")}</dd>
            <dt className="text-sm text-ink-soft">Vérification</dt>
            <dd className="text-sm">
              {formatInterval(interval).replace(/^./, (c) => c.toUpperCase())} — {isTopic
                ? "par les serveurs Waverti (recherche Internet)."
                : executionMode === "browser_only"
                  ? "d’abord dans Chrome, puis côté serveur si nécessaire."
                  : "d’abord sur votre ordinateur, puis côté serveur si nécessaire."}
            </dd>
          </dl>
          <Field id="wz-name" label="Nom de la surveillance" required hint="Pour la retrouver facilement dans votre liste.">
            {(p) => <Input {...p} value={name} maxLength={120} onChange={(e) => setCustomName(e.target.value)} />}
          </Field>
          {!isTopic && missingSignals ? (
            <Callout tone="warning" title="Données de surveillance non confirmées">
              {browserOnly ? "Le relevé Chrome n’a pas confirmé" : "Waverti n’a pas encore pu confirmer"} {missingSignals}.
              Vous pouvez activer la surveillance. Les conditions
              concernées seront évaluées dès qu’un contrôle détectera les données nécessaires.
            </Callout>
          ) : null}
          {needsPreviewConfirmation ? (
            <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
              <Checkbox
                checked={previewAcknowledged}
                onCheckedChange={(checked) => setPreviewAcknowledged(checked === true)}
                className="mt-0.5"
              />
              <span>J’active cette surveillance même si les données nécessaires n’ont pas été confirmées.</span>
            </label>
          ) : null}
          <Callout tone="neutral" title="Bon à savoir">
            Cette surveillance compte pour une seule surveillance sur les {entitlements.maxMonitors} de votre formule, même avec plusieurs conditions. Les vérifications ne peuvent pas être plus rapides que celles de votre formule.
            {isTopic ? " Chaque vérification utilise des recherches de votre quota mensuel." : ""}
            {usesUptime ? " Les contrôles se font depuis un seul emplacement ; une panne est confirmée après 2 contrôles consécutifs." : ""}
          </Callout>
          {error ? (
            <Callout tone="danger" role="alert">
              {error}
            </Callout>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" onClick={back}>
              <ArrowLeft aria-hidden="true" /> Retour
            </Button>
            <Button type="button" size="lg" onClick={create} loading={submitting} disabled={!name.trim() || (needsPreviewConfirmation && !previewAcknowledged)}>
              Activer la surveillance
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ZoneOption({ checked, onSelect, title, sample }: { checked: boolean; onSelect: () => void; title: string; sample: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn("flex flex-col rounded-lg border px-3 py-2 text-left text-sm transition-colors", checked ? "border-gradient" : "border-line bg-white hover:border-line-strong")}
    >
      <span className="font-medium">{title}</span>
      <span className="line-clamp-2 text-xs text-muted-fg">{sample}</span>
    </button>
  );
}
