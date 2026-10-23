import "server-only";
import pg from "pg";

// Accès à la base Postgres (Supabase). Uniquement côté serveur : l'URL de connexion est un secret
// d'environnement, jamais envoyée au navigateur. Tables préfixées « petrin_ » (voir supabase/schema.sql).

function connectionString() {
  const raw = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
  // Les paramètres de l'URL fournie par l'intégration (sslmode, supa…) sont retirés : le SSL est réglé ci-dessous.
  return raw ? raw.split("?")[0] : null;
}

export function dbEnabled() {
  return connectionString() !== null;
}

const g = globalThis as unknown as { __petrinPool?: pg.Pool };

function pool() {
  if (g.__petrinPool) return g.__petrinPool;
  const url = connectionString();
  if (!url) throw new Error("Base de données non configurée (POSTGRES_URL manquant).");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  g.__petrinPool = new pg.Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    // Fonctions serverless : peu de connexions par instance, relâchées vite (le pooler Supabase fait le reste)
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  g.__petrinPool.on("error", (e) => console.warn("[db] connexion inactive fermée :", e.message));
  return g.__petrinPool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
  return pool().query<T>(text, params);
}
