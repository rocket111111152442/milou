/**
 * Classement des résultats de recherche — règles explicites, sans IA générative :
 * une information n'est jamais inventée ni complétée ; seule sa source et sa formulation
 * déterminent son niveau de confiance.
 */
import { createHash } from "node:crypto";
import type { FindingClassification, WebFinding, WebTopicCondition, WebTopicStatus } from "@watchly/types";
import { normalizeForMatch } from "../extract/text";
import { significantTokens } from "./planner";
import type { SearchResultItem } from "./brave";

type Tier = WebFinding["sourceTier"];

const GOV = [/\.gouv\.fr$/, /^gouv\.fr$/, /\.gov$/, /\.gov\.[a-z]{2}$/, /europa\.eu$/, /legifrance\.gouv\.fr$/, /service-public\.fr$/, /\.education\.fr$/, /insee\.fr$/];
const REFERENCE = ["wikipedia.org", "afp.com", "reuters.com", "apnews.com", "businesswire.com", "prnewswire.com", "globenewswire.com", "actusnews.com"];
const MEDIA = [
  "lemonde.fr", "lefigaro.fr", "liberation.fr", "francetvinfo.fr", "20minutes.fr", "bfmtv.com", "ouest-france.fr", "leparisien.fr",
  "numerama.com", "frandroid.com", "01net.com", "lesnumeriques.com", "clubic.com", "jeuxvideo.com", "gamekult.com", "ign.com",
  "theverge.com", "engadget.com", "techcrunch.com", "lesechos.fr", "latribune.fr", "zdnet.fr", "macg.co", "nintendo-town.fr",
];
const COMMUNITY = [/reddit\.com$/, /(^|\.)x\.com$/, /twitter\.com$/, /facebook\.com$/, /instagram\.com$/, /tiktok\.com$/, /youtube\.com$/, /forum/, /discord/, /quora\.com$/, /medium\.com$/];
/** Domaines où les annonces sont publiées par l'émetteur lui-même (communiqués). */
const PRESS_RELEASE = ["businesswire.com", "prnewswire.com", "globenewswire.com", "actusnews.com"];

const RUMOR = /\b(rumeur|rumeurs|selon des sources|selon nos informations|aurait|pourrait|pourraient|fuite|leak|leaked|rumou?r|reportedly|insider|speculation|speculations|non confirme|pas encore confirme|serait)\b/;
const CONFIRM = /\b(officiellement|annonce officielle|a annonce|ont annonce|confirme|confirmee|communique|officially|announced|announces|press release|devoile|annonce aujourd hui|publie au journal officiel)\b/;

const MONTHS = "janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december";
const DATE_RE = new RegExp(
  `\\b(\\d{1,2}(?:er)? (?:${MONTHS}) \\d{4}|(?:${MONTHS}) \\d{4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{4}|(?:printemps|ete|automne|hiver|spring|summer|fall|winter) \\d{4}|q[1-4] \\d{4}|(?:debut|fin|courant) \\d{4})\\b`,
);

export function sourceTier(hostname: string, officialDomains: string[], subject: string): Tier {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  if (officialDomains.some((d) => h === d || h.endsWith(`.${d}`))) return "official";
  if (GOV.some((re) => re.test(h))) return "official";
  if (REFERENCE.some((d) => h === d || h.endsWith(`.${d}`))) return "reference";
  if (COMMUNITY.some((re) => re.test(h))) return "community";
  if (MEDIA.some((d) => h === d || h.endsWith(`.${d}`))) return "media";
  // Domaine portant le nom du sujet (ex. marque) : source de référence, mais pas « officielle »
  // tant que l'utilisateur ne l'a pas déclarée comme telle.
  const label = h.split(".").slice(-2, -1)[0] ?? "";
  if (label.length >= 4 && significantTokens(subject).includes(label)) return "reference";
  return "unknown";
}

