/**
 * Assistant de configuration en langage naturel — 100 % déterministe (aucun modèle d'IA, aucun coût).
 * Reconnaît les formulations courantes en français et les convertit en règle structurée. Ce qui n'est pas
 * compris est signalé : l'utilisateur complète alors la règle dans le constructeur, rien n'est deviné en silence.
 *
 * Exemple : « Préviens-moi quand ce produit passe sous 100 € et revient en stock »
 *   → prix inférieur à 100 € ET produit en stock.
 */
import type { RuleAtom, RuleConditionInput } from "./rules";

export interface ParsedRequest {
  rule: RuleConditionInput | null;
  /** Conditions reconnues (pour affichage). */
  recognized: RuleAtom[];
  /** Avertissements (fragments non compris, ambiguïtés). */
  notes: string[];
}

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

function num(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/[\s  ]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : null;
}

const AMOUNT = String.raw`(\d[\d\s  ]*(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)`;

/** Termes entre guillemets (« », " ", ' '). */
function quotedTerms(text: string): string[] {
  const out: string[] = [];
  const re = /«\s*([^»]{1,120}?)\s*»|"([^"]{1,120})"|“([^”]{1,120})”/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push((m[1] ?? m[2] ?? m[3] ?? "").trim());
  return out.filter(Boolean).slice(0, 10);
}

