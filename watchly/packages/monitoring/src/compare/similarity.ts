import { normalizeForMatch, stripVolatile } from "../extract/text";

function shingles(text: string, size = 3): Set<string> {
  const words = normalizeForMatch(stripVolatile(text)).split(/[^a-z0-9€$%]+/).filter(Boolean);
  const out = new Set<string>();
  if (words.length < size) {
    if (words.length) out.add(words.join(" "));
    return out;
  }
  for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(" "));
  return out;
}

/** Proportion de contenu modifié entre deux textes (0 = identique, 1 = totalement différent). */
export function changeRatio(a: string, b: string): number {
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  for (const s of sa) if (sb.has(s)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : 1 - inter / union;
}

/** Phrases ajoutées / retirées (résumé lisible d'un changement). */
export function diffSentences(before: string, after: string, max = 5): { added: string[]; removed: string[] } {
  const split = (t: string) =>
    stripVolatile(t)
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 12);
  const a = split(before);
  const b = split(after);
  const setA = new Set(a.map(normalizeForMatch));
  const setB = new Set(b.map(normalizeForMatch));
  return {
    added: b.filter((s) => !setA.has(normalizeForMatch(s))).slice(0, max).map((s) => s.slice(0, 240)),
    removed: a.filter((s) => !setB.has(normalizeForMatch(s))).slice(0, max).map((s) => s.slice(0, 240)),
  };
}
