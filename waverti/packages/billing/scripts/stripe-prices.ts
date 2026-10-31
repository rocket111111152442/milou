/**
 * Vérifie les prix Stripe réellement créés pour les QUATRE formules (aucun identifiant price_ n'est inventé).
 *
 *   STRIPE_SECRET_KEY=… pnpm stripe:prices                               vérification (lecture seule, y compris clé live)
 *   STRIPE_SECRET_KEY=… DATABASE_URL=… pnpm stripe:prices --write         enregistre aussi les price_ en base
 *   STRIPE_SECRET_KEY=sk_test_… pnpm stripe:prices --create-test-catalog  crée les prix manquants (MODE TEST UNIQUEMENT)
 *
 * Contrôle identique à celui du site avant chaque paiement (src/prices.ts) : prix actif, EUR, mensuel,
 * montant du catalogue. L'ancienne option « site supplémentaire » est seulement signalée si elle est encore active.
 */
import Stripe from "stripe";
import postgres from "postgres";
import { PAID_PLAN_IDS, PLAN_CATALOG } from "../src/catalog";
import { verifyPlanPrices } from "../src/prices";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY est requis (une clé restreinte en lecture suffit)");
  const live = /^(sk|rk)_live_/.test(key);
  const args = new Set(process.argv.slice(2));
  if (args.has("--create-test-catalog") && live) throw new Error("--create-test-catalog est refusé avec une clé live.");
  const opts: Stripe.StripeConfig = { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "Waverti price check" } };
  const base = process.env.STRIPE_API_BASE;
  if (base) {
    if (live) throw new Error("STRIPE_API_BASE est réservé aux tests (stripe-mock).");
    const u = new URL(base);
    opts.host = u.hostname;
    opts.port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
    opts.protocol = u.protocol.replace(":", "") as "http" | "https";
  }
  const stripe = new Stripe(key, opts);
  console.info(`Mode Stripe : ${live ? "PRODUCTION (lecture seule)" : "test"}`);

  let result = await verifyPlanPrices(stripe);
  if (args.has("--create-test-catalog")) {
    for (const c of result.plans.filter((p) => !p.priceId)) {
      const def = PLAN_CATALOG[c.planId];
      const product = await stripe.products.create({ name: `Waverti ${def.name}`, metadata: { waverti_plan: def.id } });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: def.priceCents,
        currency: "eur",
        recurring: { interval: "month" },
        lookup_key: def.stripeLookupKey,
        tax_behavior: "inclusive",
      });
      console.info(`créé (test) : ${def.stripeLookupKey} -> ${price.id}`);
    }
    result = await verifyPlanPrices(stripe);
  }

  for (const c of result.plans) {
    if (c.ok) console.info(`conforme  ${c.lookupKey} (${(c.expectedCents / 100).toFixed(2)} €) -> ${c.priceId}`);
    else console.error(`ÉCART     ${c.lookupKey}${c.priceId ? ` (${c.priceId})` : ""} : ${c.issues.join(" ; ")}`);
  }
  for (const k of result.retiredActive) console.warn(`ANCIENNE OPTION ENCORE ACTIVE : ${k} — inutilisée par Waverti, à archiver dans Stripe.`);
  const ok = result.plans.every((c) => c.ok);

  if (args.has("--write")) {
    if (!ok) throw new Error("Écarts détectés : rien n'est écrit en base.");
    const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL est requis avec --write");
    const sql = postgres(url, { max: 1, onnotice: () => undefined });
    try {
      for (const c of result.plans) await sql`update plans set stripe_price_id = ${c.priceId}, stripe_lookup_key = ${c.lookupKey} where id = ${c.planId}`;
      console.info(`Prix enregistrés en base (${PAID_PLAN_IDS.length} formules).`);
    } finally {
      await sql.end();
    }
  }
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
