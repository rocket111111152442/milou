/**
 * Migrations d'un environnement Vercel — OUTIL MANUEL, jamais appelé par le build ni par le déploiement web.
 *
 * Usage (depuis waverti/, variables de l'environnement visé dans le shell ; l'adresse n'est jamais affichée) :
 *   WAVERTI_MIGRATE_TARGET=preview     pnpm db:migrate:env                      # simulation : liste les migrations en attente
 *   WAVERTI_MIGRATE_TARGET=preview     pnpm db:migrate:env --execute
 *   WAVERTI_MIGRATE_TARGET=production  pnpm db:migrate:env --execute --confirm=<nom-de-la-base>
 *
 * - preview : PREVIEW_DATABASE_URL[_UNPOOLED] uniquement, refusée si elle désigne le serveur de production.
 * - production : DATABASE_URL[_UNPOOLED] ; exige --execute ET --confirm=<nom exact de la base connectée>.
 * - Seul db/migrations/ est lu (db/migrations-pending/ n'est jamais appliqué). Sans --execute, rien n'est modifié.
 */
import postgres from "postgres";
import { listMigrations, runMigrations } from "../src/migrations";

const argv = process.argv.slice(2);
const target = process.env.WAVERTI_MIGRATE_TARGET;
const execute = argv.includes("--execute");
const confirm = argv.find((a) => a.startsWith("--confirm="))?.slice("--confirm=".length);

function hostOf(u: string | undefined): string | null {
  try {
    return u ? new URL(u).hostname.replace("-pooler.", ".").toLowerCase() : null;
  } catch {
    return null;
  }
}

function resolveUrl(): string | null {
  const e = process.env;
  if (target === "production") return e.DATABASE_URL_UNPOOLED || e.DATABASE_URL || null;
  const url = e.PREVIEW_DATABASE_URL_UNPOOLED || e.PREVIEW_DATABASE_URL || null;
  const prod = [hostOf(e.DATABASE_URL), hostOf(e.DATABASE_URL_UNPOOLED)].filter(Boolean);
  if (url && prod.includes(hostOf(url))) return null;
  return url;
}

async function main(): Promise<number> {
  if (target !== "preview" && target !== "production") {
    console.error("WAVERTI_MIGRATE_TARGET doit valoir « preview » ou « production » : rien n'a été fait.");
    return 1;
  }
  const url = resolveUrl();
  if (!url) {
    console.error("Adresse de base absente, ou test identique à la production : rien n'a été fait.");
    return 1;
  }
  const sql = postgres(url, { max: 1, onnotice: () => undefined, connect_timeout: 20 });
  try {
    const dbName = (await sql<{ db: string }[]>`select current_database() as db`)[0]?.db ?? "";
    const hasTable = (await sql<{ ok: boolean }[]>`select to_regclass('waverti_migrations.schema_migrations') is not null as ok`)[0]?.ok;
    const applied = new Set(hasTable ? (await sql<{ version: string }[]>`select version from waverti_migrations.schema_migrations`).map((r) => r.version) : []);
    const pending = listMigrations().filter((m) => !applied.has(m.version));
    console.info(`Base « ${dbName} » (${target === "preview" ? "TEST (Preview)" : "PRODUCTION"}) : ${pending.length} migration(s) en attente`);
    for (const m of pending) console.info(`  - ${m.version} ${m.name}`);
    if (!execute) {
      console.info("Simulation : rien n'a été modifié. Ajoutez --execute pour appliquer.");
      return 0;
    }
    if (target === "production" && confirm !== dbName) {
      console.error(`Production : --confirm=${dbName} est requis. Rien n'a été modifié.`);
      return 1;
    }
    await runMigrations(sql, { log: (m) => console.info(m) });
    if (target === "preview") {
      // Marqueur d'environnement de la base de TEST : les outils de recette (worker Preview) refusent toute autre base.
      await sql`insert into app_settings (key, value) values ('environment', '"preview"'::jsonb) on conflict (key) do nothing`;
      console.info("Marqueur d'environnement : preview");
    }
    return 0;
  } finally {
    await sql.end();
  }
}

process.exitCode = await main().catch((e) => {
  console.error(`Échec : ${e instanceof Error ? e.message.slice(0, 200) : "erreur"}`);
  return 1;
});
