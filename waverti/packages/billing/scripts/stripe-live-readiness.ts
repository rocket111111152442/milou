/**
 * Contrôle de MISE EN SERVICE de Stripe Live — LECTURE SEULE (une clé restreinte en lecture suffit ; aucune écriture, aucun paiement).
 *
 *   STRIPE_SECRET_KEY=rk_live_… pnpm stripe:live-readiness
 *
 * Vérifie : 1) compte (paiements et virements activés, informations soumises, aucune exigence en retard) ;
 *           2) les quatre prix (actifs, EUR, mensuels, TTC, montants et clés de recherche attendus) ;
 *           3) l'endpoint webhook vers www.waverti.com (activé, 7 événements requis) ;
 *           4) l'état des abonnements existants (comptes par statut et par prix, sans aucune donnée personnelle).
 * Code de sortie ≠ 0 s'il reste un BLOCAGE. La validation juridique (CGV, TVA, habilitation du titulaire) n'est PAS vérifiable par API.
 */
import Stripe from "stripe";
import { PAID_PLAN_IDS, PLAN_CATALOG } from "../src/catalog";
import { verifyPlanPrices } from "../src/prices";

const WEBHOOK_URL = "https://www.waverti.com/api/stripe/webhook";
const REQUIRED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
];

async function main(): Promise<number> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY est requis (clé restreinte en lecture recommandée)");
  const live = /^(sk|rk)_live_/.test(key);
  const opts: Stripe.StripeConfig = { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "Waverti live readiness (read-only)" } };
  if (process.env.STRIPE_API_BASE) {
    if (live) throw new Error("STRIPE_API_BASE est réservé aux tests (stripe-mock).");
    const u = new URL(process.env.STRIPE_API_BASE);
    opts.host = u.hostname;
    opts.port = Number(u.port || 80);
    opts.protocol = u.protocol.replace(":", "") as "http" | "https";
  }
  const stripe = new Stripe(key, opts);
  const blockers: string[] = [];
  const warnings: string[] = [];
  console.info(`Mode de la clé : ${live ? "LIVE" : "test"} (lecture seule)`);
  if (!live) warnings.push("clé de test : ce contrôle ne dit rien du compte Live");

  // 1. Compte
  const acc = await stripe.accounts.retrieve();
  console.info(`\n[1] Compte : pays ${acc.country ?? "?"}, type ${acc.business_type ?? "?"}, devise ${acc.default_currency ?? "?"}`);
  console.info(`    paiements activés : ${acc.charges_enabled}, virements activés : ${acc.payouts_enabled}, informations soumises : ${acc.details_submitted}`);
  if (!acc.charges_enabled) blockers.push("le compte n'est pas autorisé à encaisser (charges_enabled = false)");
  if (!acc.payouts_enabled) warnings.push("virements non activés (payouts_enabled = false)");
  if (!acc.details_submitted) blockers.push("informations du compte non soumises (details_submitted = false)");
  const due = acc.requirements?.currently_due ?? [];
  const past = acc.requirements?.past_due ?? [];
  if (past.length) blockers.push(`exigences en retard : ${past.join(", ")}`);
  if (due.length) warnings.push(`exigences à fournir : ${due.join(", ")}`);
  if (acc.requirements?.disabled_reason) blockers.push(`compte restreint : ${acc.requirements.disabled_reason}`);

  // 2. Prix
  const { plans, retiredActive } = await verifyPlanPrices(stripe);
  console.info("\n[2] Prix");
  for (const p of plans) {
    console.info(`    ${p.lookupKey} -> ${p.priceId ?? "ABSENT"} : ${p.ok ? "conforme" : p.issues.join(", ")} (attendu ${PLAN_CATALOG[p.planId].priceCents} c)`);
    if (!p.ok) blockers.push(`prix ${p.lookupKey} non conforme : ${p.issues.join(", ")}`);
  }
  if (retiredActive.length) warnings.push(`ancienne option encore active : ${retiredActive.join(", ")}`);

  // 3. Webhook
  const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
  const hook = hooks.data.find((h) => h.url === WEBHOOK_URL);
  console.info(`\n[3] Webhook ${WEBHOOK_URL}`);
  if (!hook) blockers.push(`aucun endpoint webhook vers ${WEBHOOK_URL}`);
  else {
    const events = new Set(hook.enabled_events);
    const missing = events.has("*") ? [] : REQUIRED_EVENTS.filter((e) => !events.has(e));
    console.info(`    statut : ${hook.status}, événements manquants : ${missing.length ? missing.join(", ") : "aucun"}, mode live : ${hook.livemode}`);
    if (hook.status !== "enabled") blockers.push("endpoint webhook désactivé");
    if (missing.length) blockers.push(`événements webhook manquants : ${missing.join(", ")}`);
  }

  // 4. Abonnements existants (comptes uniquement)
  console.info("\n[4] Abonnements existants (comptes, aucune donnée personnelle)");
  const current = new Map(plans.filter((p) => p.priceId).map((p) => [p.priceId!, p.planId]));
  const tally = new Map<string, number>();
  let total = 0;
  for await (const s of stripe.subscriptions.list({ status: "all", limit: 100 })) {
    total++;
    for (const it of s.items.data) {
      const label = current.has(it.price.id) ? `prix courant ${current.get(it.price.id)}` : `ancien/autre prix ${it.price.unit_amount ?? "?"} c`;
      const k = `${s.status} · ${label}`;
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
  }
  console.info(`    total : ${total}`);
  for (const [k, n] of [...tally.entries()].sort()) console.info(`    ${String(n).padStart(4)}  ${k}`);
  console.info("    Les abonnés sur un ancien prix gardent leur montant : c'est attendu (aucune migration d'abonné n'est faite).");

  console.info(`\nPlans vérifiés : ${PAID_PLAN_IDS.join(", ")}`);
  for (const w of warnings) console.warn(`AVERTISSEMENT : ${w}`);
  for (const b of blockers) console.error(`BLOCAGE : ${b}`);
  console.info(blockers.length ? `\nRÉSULTAT : NON PRÊT (${blockers.length} blocage(s)).` : "\nRÉSULTAT : aucun blocage technique côté Stripe. Reste la validation juridique (non vérifiable par API).");
  return blockers.length ? 1 : 0;
}

process.exitCode = await main().catch((e) => {
  console.error(`Échec : ${e instanceof Error ? e.message.slice(0, 200) : "erreur"}`);
  return 2;
});
