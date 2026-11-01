/**
 * Remise à zéro des DONNÉES (comptes, surveillances, alertes, historiques, caches, journaux) d'une base Waverti.
 * Le schéma, les migrations et les données de référence (formules, réglages) sont conservés.
 *
 * Sans option : simulation (compte les lignes, ne modifie rien).
 * Exécution :
 *   DATABASE_URL=… pnpm db:reset-data --execute --confirm=<nom-de-la-base>            (base de test)
 *   DATABASE_URL=… pnpm db:reset-data --execute --confirm=<nom-de-la-base> --production (base SANS marqueur « preview »)
 * Garde-fous : le nom saisi doit être celui de la base connectée ; une base sans marqueur « preview » exige --production ;
 * tout dans une seule transaction (échec = aucune modification) ; l'adresse de connexion n'est jamais affichée.
 * IRRÉVERSIBLE : seules les sauvegardes de l'hébergeur (Neon) permettent de revenir en arrière.
 */
import postgres from "postgres";

const KEEP = new Set(["plans", "plan_addons", "app_settings"]);
const args = new Set(process.argv.slice(2));
const confirm = process.argv.slice(2).find((a) => a.startsWith("--confirm="))?.slice("--confirm=".length);
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL est requis");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => undefined, connect_timeout: 20 });
try {
  const db = (await sql<{ db: string }[]>`select current_database() as db`)[0]?.db ?? "";
  const marker = await sql<{ value: unknown }[]>`select value from app_settings where key = 'environment'`;
  const isPreview = marker[0]?.value === "preview";
  const tables = (await sql<{ t: string }[]>`select tablename as t from pg_tables where schemaname = 'public' order by 1`).map((r) => r.t).filter((t) => !KEEP.has(t));
  const others = await sql<{ s: string; n: number }[]>`
    select schemaname as s, count(*)::int as n from pg_tables
    where schemaname not in ('public', 'pg_catalog', 'information_schema', 'waverti_migrations') group by 1`;

  const counts: Record<string, number> = {};
  for (const t of tables) counts[t] = Number((await sql.unsafe(`select count(*)::text as n from public."${t}"`))[0]?.n ?? 0);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.info(`Base « ${db} » (${isPreview ? "marqueur preview" : "SANS marqueur preview : traitée comme production"})`);
  console.info(`Conservé : ${[...KEEP].join(", ")}, waverti_migrations.* (schéma, migrations, formules, réglages)`);
  console.info(`À effacer : ${total} ligne(s) dans ${tables.length} table(s)`);
  for (const [t, n] of Object.entries(counts)) if (n) console.info(`  ${t}: ${n}`);
  if (others.length) console.warn(`Autres schémas NON traités par cet outil : ${others.map((o) => `${o.s} (${o.n} tables)`).join(", ")}`);

  if (!args.has("--execute")) {
    console.info("Simulation seulement : rien n'a été modifié. Ajoutez --execute --confirm=<nom-de-la-base> pour effacer.");
  } else {
    if (process.env.WAVERTI_ALLOW_DESTRUCTIVE_RESET !== "yes") throw new Error("Outil destructif désactivé : définissez WAVERTI_ALLOW_DESTRUCTIVE_RESET=yes pour cette commande uniquement");
    if (confirm !== db) throw new Error(`Confirmation absente ou incorrecte : --confirm=${db} est requis`);
    if (!isPreview && !args.has("--production")) throw new Error("Base sans marqueur « preview » : --production est requis");
    const keepBefore: Record<string, number> = {};
    for (const t of KEEP) keepBefore[t] = Number((await sql.unsafe(`select count(*)::text as n from public."${t}"`))[0]?.n ?? 0);
    await sql.begin(async (tx) => {
      // « users » et « profiles » sont référencées par un réglage conservé (app_settings.updated_by, ON DELETE SET NULL) :
      // TRUNCATE est impossible sur elles, on les efface donc par DELETE (le réglage est conservé, son auteur passe à NULL).
      const bulk = tables.filter((t) => t !== "users" && t !== "profiles");
      await tx.unsafe(`truncate table ${bulk.map((t) => `public."${t}"`).join(", ")} restart identity`);
      await tx.unsafe(`delete from public.profiles`);
      await tx.unsafe(`delete from public.users`);
      for (const t of KEEP) {
        const n = Number((await tx.unsafe(`select count(*)::text as n from public."${t}"`))[0]?.n ?? 0);
        if (n !== keepBefore[t]) throw new Error(`Annulation : la table conservée « ${t} » aurait changé (${keepBefore[t]} → ${n})`);
      }
    });
    let left = 0;
    for (const t of tables) left += Number((await sql.unsafe(`select count(*)::text as n from public."${t}"`))[0]?.n ?? 0);
    console.info(`Terminé : ${total} ligne(s) effacée(s), ${left} restante(s). Tables conservées inchangées.`);
    if (left !== 0) process.exitCode = 1;
  }
} catch (e) {
  console.error(`Échec : ${(e as Error).message}. Aucune modification (transaction annulée).`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
