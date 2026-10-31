/**
 * « Analyser la page » : à partir des données RÉELLEMENT détectées lors de l'aperçu, propose les surveillances
 * pertinentes. Déterministe : une suggestion n'est faite que si la donnée correspondante a été trouvée.
 */
import type { RuleConditionInput } from "./rules";

export interface PageAnalysis {
  title: string | null;
  contentKind: "html" | "pdf" | "document";
  price: number | null;
  currency: string | null;
  regularPrice: number | null;
  availability: "in_stock" | "out_of_stock" | "preorder" | "unknown";
  items: Array<{ t: string; p?: number | null }>;
  documents: Array<{ t: string; u: string }>;
  futureDates: string[];
  headings: string[];
  linksCount: number;
  tablesCount: number;
  signupForm: boolean;
  textSample: string;
}

export interface RuleSuggestion {
  id: string;
  category: NonNullable<RuleConditionInput["category"]>;
  title: string;
  description: string;
  rule: RuleConditionInput;
}

const r = (category: RuleSuggestion["category"], conditions: RuleConditionInput["conditions"], extra: Partial<RuleConditionInput> = {}): RuleConditionInput => ({
  type: "rule",
  category,
  conditions,
  ...extra,
});

function fmt(n: number, c: string | null) {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${!c || c === "EUR" ? "€" : c}`;
}

export function suggestRules(a: PageAnalysis): RuleSuggestion[] {
  const out: RuleSuggestion[] = [];
  if (a.contentKind !== "html") {
    out.push({ id: "doc-version", category: "document", title: "Nouvelle version du document", description: "Alerte dès que le fichier publié à cette adresse change.", rule: r("document", [{ type: "page_changed", sensitivity: "any" }]) });
    if (a.textSample) out.push({ id: "doc-text", category: "document", title: "Changement du texte du document", description: "Alerte lorsque le contenu textuel change de façon significative.", rule: r("document", [{ type: "page_changed", sensitivity: "significant" }]) });
    return out;
  }
  if (a.price !== null) {
    const target = Math.max(1, Math.floor(a.price * 0.9));
    out.push({ id: "price-below", category: "price", title: `Prix sous ${fmt(target, a.currency)}`, description: `Prix actuel : ${fmt(a.price, a.currency)}. Alerte au passage sous le seuil.`, rule: r("price", [{ type: "price_below", value: target, currency: a.currency ?? "EUR" }]) });
    out.push({ id: "price-drop", category: "price", title: "Toute baisse de prix", description: "Alerte à chaque baisse par rapport au contrôle précédent.", rule: r("price", [{ type: "price_drop" }]) });
    out.push({ id: "price-15", category: "price", title: "Baisse d'au moins 15 %", description: `Par rapport au prix relevé aujourd'hui (${fmt(a.price, a.currency)}).`, rule: r("price", [{ type: "price_drop", minPercent: 15, reference: "reference" }]) });
    if (a.regularPrice !== null) out.push({ id: "promo", category: "price", title: "Prix barré affiché", description: `Le site affiche actuellement un prix barré (${fmt(a.regularPrice, a.currency)}).`, rule: r("price", [{ type: "promotion" }]) });
  }
  if (a.availability === "out_of_stock" || a.availability === "preorder") {
    out.push({ id: "back-in-stock", category: "product", title: "Retour en stock", description: "Le produit est actuellement indisponible.", rule: r("product", [{ type: "stock_is", state: "in_stock" }]) });
  } else if (a.availability === "in_stock") {
    out.push({ id: "out-of-stock", category: "product", title: "Rupture de stock", description: "Le produit est actuellement disponible.", rule: r("product", [{ type: "stock_is", state: "out_of_stock" }]) });
  }
  if (a.price !== null && a.availability !== "unknown") {
    out.push({ id: "price-and-stock", category: "custom", title: `Sous ${fmt(Math.max(1, Math.floor(a.price * 0.9)), a.currency)} ET en stock`, description: "Les deux conditions doivent être remplies.", rule: r("custom", [{ type: "price_below", value: Math.max(1, Math.floor(a.price * 0.9)), currency: a.currency ?? "EUR" }, { type: "stock_is", state: "in_stock" }]) });
  }
  if (a.items.length >= 3) {
    out.push({ id: "new-item", category: "product", title: "Nouvel élément dans la liste", description: `${a.items.length} éléments détectés (ex. « ${a.items[0]!.t.slice(0, 50)} »). Alerte pour chaque nouveauté.`, rule: r("product", [{ type: "item_added" }]) });
  }
  if (a.documents.length) {
    out.push({ id: "new-doc", category: "document", title: "Nouveau document publié", description: `${a.documents.length} document(s) déjà présent(s) sur la page.`, rule: r("document", [{ type: "document_added" }]) });
  }
  if (a.futureDates.length) {
    out.push({ id: "new-date", category: "event", title: "Nouvelle date annoncée", description: `Dates à venir détectées : ${a.futureDates.slice(0, 3).join(", ")}.`, rule: r("event", [{ type: "date_added" }]) });
  }
  if (!a.signupForm && /inscri|billet|reserv|ouverture|bientot|bientôt|prochainement/i.test(a.textSample)) {
    out.push({ id: "signup-opens", category: "event", title: "Ouverture des inscriptions ou de la billetterie", description: "Alerte lorsqu'un formulaire ou un bouton d'inscription/réservation apparaît.", rule: r("event", [{ type: "form_present" }]) });
  }
  if (a.headings.length >= 2) out.push({ id: "new-section", category: "page", title: "Nouvelle rubrique", description: "Alerte lorsqu'un nouveau titre de section apparaît.", rule: r("page", [{ type: "heading_added" }]) });
  if (a.tablesCount) out.push({ id: "table", category: "page", title: "Modification d'un tableau", description: `${a.tablesCount} tableau(x) détecté(s).`, rule: r("page", [{ type: "table_changed" }]) });
  if (a.linksCount >= 3) out.push({ id: "new-link", category: "page", title: "Nouveau lien", description: "Alerte lorsqu'un nouveau lien apparaît dans le contenu principal.", rule: r("page", [{ type: "link_added" }]) });
  out.push({ id: "change", category: "page", title: "Modification du contenu", description: "Changements significatifs uniquement (publicités, horloges et menus ignorés).", rule: r("page", [{ type: "page_changed" }]) });
  return out.slice(0, 10);
}
