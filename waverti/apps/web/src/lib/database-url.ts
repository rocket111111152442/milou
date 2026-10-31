/**
 * Adresse de la base utilisable par CE déploiement.
 * Sur Vercel, l'intégration Neon fournit la même DATABASE_URL à Production et à Preview : une prévisualisation
 * écrirait donc dans les données réelles. Seule la Production utilise la base, sauf si WAVERTI_PREVIEW_DATABASE=1
 * (à n'activer qu'avec une base de test distincte, par exemple une branche Neon dédiée aux prévisualisations).
 */
export function databaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  const url = env.DATABASE_URL;
  if (!url) return null;
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production" && env.WAVERTI_PREVIEW_DATABASE !== "1") return null;
  return url;
}
