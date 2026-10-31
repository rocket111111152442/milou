/**
 * Étapes de déploiement Vercel, avant `next build` :
 * 1. Migrations : Production → DATABASE_URL ; Preview → PREVIEW_DATABASE_URL uniquement (base de test distincte,
 *    jamais la production : voir src/lib/database-url.ts). Idempotent, verrou consultatif ; un échec fait
 *    échouer le déploiement (l'ancienne version reste en ligne). L'adresse n'est jamais affichée.
 * 2. Preview avec une clé Stripe de TEST : contrôle en lecture seule des quatre prix (clés de recherche),
 *    résultat dans le journal de build (identifiants price_ et montants, aucun secret). Jamais avec une clé live.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { directDatabaseUrl } from "../src/lib/database-url";

const target = process.env.VERCEL_ENV;

function migrate(): number {
  if (target !== "production" && target !== "preview") {
    console.log(`[migrations] ignorées (environnement : ${target ?? "local"})`);
    return 0;
  }
  const direct = directDatabaseUrl(process.env);
  if (!direct) {
    console.log(
      target === "preview"
        ? "[migrations] ignorées : aucune base de test (PREVIEW_DATABASE_URL absent ou identique à la production)"
        : "[migrations] ignorées : DATABASE_URL absent",
    );
    return 0;
  }
  console.log(`[migrations] base ${target === "preview" ? "de TEST (Preview)" : "de production"}`);
  const script = fileURLToPath(new URL("../../../packages/database/scripts/migrate.ts", import.meta.url));
  const env = { ...process.env, DATABASE_URL_DIRECT: direct, DATABASE_URL: direct };
  const r = spawnSync("tsx", [script], { stdio: "inherit", env, shell: process.platform === "win32" });
  return r.status ?? 1;
}

async function checkStripeTestPrices(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (target !== "preview" || !/^(sk|rk)_test_/.test(key)) return;
  try {
    const { createStripeClient, verifyPlanPrices } = await import("@waverti/billing");
    const { plans, retiredActive } = await verifyPlanPrices(createStripeClient(key));
    for (const p of plans) {
      console.log(`[stripe-test] ${p.lookupKey} → ${p.priceId ?? "absent"} : ${p.ok ? "conforme" : p.issues.join(", ")}`);
    }
    if (retiredActive.length) console.log(`[stripe-test] ancienne option encore active : ${retiredActive.join(", ")}`);
  } catch (e) {
    console.log(`[stripe-test] vérification impossible : ${e instanceof Error ? e.message.slice(0, 160) : "erreur"}`);
  }
}

void (async () => {
  const status = migrate();
  if (status !== 0) process.exit(status);
  await checkStripeTestPrices();
})();
