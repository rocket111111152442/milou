/** Normalisation de texte pour comparaisons robustes (casse, accents, espaces). */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[  \s]+/g, " ")
    .trim();
}

export function collapseWhitespace(s: string): string {
  return s.replace(/[  \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{2,}/g, "\n").trim();
}

/**
 * Supprime les éléments volatils d'un texte (heures, compteurs, dates relatives) afin que le mode
 * « changements significatifs » ne déclenche pas d'alerte à chaque visite.
 */
export function stripVolatile(s: string): string {
  return s
    .replace(/\b\d{1,2}[:h]\d{2}(?::\d{2})?\b/g, "")
    .replace(/\bil y a \d+ ?(?:s|sec|secondes?|min|minutes?|h|heures?|j|jours?)\b/gi, "")
    .replace(/\b\d+ ?(?:personnes? (?:regardent|consultent)|visiteurs?|vues?)\b/gi, "");
}
