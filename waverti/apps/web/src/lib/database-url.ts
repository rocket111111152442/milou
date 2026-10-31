/**
 * Adresse de la base utilisable par CE déploiement.
 *
 * - Production Vercel et machines locales : DATABASE_URL.
 * - Preview / Development Vercel : UNIQUEMENT une base de test dédiée, PREVIEW_DATABASE_URL (projet Neon
 *   distinct, relié au projet Vercel pour Preview seulement, préfixe « PREVIEW »). L'intégration Neon de
 *   production injecte aussi DATABASE_URL en Preview : elle n'est JAMAIS utilisée hors Production.
 * - Refus si l'adresse de test désigne le même serveur que la production (erreur de configuration).
 */
export function databaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  if (!env.VERCEL_ENV || env.VERCEL_ENV === "production") return env.DATABASE_URL || null;
  const preview = env.PREVIEW_DATABASE_URL || null;
  if (!preview) return null;
  if (sameServer(preview, env.DATABASE_URL)) return null;
  return preview;
}

/** Adresse directe (sans pooler) pour les migrations, selon les mêmes règles. */
export function directDatabaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  if (!env.VERCEL_ENV || env.VERCEL_ENV === "production") return env.DATABASE_URL_UNPOOLED || env.DATABASE_URL || null;
  const pooled = databaseUrl(env);
  if (!pooled) return null;
  const direct = env.PREVIEW_DATABASE_URL_UNPOOLED || pooled;
  if (sameServer(direct, env.DATABASE_URL) || sameServer(direct, env.DATABASE_URL_UNPOOLED)) return null;
  return direct;
}

/** Même serveur Neon : on compare l'identifiant de point d'accès (ep-…), avec ou sans « -pooler ». */
export function sameServer(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace("-pooler.", ".").toLowerCase();
    } catch {
      return u;
    }
  };
  return host(a) === host(b);
}
