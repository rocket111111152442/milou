/**
 * Neutralisation MANUELLE des résultats Brave déjà conservés (jamais lancée automatiquement).
 *   DATABASE_URL=… pnpm brave:enforce                                   # simulation : compte, ne modifie rien
 *   DATABASE_URL=… WAVERTI_ALLOW_DESTRUCTIVE_ENFORCE=yes pnpm brave:enforce --execute --confirm=<nom-de-la-base> [--scrub-history]
 * Modifie des données (caches supprimés, adresses/titres vidés, historique masqué avec --scrub-history) : à ne lancer
 * qu'après sauvegarde et décision explicite. Sans effet si WAVERTI_BRAVE_STORAGE_RIGHTS=granted.
 */
import { createDb, sql } from "@waverti/database";
import { braveStorageRightsFromEnv, enforceBraveStoragePolicy } from "../src/search";

const args = process.argv.slice(2);
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL est requis");
  process.exit(1);
}
const h = createDb(url, { max: 1, applicationName: "waverti-brave-enforce" });
try {
  const db = (await h.db.execute<{ db: string }>(sql`select current_database() as db`))[0]?.db ?? "";
  const execute = args.includes("--execute");
  if (execute) {
    if (process.env.WAVERTI_ALLOW_DESTRUCTIVE_ENFORCE !== "yes") throw new Error("WAVERTI_ALLOW_DESTRUCTIVE_ENFORCE=yes est requis");
    if (args.find((a) => a.startsWith("--confirm="))?.slice(10) !== db) throw new Error(`--confirm=${db} est requis`);
  }
  const c = await enforceBraveStoragePolicy(h.db, braveStorageRightsFromEnv(process.env), { dryRun: !execute, scrubHistory: args.includes("--scrub-history") });
  console.info(execute ? "Exécuté :" : "Simulation (rien n'a été modifié) :", c);
} catch (e) {
  console.error(`Échec : ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  await h.close();
}
