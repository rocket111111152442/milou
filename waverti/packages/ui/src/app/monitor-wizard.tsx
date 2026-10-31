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
  Check,
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

type CategoryId = NonNullable<RuleConditionInput["category"]>;

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

function intervalOptions(min: number): number[] {
  const base = [60, 120, 240, 360, 720, 1440, 2880, 10080];
  return [...new Set([min, ...base.filter((m) => m > min)])].sort((a, b) => a - b);
}

const STEPS = ["Catégorie", "Configuration", "Résumé"] as const;

export function MonitorWizard({
  entitlements,
  onPreview,
  onPlanTopic,
  onSubmit,
  upgradeHref,
  businessHref,
  initialCategory,
}: {
  entitlements: WizardEntitlements;
  onPreview: (url: string, cssSelector?: string) => Promise<AnalysisResult>;
  onPlanTopic: (request: string, officialDomains: string[]) => Promise<TopicPlan | null>;
  onSubmit: (input: CreateMonitorInput) => Promise<SubmitResult>;
  upgradeHref?: string;
  businessHref?: string;
  initialCategory?: CategoryId;
}) {
  const topicsAllowed = entitlements.maxWebTopics > 0 && entitlements.webIntervalMinutes !== null;
  const [step, setStep] = React.useState(initialCategory ? 1 : 0);
  const [category, setCategory] = React.useState<CategoryId | null>(initialCategory ?? null);
  const [goalId, setGoalId] = React.useState<string | null>(null);
  const [rule, setRule] = React.useState<EditableRule>(normalizeRule({ type: "rule", conditions: [{ type: "page_changed" }] }));
  const [assistant, setAssistant] = React.useState("");
  const [assistantNotes, setAssistantNotes] = React.useState<string[]>([]);
  const [url, setUrl] = React.useState("");
  const [selector, setSelector] = React.useState("");
  const [preview, setPreview] = React.useState<AnalysisResult | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [request, setRequest] = React.useState("");
  const [domains, setDomains] = React.useState("");
  const [plan, setPlan] = React.useState<TopicPlan | null>(null);
  const [planning, setPlanning] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [requireOfficial, setRequireOfficial] = React.useState(true);
  const [name, setName] = React.useState("");
  const [notifyEmail, setNotifyEmail] = React.useState(entitlements.emailAlerts);
  const [notifyDesktop, setNotifyDesktop] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [stepError, setStepError] = React.useState<string | null>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const cat = category ? CAT.get(category)! : null;
  const goal = cat?.goals.find((g) => g.id === goalId) ?? null;
  const isTopic = !!goal?.topic || category === "news";
  const minInterval = isTopic ? (entitlements.webIntervalMinutes ?? 1440) : entitlements.pageIntervalMinutes;
  const [interval, setIntervalValue] = React.useState<number>(minInterval);
  React.useEffect(() => setIntervalValue(minInterval), [minInterval]);
  React.useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const parsedDomains = domains
    .split(/[,\s]+/)
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
    .filter(Boolean)
    .slice(0, 5);

  function chooseCategory(id: CategoryId) {
    setCategory(id);
    const c = CAT.get(id)!;
    const first = c.goals.find((g) => !g.business && (!g.topic || topicsAllowed)) ?? c.goals[0]!;
    pickGoal(first, id);
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

  async function analysePage() {
    setPreviewing(true);
    setPreview(null);
    const r = await onPreview(url.trim(), selector.trim() || undefined);
    setPreviewing(false);
    setPreview(r);
    const o = r.observation;
    if (o && !name && o.title) setName(o.title.slice(0, 100));
  }

  async function analyseTopic() {
    setPlanning(true);
    const p = await onPlanTopic(request.trim(), parsedDomains);
    setPlanning(false);
    if (p) {
      setPlan(p);
      setSubject(p.condition.subject);
      setRequireOfficial(p.condition.requireOfficial);
      if (!name) setName(p.condition.subject.slice(0, 100));
    }
  }

  function validateStep2(): string | null {
    if (goal?.business) return "Cette surveillance se configure dans l'espace Business.";
    if (isTopic) {
      if (!topicsAllowed) return "La recherche sur Internet n'est pas incluse dans votre formule.";
      return request.trim().length < 5 ? "Décrivez le sujet à surveiller (au moins quelques mots)." : null;
    }
    if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(url.trim())) return "Indiquez une adresse complète, commençant par https://";
    if (goal?.needsZone && !selector.trim()) return "Choisissez la zone ou l'élément à surveiller (analysez la page, ou saisissez un sélecteur CSS).";
    return ruleProblem(rule);
  }

  function next() {
    const problem = step === 1 ? validateStep2() : null;
    setStepError(problem);
    if (problem) return;
    if (step === 1 && !name.trim()) setName((isTopic ? subject || request : (preview?.observation?.title ?? url)).slice(0, 100));
    setStep((s) => Math.min(2, s + 1));
  }

  function buildInput(): CreateMonitorInput {
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
      executionMode: "cloud_only",
      notify,
    };
  }

  async function create() {
    setError(null);
    let input: CreateMonitorInput;
    try {
      input = buildInput();
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
  const ruleLines = !isTopic && !ruleProblem(rule) ? describeRule(ruleConditionSchema.parse({ type: "rule", ...rule })) : [];
  const usesUptime = ruleAtoms({ conditions: rule.conditions, groups: rule.groups }).some((a) => a.type === "site_down" || a.type === "slow_response");

  return (
    <div className="flex flex-col gap-8">
      <ol className="flex items-center gap-2 text-xs font-medium sm:text-sm" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full border text-[11px] transition-colors",
                i < step ? "border-ink bg-ink text-white" : i === step ? "border-gradient text-ink" : "border-line text-muted-fg",
              )}
            >
              {i < step ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn(i === step ? "text-ink" : "text-muted-fg", "hidden sm:inline")}>{s}</span>
            {i < STEPS.length - 1 ? <span className="h-px w-6 bg-line sm:w-10" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <section className="flex flex-col gap-6" aria-labelledby="wz-h0">
          <h2 id="wz-h0" ref={headingRef} tabIndex={-1} className="font-display text-lg font-semibold outline-none">
            Que voulez-vous surveiller ?
          </h2>
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            <Label htmlFor="wz-assistant" className="flex items-center gap-2">
              <WandSparkles className="size-4" aria-hidden="true" /> Décrivez-le simplement
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
            <p className="text-xs text-muted-fg">Interprétation automatique sans intelligence artificielle payante : vous vérifiez toujours la règle avant de la créer.</p>
            {assistantNotes.length && step === 0 ? (
              <p role="status" className="text-sm text-ink-soft">
                {assistantNotes.join(" ")}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="list">
            {CATEGORIES.map((c) => {
              const locked = c.id === "news" && !topicsAllowed;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="listitem"
                  disabled={locked}
                  onClick={() => chooseCategory(c.id)}
                  className={cn(
                    "group flex flex-col gap-2 rounded-xl border border-line bg-white p-4 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue motion-reduce:hover:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-surface text-ink transition-colors group-hover:bg-waverti-gradient group-hover:text-white [&_svg]:size-[18px]">{c.icon}</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {c.title}
                    {locked ? <Lock className="size-3.5 text-muted-fg" aria-label="Non inclus dans votre formule" /> : null}
                  </span>
                  <span className="text-xs leading-snug text-muted-fg">{c.desc}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 1 && cat ? (
        <section className="flex flex-col gap-6" aria-labelledby="wz-h1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="wz-h1" ref={headingRef} tabIndex={-1} className="font-display text-lg font-semibold outline-none">
                {cat.title}
              </h2>
              <p className="text-sm text-muted-fg">À indiquer : {cat.target}.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep(0)}>
              Changer
            </Button>
          </div>
          {assistantNotes.length ? <Callout tone="info">{assistantNotes.join(" ")}</Callout> : null}

          {cat.goals.length > 1 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Je veux être prévenu…</legend>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Objectif">
                {cat.goals.map((g) => {
                  const locked = (g.topic && !topicsAllowed) || (g.business && entitlements.businessSites === 0);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={goalId === g.id}
                      disabled={!!g.topic && !topicsAllowed}
                      onClick={() => pickGoal(g)}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-xl border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        goalId === g.id ? "border-gradient" : "border-line bg-white hover:border-line-strong",
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {g.title}
                        {g.topic ? <Badge tone="info">Recherche Internet</Badge> : null}
                        {g.business ? <Badge tone={locked ? "neutral" : "gradient"}>{locked ? <Lock aria-hidden="true" /> : null} Business</Badge> : null}
                      </span>
                      <span className="text-xs text-muted-fg">{g.desc}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {goal?.business ? (
            <Callout tone="info" title="Surveillance professionnelle">
              {entitlements.businessSites > 0 ? (
                <>
                  Certificat HTTPS, points de contrôle vérifiés chaque minute et scénario navigateur se configurent dans l'espace Business.{" "}
                  {businessHref ? (
                    <a className="font-medium text-blue hover:underline" href={businessHref}>
                      Ouvrir l'espace Business
                    </a>
                  ) : null}
                </>
              ) : (
                <>
                  Ces contrôles sont inclus dans l'offre Business.{" "}
                  {upgradeHref ? (
                    <a className="font-medium text-blue hover:underline" href={upgradeHref}>
                      Voir les formules
                    </a>
                  ) : null}
                </>
              )}
            </Callout>
          ) : isTopic ? (
            <div className="flex flex-col gap-5">
              <Field id="wz-request" label="Votre sujet" required hint="Ex. : « Préviens-moi lorsque Samsung annonce officiellement un nouveau Galaxy ».">
                {(p) => <Textarea {...p} rows={3} maxLength={500} value={request} onChange={(e) => setRequest(e.target.value)} />}
              </Field>
              <Field id="wz-domains" label="Sites officiels connus (facultatif)" hint="Domaines séparés par des virgules. Leurs publications sont considérées comme officielles.">
                {(p) => <Input {...p} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="samsung.com" />}
              </Field>
              <div>
                <Button type="button" variant="secondary" onClick={analyseTopic} loading={planning} disabled={request.trim().length < 5}>
                  <Sparkles aria-hidden="true" /> Analyser la demande
                </Button>
              </div>
              {plan ? (
                <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4" role="status" aria-live="polite">
                  <Field id="wz-subject" label="Sujet recherché" hint="Vérifiez et corrigez si besoin.">
                    {(p) => <Input {...p} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />}
                  </Field>
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="wz-official">N'alerter que si une source officielle le confirme (pas de rumeur)</Label>
                    <Switch id="wz-official" checked={requireOfficial} onCheckedChange={setRequireOfficial} />
                  </div>
                  <p className="text-xs text-muted-fg">{plan.queries.length} requête(s) par vérification, décomptées de votre quota mensuel de recherches.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Field id="wz-url" label="Adresse" required className="flex-1">
                  {(p) => <Input {...p} type="url" inputMode="url" placeholder="https://www.exemple.fr/…" value={url} onChange={(e) => setUrl(e.target.value)} />}
                </Field>
                <Button type="button" variant="secondary" onClick={analysePage} loading={previewing} disabled={!/^https?:\/\/.+\..+/.test(url.trim())}>
                  <ScanSearch aria-hidden="true" /> Analyser la page
                </Button>
              </div>
              {previewing ? <div className="skeleton h-20 rounded-xl" aria-label="Analyse en cours" /> : null}
              {preview?.error ? (
                <Callout tone="warning" title="Analyse impossible" role="status">
                  {preview.error.message}
                </Callout>
              ) : null}
              {obs ? (
                <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4" role="status" aria-live="polite">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-fg">{analysis?.contentKind === "pdf" ? "Document" : "Page"}</p>
                      <p className="truncate text-sm font-medium">{obs.title ?? "Sans titre"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-fg">Prix détecté</p>
                      <p className="font-display text-base font-semibold">
                        {obs.price !== null ? formatPrice(obs.price, obs.currency ?? "EUR") : "Aucun"}
                        {analysis?.regularPrice ? <span className="ml-2 text-xs font-normal text-muted-fg line-through">{formatPrice(analysis.regularPrice, obs.currency ?? "EUR")}</span> : null}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-fg">Détecté</p>
                      <p className="text-sm">
                        {[
                          analysis?.items.length ? `${analysis.items.length}+ éléments de liste` : null,
                          analysis?.documents.length ? `${analysis.documents.length} document(s)` : null,
                          analysis?.futureDates.length ? `${analysis.futureDates.length} date(s) à venir` : null,
                          analysis?.signupForm ? "formulaire d'inscription" : null,
                          obs.availability !== "unknown" ? `stock : ${obs.availability === "in_stock" ? "disponible" : obs.availability === "out_of_stock" ? "rupture" : "précommande"}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "contenu textuel"}
                      </p>
                    </div>
                  </div>
                  {preview?.suggestions?.length ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-fg">Suggestions pour cette page</p>
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
                            className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-blue"
                          >
                            {s.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {preview?.blocks?.length ? (
                    <div className="flex flex-col gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-fg">
                        <MousePointerClick className="size-3.5" aria-hidden="true" /> Zone à surveiller {goal?.needsZone ? "(requise)" : "(facultatif)"}
                      </p>
                      <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1" role="radiogroup" aria-label="Zone à surveiller">
                        <ZoneOption checked={!selector} onSelect={() => setSelector("")} title="Toute la page" sample="Contenu principal (menus, publicités et pied de page ignorés)" />
                        {preview.blocks.map((b) => (
                          <ZoneOption key={b.selector} checked={selector === b.selector} onSelect={() => setSelector(b.selector)} title={b.label} sample={b.sample} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <details className="rounded-xl border border-line p-4" open={goal?.needsZone && !preview?.blocks?.length ? true : undefined}>
                <summary className="cursor-pointer text-sm font-medium">Sélecteur CSS (alternative)</summary>
                <div className="mt-3">
                  <Field id="wz-sel" label="Zone de la page" hint="Ex. : #prix-principal, .planning, table.tarifs">
                    {(p) => <Input {...p} value={selector} maxLength={300} onChange={(e) => setSelector(e.target.value)} placeholder="#prix" />}
                  </Field>
                </div>
              </details>
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Conditions</p>
                <RuleBuilder value={rule} onChange={setRule} id="wz-rb" />
              </div>
            </div>
          )}
          {stepError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {stepError}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              <ArrowLeft aria-hidden="true" /> Retour
            </Button>
            <Button type="button" onClick={next} disabled={!!goal?.business}>
              Continuer <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 && cat ? (
        <section className="flex flex-col gap-6" aria-labelledby="wz-h2">
          <h2 id="wz-h2" ref={headingRef} tabIndex={-1} className="font-display text-lg font-semibold outline-none">
            Résumé avant création
          </h2>
          <dl className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-[180px_1fr]">
            <dt className="text-sm text-muted-fg">Surveillé</dt>
            <dd className="min-w-0 break-words text-sm font-medium">
              {isTopic ? `Recherche sur Internet : « ${subject || request} »` : url}
              {!isTopic && selector ? <span className="block text-xs font-normal text-muted-fg">Zone : {selector}</span> : null}
            </dd>
            <dt className="text-sm text-muted-fg">Alerte si</dt>
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
            <dt className="text-sm text-muted-fg">Résultat attendu</dt>
            <dd className="text-sm text-ink-soft">{cat.expected}</dd>
            <dt className="text-sm text-muted-fg">Exécution</dt>
            <dd className="text-sm text-ink-soft">{isTopic ? "Par les serveurs Waverti (moteur de recherche)." : "Par les serveurs Waverti, même quand votre ordinateur est éteint."}</dd>
          </dl>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="wz-name" label="Nom de la surveillance" required>
              {(p) => <Input {...p} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field id="wz-interval" label="Fréquence des vérifications" hint={`Au plus fréquent avec votre formule${entitlements.planName ? ` ${entitlements.planName}` : ""} : ${formatInterval(minInterval)}.`}>
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
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-medium">Notifications</legend>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked disabled aria-label="Dans l'application (toujours actif)" /> Dans l'application (toujours actif)
            </label>
            <label className={cn("flex items-center gap-3 text-sm", !entitlements.emailAlerts && "text-muted-fg")}>
              <Checkbox checked={notifyEmail && entitlements.emailAlerts} disabled={!entitlements.emailAlerts} onCheckedChange={(v) => setNotifyEmail(v === true)} />
              Par e-mail {!entitlements.emailAlerts ? "(non inclus dans votre formule)" : ""}
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={notifyDesktop} onCheckedChange={(v) => setNotifyDesktop(v === true)} /> Notification sur le bureau (application installée)
            </label>
          </fieldset>
          <Callout tone="neutral" title="Limites de votre formule">
            Chaque surveillance compte pour une seule surveillance ({entitlements.maxMonitors} au maximum), quel que soit le nombre de conditions ; la fréquence ne peut
            pas être plus rapide que celle de votre formule.
            {isTopic ? " Chaque vérification consomme des recherches de votre quota mensuel." : ""}
            {usesUptime ? " Contrôles depuis un seul emplacement ; une panne est confirmée sur 2 contrôles consécutifs." : ""}
          </Callout>
          {error ? (
            <Callout tone="danger" role="alert">
              {error}
            </Callout>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft aria-hidden="true" /> Modifier
            </Button>
            <Button type="button" size="lg" onClick={create} loading={submitting}>
              Créer la surveillance
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