export function parseRuleRequest(input: string): ParsedRequest {
  const text = input.slice(0, 500);
  const s = strip(text);
  const atoms: RuleAtom[] = [];
  const notes: string[] = [];
  const add = (a: RuleAtom) => {
    if (!atoms.some((x) => JSON.stringify(x) === JSON.stringify(a))) atoms.push(a);
  };
  const quoted = quotedTerms(text);

  // ——— Prix ———
  let m = new RegExp(String.raw`(?:sous|moins de|inferieur a|en dessous de|en-dessous de|<)\s*${AMOUNT}`).exec(s);
  if (m) {
    const v = num(m[1]!);
    if (v) add({ type: "price_below", value: v, orEqual: false, currency: "EUR" });
  }
  m = new RegExp(String.raw`(?:atteint|arrive a|tombe a)\s*${AMOUNT}`).exec(s);
  if (m) {
    const v = num(m[1]!);
    if (v) add({ type: "price_below", value: v, orEqual: true, currency: "EUR" });
  }
  m = new RegExp(String.raw`(?:au-dessus de|au dessus de|plus de|superieur a|depasse)\s*${AMOUNT}`).exec(s);
  if (m) {
    const v = num(m[1]!);
    if (v) add({ type: "price_above", value: v, orEqual: false, currency: "EUR" });
  }
  const pct = /(baisse|reduction|remise|hausse|augment\w*)\D{0,20}?(\d{1,2}(?:[.,]\d)?)\s*%/.exec(s);
  if (pct) {
    const v = num(pct[2]!);
    if (v) {
      const rise = /hausse|augment/.test(pct[1]!);
      add({ type: rise ? "price_rise" : "price_drop", minPercent: v, minAmount: 0, reference: "previous" });
    }
  } else {
    const amt = new RegExp(String.raw`(baisse|hausse|augment\w*)\D{0,20}?${AMOUNT}`).exec(s);
    if (amt && !/sous|moins de/.test(s.slice(Math.max(0, amt.index - 12), amt.index + 12))) {
      const v = num(amt[2]!);
      if (v) add({ type: /hausse|augment/.test(amt[1]!) ? "price_rise" : "price_drop", minPercent: 0, minAmount: v, reference: "previous" });
    } else if (/(le )?prix (baisse|diminue)|baisse de prix|baisse du prix/.test(s)) {
      add({ type: "price_drop", minPercent: 0, minAmount: 0, reference: "previous" });
    } else if (/(le )?prix (augmente|monte)|hausse de prix|hausse du prix/.test(s)) {
      add({ type: "price_rise", minPercent: 0, minAmount: 0, reference: "previous" });
    }
  }
  if (/\b(promo|promotion|soldes|prix barre)\b/.test(s)) add({ type: "promotion" });

  // ——— Disponibilité produit ———
  if (/(revient|de retour|retour) en stock|de nouveau (disponible|en stock)|redevient disponible|(est|sera|repasse) (en stock|disponible)/.test(s)) {
    add({ type: "stock_is", state: "in_stock" });
  } else if (/rupture|epuise|n'est plus disponible|plus en stock/.test(s)) {
    add({ type: "stock_is", state: "out_of_stock" });
  } else if (/precommande|pre-commande/.test(s)) {
    add({ type: "stock_is", state: "preorder" });
  }

  // ——— Listes, documents, dates, liens ———
  const docMatch = /(nouveau|nouvel|nouvelle)s? (pdf|document|fichier|rapport|version du document)/.test(s);
  if (docMatch) {
    const contains = /(?:titre|nom|intitule)\s+(?:contient|contenant)/.test(s) || /contenant|contient/.test(s) ? quoted[0] : undefined;
    add({ type: "document_added", ...(contains ? { contains } : {}) });
  }
  if (/(nouveau|nouvel|nouvelle|nouveaux|nouvelles) (produit|article|modele|variante|offre|annonce|evenement|poste|emploi|stage|session|formation|concert|spectacle)/.test(s) && !docMatch) {
    add({ type: "item_added" });
  }
  if (/nouvelles? dates?|date (est )?annoncee|calendrier/.test(s)) add({ type: "date_added", futureOnly: true });
  if (/nouveau lien/.test(s)) add({ type: "link_added" });
  if (/titre (de la page )?change/.test(s)) add({ type: "title_changed" });
  if (/(inscriptions?|billetterie|reservations?|ventes?) (sont |est )?(ouvert|ouvre|commence|debute)/.test(s)) {
    add({
      type: "text_match",
      terms: ["inscriptions ouvertes", "inscription ouverte", "s'inscrire", "réserver", "billetterie ouverte", "acheter des billets"],
      mode: "any",
      wholeWord: false,
      caseSensitive: false,
    });
    notes.push("Ouverture détectée par des expressions courantes (« inscriptions ouvertes », « réserver »…) : vérifiez-les dans le constructeur.");
  }

  // ——— Disponibilité du site ———
  if (/inaccessible|en panne|hors ligne|hors-ligne|\bdown\b|ne repond plus/.test(s)) add({ type: "site_down", includeHttpErrors: true });
  if (/\blent\b|lenteur|temps de reponse/.test(s)) add({ type: "slow_response", ms: 3000 });

  // ——— Mots-clés ———
  const remaining = quoted.filter((t) => !atoms.some((a) => "contains" in a && a.contains === t));
  if (remaining.length) {
    if (/disparai|n'apparait plus|n'est plus (affiche|present)|retire/.test(s)) {
      add({ type: "text_absent", terms: remaining, wholeWord: false, caseSensitive: false });
    } else if (/phrase .*(modifiee|change)/.test(s)) {
      add({ type: "sentence_changed", term: remaining[0]! });
    } else {
      add({ type: "text_match", terms: remaining, mode: /\b(tous|toutes|ensemble|a la fois)\b/.test(s) ? "all" : "any", wholeWord: false, caseSensitive: false });
    }
  } else {
    const word = /(?:le mot|l'expression|le texte|la mention)\s+([\p{L}\p{N}'-]{2,40})/u.exec(text.toLowerCase());
    if (word) {
      const t = word[1]!;
      if (/disparai|n'apparait plus/.test(s)) add({ type: "text_absent", terms: [t], wholeWord: true, caseSensitive: false });
      else add({ type: "text_match", terms: [t], mode: "any", wholeWord: true, caseSensitive: false });
    }
  }

  // ——— Modification générale (si rien de plus précis) ———
  if (/(change|modifi|mise a jour|mis a jour|bouge|evolue)/.test(s) && !atoms.some((a) => a.type === "title_changed" || a.type === "sentence_changed")) {
    add({ type: "page_changed", sensitivity: "significant" });
  }

  const exclude = /\bsauf\b|\bsans\b|\bexcept/.test(s) && quoted.length > 1 ? [quoted[quoted.length - 1]!] : [];
  if (exclude.length) notes.push(`Exclusion reconnue : « ${exclude[0]} ».`);
  const match: "all" | "any" = /\bou\b/.test(s.replace(/\bou bien\b/g, "ou")) && !/\bet\b/.test(s) ? "any" : "all";
  if (!atoms.length) {
    notes.push("Aucune condition reconnue. Choisissez les conditions dans le constructeur.");
    return { rule: null, recognized: [], notes };
  }
  const usesUptime = atoms.some((a) => a.type === "site_down" || a.type === "slow_response");
  return {
    rule: {
      type: "rule",
      category: usesUptime ? "uptime" : "custom",
      match: usesUptime && atoms.length > 1 ? "any" : match,
      conditions: atoms.slice(0, 8),
      groups: [],
      exclude: exclude.filter((e) => !atoms.some((a) => a.type === "text_match" && a.terms.includes(e))),
      options: { cooldownMinutes: 0, confirm: false, notifyRecovery: usesUptime },
    },
    recognized: atoms,
    notes,
  };
}
