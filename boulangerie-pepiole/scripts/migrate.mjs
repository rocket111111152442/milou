// Applique supabase/schema.sql avant le build si la base est reliée au projet.
import { readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] Pas de POSTGRES_URL : base non reliée, migration ignorée.");
  process.exit(0);
}

const sql = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
// L'URL fournie par l'intégration contient sslmode=require (et d'autres paramètres) : on les retire
// pour accepter le certificat Supabase sans CA locale.
const connectionString = url.split("?")[0];
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: local ? false : { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log("[migrate] Schéma Pétrin de Pépiole appliqué.");
} catch (err) {
  console.error("[migrate] Échec :", err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
