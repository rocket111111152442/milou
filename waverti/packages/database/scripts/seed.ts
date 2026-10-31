/**
 * Renseigne les identifiants de prix Stripe dans la table plans à partir de l'environnement.
 * Usage : DATABASE_URL=... STRIPE_PRICE_PLUS=price_... pnpm db:seed
 * Pour récupérer et vérifier les vrais price_ chez Stripe : `pnpm stripe:prices` (voir docs/STRIPE.md).
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL est requis");
  process.exit(1);
}
const mapping: Array<[table: "plans" | "plan_addons", id: string, env: string]> = [
  ["plans", "plus", "STRIPE_PRICE_PLUS"],
  ["plans", "pro", "STRIPE_PRICE_PRO"],
  ["plans", "max", "STRIPE_PRICE_MAX"],
  ["plans", "business", "STRIPE_PRICE_BUSINESS"],
  // L'ancienne option « site supplémentaire » est abandonnée : aucun prix ne lui est plus associé.
];
const sql = postgres(url, { max: 1, onnotice: () => undefined });
try {
  for (const [table, id, env] of mapping) {
    const price = process.env[env];
    if (!price) {
      console.warn(`${env} absent : ${table}.${id} sans prix Stripe (paiement indisponible pour cette formule)`);
      continue;
    }
    if (!/^price_[A-Za-z0-9]+$/.test(price)) throw new Error(`${env} invalide`);
    await sql`update ${sql(table)} set stripe_price_id = ${price} where id = ${id}`;
    console.log(`${table}.${id} -> ${price}`);
  }
} finally {
  await sql.end();
}
