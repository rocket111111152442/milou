/**
 * Évaluation des règles personnalisées — côté serveur, déterministe, sans exécution de code utilisateur.
 *
 * Fiabilité des alertes :
 *  - Transition : une condition d'état (prix sous un seuil, mot présent…) n'alerte qu'au passage de « faux » à
 *    « vrai », pas à chaque contrôle.
 *  - Mémoire par surveillance (`RuleMemory`) : les éléments déjà vus (produits, liens, documents, dates, rubriques)
 *    ne sont jamais signalés deux fois, même s'ils disparaissent puis réapparaissent (retour à la normale ≠ nouveauté).
 *  - Confirmation facultative : l'alerte n'est envoyée que si la situation est encore observée au contrôle suivant.
 *  - Délai minimal entre deux alertes.
 *  - Erreur temporaire (503, délai dépassé) : aucune modification de l'état, la comparaison suivante se fait avec la
 *    dernière observation réussie. Les pannes ne sont annoncées qu'après 2 échecs consécutifs.
 */
import type { LinkRef, PageObservation, RuleAtom, RuleCondition } from "@waverti/types";
import { describeAtom, formatPrice, ruleAtoms, UPTIME_ATOMS } from "@waverti/types";
import { shortHash } from "../extract/structure";
import { collapseWhitespace, normalizeForMatch } from "../extract/text";
import { changeRatio, diffSentences } from "./similarity";
import { SIGNIFICANT_CHANGE_RATIO, type AlertKind, type Evaluation } from "./evaluate";

type SetName = "items" | "links" | "docs" | "dates" | "headings";
const SEEN_CAP = 800;

export interface RuleMemory {
  v: 1;
  seen: Record<SetName, string[]>;
  /** Ensembles déjà initialisés (premier contrôle = référence, aucune nouveauté signalée). */
  init: SetName[];
  ruleTrue: boolean;
  /** État des conditions d'état au dernier contrôle (déclenchement sur transition, condition par condition). */
  atoms: Record<string, boolean>;
  pending: { at: string; reasons: string[]; sigs: Record<number, string> } | null;
  lastAlertAt: string | null;
  refPrice: number | null;
  failures: number;
  slowCount: number;
  down: boolean;
  downSince: string | null;
}

export function emptyMemory(): RuleMemory {
  return {
    v: 1,
    seen: { items: [], links: [], docs: [], dates: [], headings: [] },
    init: [],
    ruleTrue: false,
    atoms: {},
    pending: null,
    lastAlertAt: null,
    refPrice: null,
    failures: 0,
    slowCount: 0,
    down: false,
    downSince: null,
  };
}

export function parseMemory(raw: unknown): RuleMemory {
  const base = emptyMemory();
  if (!raw || typeof raw !== "object" || (raw as { v?: unknown }).v !== 1) return base;
  const r = raw as Partial<RuleMemory>;
  return {
    ...base,
    ...r,
    seen: { ...base.seen, ...(r.seen ?? {}) },
    init: Array.isArray(r.init) ? r.init : [],
    atoms: r.atoms && typeof r.atoms === "object" ? r.atoms : {},
  };
}

export interface RuleInput {
  rule: RuleCondition;
  prev: PageObservation | null;
  curr: PageObservation | null;
  failure: { code: string; message: string } | null;
  memory: RuleMemory;
  taskName: string;
  now: Date;
}

interface AtomResult {
  v: boolean | null;
  event: boolean;
  reason: string | null;
  missing?: string;
  /** Libellés des éléments concernés (nouveaux produits, documents…). */
  entries?: string[];
  /** Signature de l'état observé (confirmation au contrôle suivant). */
  sig?: string;
}

/** Conditions dont la valeur « vrai » ne vaut que pour le contrôle où l'événement a lieu. */
const EVENT_LIKE = new Set<RuleAtom["type"]>([
  "stock_changed", "item_added", "item_removed", "link_added", "link_removed", "document_added", "document_removed",
  "document_link_changed", "heading_added", "date_added", "page_changed", "title_changed", "table_changed",
  "sentence_changed", "redirect_changed",
]);
// price_drop / price_rise « par rapport au contrôle précédent » sont des événements (r.event) ; avec la référence
// de départ, ce sont des conditions d'état (transition).

