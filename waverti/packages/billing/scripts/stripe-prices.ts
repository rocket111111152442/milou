/**
 * Récupère et vérifie les prix Stripe réellement créés (aucun identifiant price_ n'est inventé).
 *
 *   STRIPE_SECRET_KEY=sk_test_… pnpm stripe:prices                      liste + vérifie, affiche les variables à renseigner
 *   STRIPE_SECRET_KEY=… DATABASE_URL=… pnpm stripe:prices --write        enregistre aussi les price_ dans la base
 *   STRIPE_SECRET_KEY=sk_test_… pnpm stripe:prices --create-test-catalog crée les produits manquants (MODE TEST UNIQUEMENT)
 *
 * Chaque prix est retrouvé par sa clé de recherche (lookup_key, ex. waverti_pro_monthly) puis comparé au catalogue :
 * montant, devise EUR, facturation mensuelle. En mode live, le script ne fait que des lectures.
 * Une clé restreinte (rk_…) avec lecture seule sur Products et Prices suffit pour la vérification.
 */
import Stripe from "stripe";
import postgres from "postgres";
import { EXTRA_SITE_ADDON, PLAN_CATALOG } from "../src/catalog";

type Expected = { table: "plans" | "plan_addons"; id: string; name: string; env: string; lookupKey: string; amount: number };

export const EXPECTED_PRICES: Expected[] = [
  ...Object.values(PLAN_CATALOG).map((p) => ({
    table: "plans" as const,
    id: p.id,
    name: `Waverti ${p.name}`,
    env: `STRIPE_PRICE_${p.id.toUpperCase()}`,
    lookupKey: p.stripeLookupKey,
    amount: p.priceCents,
  })),
  {
    table: "plan_addons",
    id: EXTRA_SITE_ADDON.id,
    name: `Waverti Business — ${EXTRA_SITE_ADDON.name}`,
    env: "STRIPE_PRICE_BUSINESS_EXTRA_SITE",
    lookupKey: EXTRA_SITE_ADDON.stripeLookupKey,
    amount: EXTRA_SITE_ADDON.priceCents,
  },
];

/** Problèmes d'un prix Stripe au regard du catalogue (vide : conforme). */
export function priceProblems(price: Pick<Stripe.Price, "unit_amount" | "currency" | "recurring" | "active" | "tax_behavior">, expected: Expected): string[] {
  const out: string[] = [];
  if (!price.active) out.push("prix archivé (inactif)");
  if (price.unit_amount !== expected.amount) out.push(`montant ${price.unit_amount} au lieu de ${expected.amount} centimes`);
  if (price.currency !== "eur") out.push(`devise ${price.currency} au lieu de eur`);
  if (price.recurring?.interval !== "month" || (price.recurring?.interval_count ?? 1) !== 1) out.push("facturation non mensuelle");
  if (price.tax_behavior && price.tax_behavior !== "inclusive") out.push(`prix ${price.tax_behavior} : les prix Waverti sont affichés TTC (attendu : inclusive)`);
  return out;
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY est requis (une clé restreinte en lecture suffit)");
  const live = /^(sk|rk)_live_/.test(key);
  const args = new Set(process.argv.slice(2));
  if (args.has("--create-test-catalog") && live) throw new Error("--create-test-catalog est refusé avec une clé live : créez le catalogue de production dans le tableau de bord Stripe.");
  const stripe = new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "Waverti price check" } });
  console.info(`Mode Stripe : ${live ? "PRODUCTION (lecture seule)" : "test"}`);

  const found = new Map<string, Stripe.Price>();
  const list = await stripe.prices.list({ lookup_keys: EXPECTED_PRICES.map((e) => e.lookupKey), limit: 20 });
  for (const p of list.data) if (p.lookup_key) found.set(p.lookup_key, p);

  if (args.has("--create-test-catalog")) {
    for (const e of EXPECTED_PRICES) {
      if (found.has(e.lookupKey)) continue;
      const product = await stripe.products.create({ name: e.name, metadata: { waverti_id: e.id } });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: e.amount,
        currency: "eur",
        recurring: { interval: "month" },
        lookup_key: e.lookupKey,
        tax_behavior: "inclusive",
      });
      found.set(e.lookupKey, price);
      console.info(`créé (test) : ${e.lookupKey} -> ${price.id}`);
    }
  }

  let ok = true;
  const lines: string[] = [];
  for (const e of EXPECTED_PRICES) {
    const p = found.get(e.lookupKey);
    if (!p) {
      ok = false;
      console.error(`MANQUANT  ${e.lookupKey} (${e.name}, ${(e.amount / 100).toFixed(2)} €/mois) : ajoutez cette clé de recherche au prix dans Stripe`);
      continue;
    }
    const problems = priceProblems(p, e);
    if (problems.length) {
      ok = false;
      console.error(`ÉCART     ${e.lookupKey} (${p.id}) : ${problems.join(" ; ")}`);
    } else console.info(`conforme  ${e.lookupKey} -> ${p.id}`);
    lines.push(`${e.env}=${p.id}`);
  }
  console.info(`\nVariables à renseigner (${live ? "environnement Production" : "environnement Preview / test"}) :\n${lines.join("\n")}`);

  if (args.has("--write")) {
    if (!ok) throw new Error("Écarts détectés : rien n'est écrit en base.");
    const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL est requis avec --write");
    const sql = postgres(url, { max: 1, onnotice: () => undefined });
    try {
      for (const e of EXPECTED_PRICES) {
        const p = found.get(e.lookupKey)!;
        await sql`update ${sql(e.table)} set stripe_price_id = ${p.id}, stripe_lookup_key = ${e.lookupKey} where id = ${e.id}`;
      }
      console.info("Prix enregistrés en base.");
    } finally {
      await sql.end();
    }
  }
  if (!ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error((err as Error).message);
    process.exit(1);
  });
}
