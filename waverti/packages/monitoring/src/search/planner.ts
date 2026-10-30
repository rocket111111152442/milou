/**
 * Compréhension des demandes de recherche (moteur B) — RÈGLES DÉTERMINISTES.
 * Aucune IA générative n'est utilisée : l'intention et le sujet sont déduits par motifs,
 * et l'utilisateur confirme/corrige le sujet proposé dans le formulaire. Limite assumée :
 * une demande ambiguë (« ce produit ») nécessite que l'utilisateur précise le sujet.
 */
import type { WebTopicCondition, WebTopicIntent } from "@waverti/types";
import { normalizeForMatch } from "../extract/text";

const INTENT_PATTERNS: Array<[WebTopicIntent, RegExp]> = [
  ["release_date", /\b(date de sortie|sortie|sortira|release date|disponible le|date de lancement|launch date)\b/],
  ["job_offer", /\b(stage|stagiaire|alternance|offre d emploi|offres d emploi|recrute|recrutement|emploi|job|internship|cdi|cdd)\b/],
  ["official_publication", /\b(journal officiel|decret|arrete|publication officielle|resultats officiels|bulletin officiel|loi|circulaire|concours)\b/],
  ["announcement", /\b(annonce|annonc|nouveau produit|nouvelle version|lancement|devoile|presente|nouveaute)\b/],
];

const FILLER = [
  /previens[- ]moi/g,
  /previens moi/g,
  /alerte[- ]moi/g,
  /dis[- ]moi/g,
  /je veux (savoir|etre (prevenu|averti|alerte))/g,
  /des que|quand|lorsque|si jamais/g,
  /(la|une|les|des|un) (date de sortie|annonce|offre|offres|publication) (officielle |officiel )?(de |du |des |d )?/g,
  /est (annoncee|annonce|publiee|publie|confirmee|confirme|disponible)/g,
  /sont (annoncees|publiees|disponibles)/g,
  /officiellement|officielle|officiel/g,
  /(de |du |des |d )?ce (produit|jeu|film|sujet)/g,
  /\b(nouvelle|nouvelles|nouveau)\b/g,
  /\b(sur internet|en ligne|sur le web)\b/g,
  /[?!.,;:]/g,
];

const STOPWORDS = new Set(["le", "la", "les", "de", "du", "des", "d", "un", "une", "et", "ou", "a", "au", "aux", "en", "pour", "sur", "que", "qui", "moi", "me", "mon", "ma", "mes", "est", "sont", "the", "of", "for"]);

export function detectIntent(request: string): WebTopicIntent {
  const n = normalizeForMatch(request).replace(/['’]/g, " ");
  for (const [intent, re] of INTENT_PATTERNS) if (re.test(n)) return intent;
  return "generic";
}

export function wantsOfficial(request: string): boolean {
  return /\b(officiel|officielle|officiellement|confirme|confirmee|confirmation|official|officially)\b/.test(normalizeForMatch(request));
}

/** Sujet proposé : texte entre guillemets en priorité, sinon la demande débarrassée des formules. */
export function suggestSubject(request: string): string {
  const quoted = /[«"“]([^»"”]{2,120})[»"”]/.exec(request);
  if (quoted) return quoted[1]!.trim();
  let s = normalizeForMatch(request).replace(/['’]/g, " ");
  for (const re of FILLER) s = s.replace(re, " ");
  const words = s.split(/\s+/).filter((w) => w && !STOPWORDS.has(w));
  // Conserve la casse d'origine quand c'est possible
  const original = request.split(/\s+/);
  const restored = words.map((w) => original.find((o) => normalizeForMatch(o).replace(/[^a-z0-9]/g, "") === w) ?? w);
  return restored.join(" ").slice(0, 120).trim();
}

export function significantTokens(subject: string): string[] {
  return normalizeForMatch(subject)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export function buildQueries(condition: WebTopicCondition, officialDomains: string[] = []): string[] {
  const s = condition.subject.trim();
  const extra = condition.keywords.join(" ");
  const q: string[] = [];
  for (const d of officialDomains.slice(0, 2)) q.push(`site:${d} ${s}`);
  switch (condition.intent) {
    case "release_date":
      q.push(`"${s}" date de sortie officielle`, `${s} release date announced`);
      break;
    case "job_offer":
      q.push(`${s} offre de stage ${extra}`.trim(), `${s} stage candidature ${extra}`.trim());
      break;
    case "official_publication":
      q.push(`${s} publication officielle ${extra}`.trim(), officialDomains.length ? `${s} ${extra}`.trim() : `${s} site:gouv.fr`);
      break;
    case "announcement":
      q.push(`"${s}" annonce officielle ${extra}`.trim(), `${s} annonce ${extra}`.trim());
      break;
    default:
      q.push(`${s} ${extra}`.trim());
  }
  return [...new Set(q.map((x) => x.replace(/\s+/g, " ").trim()))].slice(0, 5);
}

export function planWebTopic(
  request: string,
  opts: { subject?: string; officialDomains?: string[]; requireOfficial?: boolean; keywords?: string[] } = {},
): { condition: WebTopicCondition; queries: string[] } {
  const subject = (opts.subject?.trim() || suggestSubject(request) || request).slice(0, 200);
  const condition: WebTopicCondition = {
    type: "web_topic",
    intent: detectIntent(request),
    subject,
    keywords: (opts.keywords ?? []).slice(0, 8),
    requireOfficial: opts.requireOfficial ?? wantsOfficial(request),
  };
  return { condition, queries: buildQueries(condition, opts.officialDomains) };
}