const NETWORK_DOWN = new Set(["timeout", "network_error", "dns_error", "check_failed"]);

// ——————————————————— Correspondance de texte (sans expression régulière fournie par l'utilisateur) ———————————————————

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Terme → motif sûr : les jokers « * » deviennent au plus 30 caractères de mot (pas de retour arrière exponentiel). */
function termPattern(term: string, opts: { wholeWord: boolean; caseSensitive: boolean }): RegExp {
  const t = opts.caseSensitive ? collapseWhitespace(term) : normalizeForMatch(term);
  const body = t.split("*").map(escapeRe).join("[\\p{L}\\p{N}'’-]{0,30}");
  const b = opts.wholeWord ? "(?<![\\p{L}\\p{N}])" : "";
  const a = opts.wholeWord ? "(?![\\p{L}\\p{N}])" : "";
  return new RegExp(`${b}${body}${a}`, "u");
}

function haystack(o: PageObservation, caseSensitive: boolean): string {
  return caseSensitive ? collapseWhitespace(o.excerpt).replace(/\n/g, " ") : normalizeForMatch(o.excerpt);
}

const has = (text: string, term: string, wholeWord = false, caseSensitive = false) => termPattern(term, { wholeWord, caseSensitive }).test(caseSensitive ? text : text);

function containsTerm(label: string, term: string | undefined): boolean {
  return !term || termPattern(term, { wholeWord: false, caseSensitive: false }).test(normalizeForMatch(label));
}

function excluded(label: string, exclude: string[]): boolean {
  const n = normalizeForMatch(label);
  return exclude.some((e) => termPattern(e, { wholeWord: false, caseSensitive: false }).test(n));
}

// ——————————————————— Ensembles (nouveautés / disparitions) ———————————————————

interface Entry {
  key: string;
  label: string;
}