export function extractDate(text: string): string | null {
  return DATE_RE.exec(normalizeForMatch(text))?.[1] ?? null;
}

function fingerprint(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 40);
}

function urlKey(u: string): string {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return u;
  }
}

export function classifyResult(item: SearchResultItem, condition: WebTopicCondition, officialDomains: string[]): WebFinding {
  const text = `${item.title} ${item.description}`;
  const norm = normalizeForMatch(text).replace(/['’]/g, " ");
  const tokens = significantTokens(condition.subject);
  const matched = tokens.filter((t) => norm.includes(t)).length;
  const relevant = tokens.length === 0 ? true : matched / tokens.length >= 0.6;
  const tier = sourceTier(item.hostname, officialDomains, condition.subject);
  const date = extractDate(text);
  const rumor = RUMOR.test(norm);
  const confirm = CONFIRM.test(norm);
  const intentMatch =
    condition.intent === "release_date"
      ? Boolean(date)
      : condition.intent === "job_offer"
        ? /\b(stage|stagiaire|alternance|offre|recrute|internship|candidature|poste)\b/.test(norm)
        : condition.intent === "official_publication"
          ? /\b(publie|publication|decret|arrete|resultats|journal officiel|parution)\b/.test(norm)
          : condition.intent === "announcement"
            ? CONFIRM.test(norm) || /\b(annonce|lance|devoile|presente|nouveau|nouvelle)\b/.test(norm)
            : true;
  const keywordsOk = condition.keywords.every((k) => norm.includes(normalizeForMatch(k)));
  const reasons: string[] = [];
  let classification: FindingClassification;
  if (!relevant || !intentMatch || !keywordsOk) {
    classification = "irrelevant";
    if (!relevant) reasons.push("Le sujet n'apparaît pas clairement dans le résultat");
    if (!intentMatch) reasons.push("Le résultat ne contient pas l'information recherchée");
    if (!keywordsOk) reasons.push("Mots-clés obligatoires absents");
  } else if (tier === "community" || (rumor && tier !== "official")) {
    classification = "rumor";
    reasons.push(tier === "community" ? "Source communautaire (forum, réseau social)" : "Formulation au conditionnel ou mention de rumeur");
  } else if (tier === "official" || (PRESS_RELEASE.some((d) => item.hostname.endsWith(d)) && confirm)) {
    classification = "confirmed";
    reasons.push(tier === "official" ? "Source officielle" : "Communiqué de presse de l'émetteur");
  } else if (tier === "reference" || tier === "media") {
    classification = "probable";
    reasons.push(tier === "media" ? "Média reconnu, sans confirmation officielle" : "Source de référence, sans confirmation officielle");
  } else {
    // Source inconnue : au mieux « probable » si elle rapporte une annonce, jamais « confirmée ».
    classification = confirm && !rumor ? "probable" : "rumor";
    reasons.push("Source non vérifiée");
  }
  const claim = condition.intent === "release_date" && date ? `${normalizeForMatch(condition.subject)}|date|${date}` : urlKey(item.url);
  return {
    url: item.url,
    title: item.title,
    snippet: item.description,
    domain: item.hostname,
    publishedAt: item.publishedAt,
    classification,
    sourceTier: tier,
    extractedDate: date,
    reasons,
    fingerprint: fingerprint(`${classification}|${claim}`),
  };
}

const RANK: Record<FindingClassification, number> = { confirmed: 3, probable: 2, rumor: 1, irrelevant: 0 };

export function topicStatus(findings: WebFinding[]): WebTopicStatus {
  const best = findings.reduce((m, f) => Math.max(m, RANK[f.classification]), 0);
  return best === 3 ? "confirmed" : best === 2 ? "probable" : best === 1 ? "rumor" : "none";
}

export function meetsThreshold(c: FindingClassification, requireOfficial: boolean): boolean {
  return requireOfficial ? c === "confirmed" : RANK[c] >= RANK.probable;
}
