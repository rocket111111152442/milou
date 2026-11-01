/**
 * UNE requête Brave réelle, uniquement sur autorisation écrite du propriétaire :
 *   WAVERTI_LIVE_BRAVE_TEST=AUTHORIZED_ONE_REQUEST BRAVE_SEARCH_API_KEY=… pnpm --filter @waverti/monitoring exec tsx scripts/brave-live-probe.ts
 * Sans l'autorisation, le script s'arrête avant tout appel. Aucune base de données, aucun fichier écrit.
 */
import { runSingleBraveProbe, type ProductTarget } from "../src/products";

const target: ProductTarget = {
  identity: { brand: "NumWorks", name: "NumWorks Calculatrice graphique N0120", mpn: "N0120" },
  condition: "new",
  currency: "EUR",
  country: "FR",
};

runSingleBraveProbe({ env: process.env, target })
  .then((r) => console.log(JSON.stringify({ ...r, candidates: r.candidates.map((c) => c.hostname) }, null, 2)))
  .catch((e: Error) => {
    console.error(e.message);
    process.exitCode = 2;
  });