function entriesOf(o: PageObservation | null, set: SetName, now: Date, futureOnly = false): Entry[] | null {
  if (!o) return null;
  const fromRefs = (refs: LinkRef[] | undefined) => refs?.map((r) => ({ key: shortHash(r.u), label: r.t || r.u }));
  switch (set) {
    case "items":
      return fromRefs(o.items) ?? null;
    case "links":
      return fromRefs(o.links) ?? null;
    case "docs":
      return fromRefs(o.documents) ?? null;
    case "headings":
      return o.headings?.map((h) => ({ key: shortHash(normalizeForMatch(h)), label: h })) ?? null;
    case "dates": {
      if (!o.dates) return null;
      const today = now.toISOString().slice(0, 10);
      return o.dates.filter((d) => !futureOnly || d >= today).map((d) => ({ key: d, label: formatDate(d) }));
    }
  }
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

const SET_OF: Partial<Record<RuleAtom["type"], SetName>> = {
  item_added: "items",
  item_removed: "items",
  link_added: "links",
  link_removed: "links",
  document_added: "docs",
  document_removed: "docs",
  heading_added: "headings",
  date_added: "dates",
};

function listLabels(entries: Entry[], max = 5): string {
  const shown = entries.slice(0, max).map((e) => `« ${e.label.slice(0, 80)} »`);
  return shown.join(", ") + (entries.length > max ? ` et ${entries.length - max} autre(s)` : "");
}

// ——————————————————— Évaluation d'une condition élémentaire ———————————————————

function evalAtom(a: RuleAtom, ctx: { prev: PageObservation | null; curr: PageObservation; mem: RuleMemory; exclude: string[]; now: Date }): AtomResult {
  const { prev, curr, mem, exclude, now } = ctx;
  const cur = curr.currency ?? "EUR";
  const price = curr.price;
  const priceMissing = (): AtomResult => ({ v: null, event: false, reason: null, missing: "price_not_found" });
  switch (a.type) {
    case "price_below":
    case "price_above": {
      if (price === null) return priceMissing();
      if (a.currency && cur !== a.currency) return { v: null, event: false, reason: null, missing: "currency_mismatch" };
      const ok = a.type === "price_below" ? (a.orEqual ? price <= a.value : price < a.value) : a.orEqual ? price >= a.value : price > a.value;
      return { v: ok, event: false, reason: ok ? `prix relevé ${formatPrice(price, cur)} (${a.type === "price_below" ? "seuil" : "plafond"} ${formatPrice(a.value, a.currency)})` : null };
    }
    case "price_drop":
    case "price_rise": {
      if (price === null) return priceMissing();
      const ref = a.reference === "reference" ? mem.refPrice : (prev?.price ?? null);
      if (ref === null || ref <= 0) return { v: false, event: false, reason: null };
      if (prev?.currency && prev.currency !== cur) return { v: null, event: false, reason: null, missing: "currency_mismatch" };
      const delta = a.type === "price_drop" ? ref - price : price - ref;
      const pct = (delta / ref) * 100;
      const ok = delta > 0 && pct + 1e-9 >= a.minPercent && delta + 1e-9 >= a.minAmount;
      const event = a.reference === "previous";
      const verb = a.type === "price_drop" ? "baisse" : "hausse";
      return {
        v: ok,
        event: ok && event,
        reason: ok ? `${verb} de ${pct.toFixed(1).replace(".", ",")} % (${formatPrice(ref, cur)} → ${formatPrice(price, cur)}${a.reference === "reference" ? ", par rapport au prix de départ" : ""})` : null,
        sig: `p:${price}`,
      };
    }
    case "promotion": {
      if (curr.regularPrice === undefined) return { v: null, event: false, reason: null, missing: "promotion_unavailable" };
      if (price === null) return priceMissing();
      const ok = curr.regularPrice !== null && curr.regularPrice > price;
      return { v: ok, event: false, reason: ok ? `prix barré affiché par le site : ${formatPrice(curr.regularPrice!, cur)} → ${formatPrice(price, cur)}` : null };
    }
    case "stock_is": {
      if (curr.availability === "unknown") return { v: null, event: false, reason: null, missing: "availability_unknown" };
      const ok = curr.availability === a.state;
      return { v: ok, event: false, reason: ok ? describeAtom(a).replace(/^Le produit est/, "produit") : null };
    }
    case "stock_changed": {
      if (curr.availability === "unknown") return { v: null, event: false, reason: null, missing: "availability_unknown" };
      const changed = !!prev && prev.availability !== "unknown" && prev.availability !== curr.availability;
      return { v: changed, event: changed, reason: changed ? `disponibilité : ${prev!.availability} → ${curr.availability}` : null, sig: `a:${curr.availability}` };
    }
    case "item_added":
    case "link_added":
    case "document_added":
    case "heading_added":
    case "date_added": {
      const set = SET_OF[a.type]!;
      const entries = entriesOf(curr, set, now, a.type === "date_added" ? a.futureOnly : false);
      if (!entries) return { v: null, event: false, reason: null, missing: "data_unavailable" };
      if (!mem.init.includes(set)) return { v: false, event: false, reason: null };
      const seen = new Set(mem.seen[set]);
      const contains = "contains" in a ? a.contains : undefined;
      const fresh = entries.filter((e) => !seen.has(e.key) && containsTerm(e.label, contains) && !excluded(e.label, exclude));
      const ok = fresh.length > 0;
      const noun = { items: "nouvel élément", links: "nouveau lien", docs: "nouveau document", headings: "nouvelle rubrique", dates: "nouvelle date" }[set];
      return { v: ok, event: ok, reason: ok ? `${noun}${fresh.length > 1 ? "s" : ""} : ${listLabels(fresh)}` : null, entries: fresh.map((e) => e.label), sig: fresh.map((e) => e.key).join(",") };
    }
    case "item_removed":
    case "link_removed":
    case "document_removed": {
      const set = SET_OF[a.type]!;
      const before = entriesOf(prev, set, now);
      const after = entriesOf(curr, set, now);
      if (!after) return { v: null, event: false, reason: null, missing: "data_unavailable" };
      if (!before) return { v: false, event: false, reason: null };
      const keys = new Set(after.map((e) => e.key));
      const gone = before.filter((e) => !keys.has(e.key) && containsTerm(e.label, a.contains) && !excluded(e.label, exclude));
      const ok = gone.length > 0;
      return { v: ok, event: ok, reason: ok ? `disparu : ${listLabels(gone)}` : null, entries: gone.map((e) => e.label), sig: gone.map((e) => e.key).join(",") };
    }
    case "document_link_changed": {
      if (!curr.documents) return { v: null, event: false, reason: null, missing: "data_unavailable" };
      if (!prev?.documents) return { v: false, event: false, reason: null };
      const byLabel = new Map(prev.documents.filter((d) => d.t).map((d) => [normalizeForMatch(d.t), d.u]));
      const changed = curr.documents.filter((d) => d.t && byLabel.has(normalizeForMatch(d.t)) && byLabel.get(normalizeForMatch(d.t)) !== d.u);
      const ok = changed.length > 0;
      return { v: ok, event: ok, reason: ok ? `nouveau lien de téléchargement pour ${listLabels(changed.map((d) => ({ key: d.u, label: d.t })))}` : null, sig: changed.map((d) => shortHash(d.u)).join(",") };
    }
    case "page_changed": {
      if (!prev) return { v: false, event: false, reason: null };
      let changed: boolean;
      let ratio = 0;
      if (a.sensitivity === "any") changed = prev.textHash !== curr.textHash;
      else {
        if (!prev.contentHash || !curr.contentHash) return { v: false, event: false, reason: null };
        changed = prev.contentHash !== curr.contentHash;
        if (changed && (prev.excerpt || curr.excerpt)) {
          ratio = changeRatio(prev.excerpt, curr.excerpt);
          changed = ratio >= SIGNIFICANT_CHANGE_RATIO;
        }
      }
      if (!changed) return { v: false, event: false, reason: null, sig: curr.contentHash ?? curr.textHash };
      const diff = diffSentences(prev.excerpt, curr.excerpt);
      const ex = diff.added[0] ?? diff.removed[0];
      const pct = ratio ? ` (environ ${Math.max(1, Math.round(ratio * 100))} % du contenu)` : "";
      return { v: true, event: true, reason: `contenu modifié${pct}${ex ? ` : « ${ex.slice(0, 120)} »` : ""}`, sig: a.sensitivity === "any" ? curr.textHash : (curr.contentHash ?? "") };
    }
    case "title_changed": {
      if (!prev?.title || !curr.title) return { v: false, event: false, reason: null };
      const ok = normalizeForMatch(prev.title) !== normalizeForMatch(curr.title);
      return { v: ok, event: ok, reason: ok ? `titre : « ${prev.title.slice(0, 80)} » → « ${curr.title.slice(0, 80)} »` : null, sig: `t:${normalizeForMatch(curr.title)}` };
    }
    case "table_changed": {
      if (!curr.tableHashes) return { v: null, event: false, reason: null, missing: "data_unavailable" };
      if (!prev?.tableHashes) return { v: false, event: false, reason: null };
      const ok = prev.tableHashes.join() !== curr.tableHashes.join() && (prev.tableHashes.length > 0 || curr.tableHashes.length > 0);
      return { v: ok, event: ok, reason: ok ? "contenu d'un tableau modifié" : null, sig: curr.tableHashes.join() };
    }
    case "element_present": {
      if (curr.selectorFound === null) return { v: null, event: false, reason: null, missing: "no_selector" };
      return { v: curr.selectorFound, event: false, reason: curr.selectorFound ? "l'élément ciblé est présent" : null };
    }
    case "form_present": {
      if (!curr.forms) return { v: null, event: false, reason: null, missing: "data_unavailable" };
      return { v: curr.forms.signup, event: false, reason: curr.forms.signup ? "un formulaire ou bouton d'inscription/réservation est présent" : null };
    }
    case "text_match": {
      const hs = haystack(curr, a.caseSensitive);
      const found = a.terms.filter((t) => has(hs, t, a.wholeWord, a.caseSensitive));
      const ok = a.mode === "all" ? found.length === a.terms.length : found.length > 0;
      const blocked = ok && exclude.length > 0 && excluded(curr.excerpt, exclude);
      return { v: ok && !blocked, event: false, reason: ok && !blocked ? `texte trouvé : ${found.map((f) => `« ${f} »`).join(", ")}` : null };
    }
    case "text_absent": {
      const hs = haystack(curr, a.caseSensitive);
      const ok = !a.terms.some((t) => has(hs, t, a.wholeWord, a.caseSensitive));
      return { v: ok, event: false, reason: ok ? `texte absent : ${a.terms.map((t) => `« ${t} »`).join(", ")}` : null };
    }
    case "sentence_changed": {
      if (!prev) return { v: false, event: false, reason: null };
      const pick = (o: PageObservation) =>
        new Set(
          o.excerpt
            .split(/(?<=[.!?])\s+|\n+/)
            .map((x) => normalizeForMatch(x))
            .filter((x) => x.length >= 6 && has(x, a.term)),
        );
      const before = pick(prev);
      const after = pick(curr);
      const ok = before.size > 0 && after.size > 0 && [...after].some((x) => !before.has(x));
      const changed = [...after].find((x) => !before.has(x));
      return { v: ok, event: ok, reason: ok ? `phrase modifiée : « ${changed!.slice(0, 140)} »` : null, sig: [...after].sort().join("|").slice(0, 400) };
    }
    case "site_down":
      // Contrôle réussi : site accessible (les échecs sont traités avant l'évaluation des conditions).
      return { v: false, event: false, reason: null };
    case "slow_response": {
      if (curr.responseMs === undefined) return { v: null, event: false, reason: null, missing: "response_time_unavailable" };
      const ok = mem.slowCount >= 2;
      return { v: ok, event: false, reason: ok ? `temps de réponse ${curr.responseMs} ms (seuil ${a.ms} ms, confirmé)` : null };
    }
    case "redirect_changed": {
      if (!prev) return { v: false, event: false, reason: null };
      const ok = prev.finalUrl !== curr.finalUrl;
      return { v: ok, event: ok, reason: ok ? `redirection : ${prev.finalUrl} → ${curr.finalUrl}` : null, sig: curr.finalUrl };
    }
  }
}

/** Confirmation au contrôle suivant : l'événement détecté est-il toujours observé ? */
function stillObserved(a: RuleAtom, sig: string | undefined, curr: PageObservation, now: Date): boolean {
  if (sig === undefined) return false;
  const set = SET_OF[a.type];
  if (set && (a.type.endsWith("_added"))) {
    const keys = new Set((entriesOf(curr, set, now) ?? []).map((e) => e.key));
    return sig.split(",").some((k) => k && keys.has(k));
  }
  if (set && a.type.endsWith("_removed")) {
    const keys = new Set((entriesOf(curr, set, now) ?? []).map((e) => e.key));
    return sig.split(",").every((k) => !keys.has(k));
  }
  switch (a.type) {
    case "page_changed":
      return sig === (a.sensitivity === "any" ? curr.textHash : (curr.contentHash ?? ""));
    case "title_changed":
      return !!curr.title && sig === `t:${normalizeForMatch(curr.title)}`;
    case "table_changed":
      return sig === (curr.tableHashes ?? []).join();
    case "stock_changed":
      return sig === `a:${curr.availability}`;
    case "price_drop":
    case "price_rise":
      return sig === `p:${curr.price}`;
    case "redirect_changed":
      return sig === curr.finalUrl;
    case "document_link_changed":
      return (curr.documents ?? []).some((d) => sig.split(",").includes(shortHash(d.u)));
    default:
      return false;
  }
}

// ——————————————————— Combinaison (logique à trois valeurs : vrai / faux / indéterminé) ———————————————————

function combine(values: Array<boolean | null>, match: "all" | "any"): boolean | null {
  if (match === "all") {
    if (values.some((v) => v === false)) return false;
    return values.some((v) => v === null) ? null : true;
  }
  if (values.some((v) => v === true)) return true;
  return values.some((v) => v === null) ? null : false;
}

const MISSING_MESSAGE: Record<string, string> = {
  price_not_found: "Aucun prix fiable n'a été trouvé sur la page.",
  currency_mismatch: "Le prix affiché n'est pas dans la devise de la règle.",
  availability_unknown: "La disponibilité n'a pas pu être déterminée sur la page.",
  promotion_unavailable: "Les informations de prix barré ne sont pas disponibles pour ce contrôle.",
  data_unavailable: "Cette donnée n'a pas pu être extraite lors de ce contrôle.",
  no_selector: "Aucun élément ciblé : précisez la zone à surveiller.",
  response_time_unavailable: "Le temps de réponse n'est mesuré que par les serveurs Waverti.",
};

function alertKind(rule: RuleCondition, atoms: RuleAtom[]): AlertKind {
  const t = atoms[0]?.type ?? "page_changed";
  if (t.startsWith("price") || t === "promotion") return "price";
  if (t.startsWith("stock")) return "stock";
  if (t.startsWith("text") || t === "sentence_changed" || rule.category === "keyword") return "keyword";
  return "page_change";
}

const minutes = (ms: number) => Math.round(ms / 60_000);

function rememberSets(mem: RuleMemory, curr: PageObservation, now: Date): void {
  for (const set of ["items", "links", "docs", "dates", "headings"] as SetName[]) {
    const entries = entriesOf(curr, set, now);
    if (!entries) continue;
    const merged = [...new Set([...mem.seen[set], ...entries.map((e) => e.key)])];
    mem.seen[set] = merged.slice(Math.max(0, merged.length - SEEN_CAP));
    if (!mem.init.includes(set)) mem.init.push(set);
  }
}

// ——————————————————— Point d'entrée ———————————————————

export function evaluateRule(input: RuleInput): { evaluation: Evaluation; memory: RuleMemory } {
  const { rule, prev, curr, failure, taskName, now } = input;
  const mem: RuleMemory = structuredClone(input.memory);
  const atoms = ruleAtoms(rule);
  const downAtom = atoms.find((a) => a.type === "site_down");
  const kind = alertKind(rule, atoms);
  const nowIso = now.toISOString();
  const value = curr?.price != null ? formatPrice(curr.price, curr.currency ?? "EUR") : curr && curr.availability !== "unknown" ? curr.availability : null;
  const base = { value, errorCode: null as string | null, changeSummary: null as Record<string, unknown> | null };
  const cooled = () => {
    const cd = rule.options.cooldownMinutes;
    return cd > 0 && mem.lastAlertAt !== null && now.getTime() - Date.parse(mem.lastAlertAt) < cd * 60_000;
  };

  // ——— Échec du contrôle (réseau, erreur HTTP) ———
  const httpFailure = curr && curr.httpStatus >= 400 ? { code: `http_${curr.httpStatus}`, message: `La page a répondu avec le code HTTP ${curr.httpStatus}.` } : null;
  const fail = failure ?? httpFailure;
  if (fail) {
    const isDown =
      !!downAtom &&
      (NETWORK_DOWN.has(fail.code) || (curr ? curr.httpStatus >= 500 || (downAtom.type === "site_down" && downAtom.includeHttpErrors && curr.httpStatus >= 400) : false));
    if (!isDown) {
      return { evaluation: { ...base, outcome: "error", triggered: false, summary: fail.message, alert: null, errorCode: fail.code }, memory: input.memory };
    }
    mem.failures += 1;
    if (mem.failures < 2 || mem.down) {
      return {
        memory: mem,
        evaluation: {
          ...base,
          outcome: "error",
          triggered: false,
          errorCode: fail.code,
          alert: null,
          summary: mem.down ? `Site toujours inaccessible : ${fail.message}` : `${fail.message} Échec 1 sur 2 : confirmation au prochain contrôle avant toute alerte.`,
        },
      };
    }
    mem.down = true;
    mem.downSince = nowIso;
    const suppressed = cooled();
    if (!suppressed) mem.lastAlertAt = nowIso;
    return {
      memory: mem,
      evaluation: {
        ...base,
        outcome: suppressed ? "error" : "triggered",
        triggered: !suppressed,
        errorCode: fail.code,
        changeSummary: { reasons: [`inaccessible : ${fail.message}`], down: true },
        summary: `Site inaccessible (confirmé sur 2 contrôles consécutifs) : ${fail.message}`,
        alert: suppressed ? null : { kind: "page_change", title: "Site inaccessible", body: `${taskName} : ${fail.message} Panne confirmée sur 2 contrôles consécutifs.` },
      },
    };
  }

  const obs = curr!;
  // ——— Retour à la normale ———
  let recovery: Evaluation | null = null;
  if (mem.down) {
    const since = mem.downSince ? Date.parse(mem.downSince) : now.getTime();
    const durationMin = Math.max(1, minutes(now.getTime() - since));
    mem.down = false;
    mem.downSince = null;
    if (rule.options.notifyRecovery) {
      recovery = {
        ...base,
        outcome: "triggered",
        triggered: true,
        changeSummary: { reasons: ["de nouveau accessible"], recovered: true, downMinutes: durationMin },
        summary: `Site de nouveau accessible (indisponible pendant environ ${durationMin} min).`,
        alert: { kind: "page_change", title: "Site de nouveau accessible", body: `${taskName} répond de nouveau normalement (indisponible pendant environ ${durationMin} min).` },
      };
      mem.lastAlertAt = nowIso;
    }
  }
  mem.failures = 0;

  // Mesure de lenteur (confirmée sur 2 contrôles)
  const slow = atoms.find((a) => a.type === "slow_response");
  if (slow && slow.type === "slow_response" && obs.responseMs !== undefined) mem.slowCount = obs.responseMs > slow.ms ? mem.slowCount + 1 : 0;
  if (mem.refPrice === null && obs.price !== null) mem.refPrice = obs.price;

  // ——— Évaluation des conditions ———
  const ctx = { prev, curr: obs, mem, exclude: rule.exclude, now };
  const confirming = mem.pending;
  const results = new Map<RuleAtom, AtomResult>();
  let idx = 0;
  const sigs: Record<number, string> = {};
  const indexOf = new Map<RuleAtom, number>();
  const evalOne = (a: RuleAtom): boolean | null => {
    const i = idx++;
    indexOf.set(a, i);
    let r = evalAtom(a, ctx);
    if (confirming && confirming.sigs[i] !== undefined) {
      // Confirmation : c'est le MÊME changement qui doit être encore observé (un aller-retour A→B→A n'est pas confirmé).
      r = stillObserved(a, confirming.sigs[i], obs, now) ? { ...r, v: true, event: true, reason: "toujours observé" } : { ...r, v: false, event: false, reason: null };
    }
    if (r.event && r.sig !== undefined) sigs[i] = r.sig;
    results.set(a, r);
    return r.v;
  };
  const values = [...rule.conditions.map(evalOne), ...rule.groups.map((g) => combine(g.conditions.map(evalOne), g.match))];
  let ruleNow = combine(values, rule.match);
  // Exclusions globales pour les conditions sans liste d'éléments (prix, disponibilité, contenu).
  if (ruleNow && rule.exclude.length && !atoms.some((a) => SET_OF[a.type]) && excluded(obs.excerpt, rule.exclude)) ruleNow = false;
  rememberSets(mem, obs, now);

  const fired = [...results.values()].filter((r) => r.v === true && r.reason);
  const reasons = fired.map((r) => r.reason!).slice(0, 6);
  const eventFired = [...results.values()].some((r) => r.event && r.v === true);
  const pc = prev && prev.price !== null && obs.price !== null && prev.price !== obs.price ? { from: prev.price, to: obs.price } : null;
  const changeSummary = { reasons, ...(pc ? { price: pc } : {}), entries: [...results.values()].flatMap((r) => r.entries ?? []).slice(0, 10) };

  if (recovery && ruleNow !== true) return { evaluation: recovery, memory: mem };

  if (ruleNow === null) {
    const missing = [...results.values()].find((r) => r.missing)?.missing ?? "data_unavailable";
    mem.pending = null;
    return {
      memory: mem,
      evaluation: { ...base, outcome: "error", triggered: false, errorCode: missing, alert: null, summary: MISSING_MESSAGE[missing] ?? "Donnée indisponible.", changeSummary },
    };
  }

  // Transition condition par condition : une condition d'état qui devient vraie, ou un événement observé.
  const stateNow: Record<string, boolean> = {};
  let stateRose = false;
  for (const [a, r] of results) {
    if (r.event || EVENT_LIKE.has(a.type)) continue;
    const key = String(indexOf.get(a));
    stateNow[key] = r.v === true;
    if (r.v === true && mem.atoms[key] !== true) stateRose = true;
  }
  const commitStates = () => {
    mem.atoms = stateNow;
  };
  const candidate = ruleNow && (eventFired || stateRose);
  if (!candidate) {
    const wasPending = !!mem.pending;
    mem.pending = null;
    mem.ruleTrue = ruleNow;
    commitStates();
    return {
      memory: mem,
      evaluation: {
        ...base,
        changeSummary,
        outcome: wasPending || pc ? "changed" : "ok",
        triggered: false,
        alert: null,
        summary: wasPending
          ? "Changement non confirmé au contrôle suivant : aucune alerte (situation revenue à l'état précédent)."
          : ruleNow
            ? "Conditions toujours remplies (déjà signalé)."
            : pc
              ? `Prix : ${formatPrice(pc.from)} → ${formatPrice(pc.to)} — conditions non remplies.`
              : "Conditions non remplies.",
      },
    };
  }

  // Confirmation au contrôle suivant
  if (rule.options.confirm && !confirming) {
    mem.pending = { at: nowIso, reasons, sigs };
    return {
      memory: mem,
      evaluation: { ...base, changeSummary, outcome: "changed", triggered: false, alert: null, summary: `À confirmer au prochain contrôle : ${reasons.join(" ; ") || "conditions remplies"}.` },
    };
  }
  mem.pending = null;
  mem.ruleTrue = true;
  commitStates();

  if (cooled()) {
    return {
      memory: mem,
      evaluation: { ...base, changeSummary, outcome: "changed", triggered: false, alert: null, summary: `Conditions remplies (${reasons.join(" ; ")}) — alerte non renvoyée : délai minimal entre deux alertes.` },
    };
  }
  mem.lastAlertAt = nowIso;
  const titleAtom = atoms.find((a) => results.get(a)?.v === true) ?? atoms[0]!;
  const title = shortTitle(titleAtom, obs);
  const why = (confirming ? [...confirming.reasons, "confirmé au contrôle suivant"] : reasons).join(" ; ");
  return {
    memory: mem,
    evaluation: {
      ...base,
      changeSummary: { ...changeSummary, reasons: confirming ? [...confirming.reasons, "confirmé"] : reasons },
      outcome: "triggered",
      triggered: true,
      summary: `Alerte : ${why}.`,
      alert: { kind, title, body: `${taskName} — ${why}.` },
    },
  };
}

function shortTitle(a: RuleAtom, o: PageObservation): string {
  switch (a.type) {
    case "price_below":
      return `Prix sous ${formatPrice(a.value, a.currency)}${o.price !== null ? ` : ${formatPrice(o.price, o.currency ?? "EUR")}` : ""}`;
    case "price_above":
      return `Prix au-dessus de ${formatPrice(a.value, a.currency)}`;
    case "price_drop":
      return `Baisse de prix${o.price !== null ? ` : ${formatPrice(o.price, o.currency ?? "EUR")}` : ""}`;
    case "price_rise":
      return "Hausse de prix";
    case "promotion":
      return "Prix barré affiché";
    case "stock_is":
      return a.state === "in_stock" ? "Produit disponible" : a.state === "out_of_stock" ? "Produit en rupture" : "Produit en précommande";
    case "stock_changed":
      return "Disponibilité modifiée";
    case "item_added":
      return "Nouvel élément dans la liste";
    case "item_removed":
      return "Élément retiré de la liste";
    case "document_added":
      return "Nouveau document publié";
    case "document_removed":
      return "Document retiré";
    case "document_link_changed":
      return "Lien de document modifié";
    case "date_added":
      return "Nouvelle date annoncée";
    case "link_added":
      return "Nouveau lien";
    case "link_removed":
      return "Lien retiré";
    case "heading_added":
      return "Nouvelle rubrique";
    case "title_changed":
      return "Titre modifié";
    case "table_changed":
      return "Tableau modifié";
    case "text_match":
      return `Texte trouvé : « ${a.terms[0]} »`;
    case "text_absent":
      return `Texte disparu : « ${a.terms[0]} »`;
    case "sentence_changed":
      return `Phrase modifiée (« ${a.term} »)`;
    case "element_present":
      return "Élément apparu";
    case "form_present":
      return "Inscription ou réservation disponible";
    case "slow_response":
      return "Temps de réponse anormal";
    case "redirect_changed":
      return "Redirection inattendue";
    case "site_down":
      return "Site inaccessible";
    default:
      return "La page a été modifiée";
  }
}

export { UPTIME_ATOMS };
