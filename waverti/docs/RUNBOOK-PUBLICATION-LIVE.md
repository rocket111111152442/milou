# Runbook — publication des nouveaux prix en Production (Stripe Live)

Référence : commit **`337791a`** (CI entièrement verte, dernier de `claude/upbeat-ritchie-sll5u2`, aucun commit ultérieur à intégrer).
Production actuelle : `dpl_386L4GePyqMBL55DyXXvUV86WRrY` = commit `bd42dab`. **Rien de ce runbook n'a été exécuté.**
Chaque étape marquée 🔒 modifie Stripe Live, Neon Production ou Vercel Production : **elle n'est exécutée qu'après autorisation écrite explicite de LULLIN WEB pour cette étape**.
Une étape n'est « réussie » que si son contrôle a été réellement exécuté et son résultat noté.

## État vérifié (lecture seule)
| Élément | Constat |
| --- | --- |
| Commit de référence | `337791a` ; branche de développement inchangée depuis. Une branche `release/waverti` existe aussi sur GitHub, au même commit : **si elle est la Production Branch de Vercel, toute poussée dessus déploie en Production** → ne pas y pousser pendant la campagne. |
| Variables Vercel **Production** (noms) | Présentes : base Neon, Resend, Brave (`BRAVE_API_KEY`), inscription ouverte, bêta `pro:30`, MFA admin. **Absentes : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `WAVERTI_LIVE_PAYMENTS_ENABLED`.** Stripe est donc **inactif en Production** aujourd'hui (aucun paiement, aucun webhook traité). |
| Correctif isolé | Branche `hotfix/webhook-price-rotation` @ `3cc91a7` = `bd42dab` + **uniquement** 2 fichiers (`webhooks.ts` et son test ; 38 lignes ajoutées, 1 modifiée). Une première version (`774c0aa`) a échoué en CI : le test importé portait le montant Pro du nouveau catalogue ; corrigé dans `3cc91a7`. |
| Non vérifiable par moi | Production Branch ; existence d'abonnés Live ; endpoint webhook Live existant ; version PostgreSQL de Neon ; plan/fenêtre de restauration Neon. |

## Point préalable à trancher (lecture seule, par vous)
1. Existe-t-il déjà des abonnements **Live** ? (Stripe → Abonnements ; base : `select plan_id,status,count(*) from subscriptions group by 1,2;`). Noter les nombres : ils servent de référence aux contrôles.
2. Existe-t-il déjà un endpoint webhook Live vers `https://www.waverti.com/api/stripe/webhook` ? Comme Production n'a pas de secret de webhook, ses livraisons échouent aujourd'hui (Stripe réessaie ~3 jours).

## Fenêtre d'incohérence (à connaître)
Entre le **transfert des clés** (étape 5) et la **publication du nouveau catalogue** (étape 7), le serveur refuse tout paiement (« formule non disponible au paiement » : le montant du prix Stripe ≠ catalogue). C'est un échec **sûr** (aucun prélèvement erroné).
Comme Stripe est inactif en Production, aucun client n'est impacté. **Règle : ne poser les variables Stripe en Production (étape 8a) qu'après l'étape 7.**

---
## Étape 1 — Contrôle de la configuration Vercel Production (lecture)
Par vous, dans Vercel → `watchly` : Settings → Git (**Production Branch**), Settings → General (**Build Command** vide/par défaut, **Root Directory** `waverti/apps/web` ou équivalent inchangé), Settings → Environment Variables (liste du §État), Domains (`www.waverti.com`, `waverti.com`).
Contrôle : captures/notes ; Production Branch ≠ `main` idéalement (voir `PLAN-DEPLOIEMENT-SECURISE.md` §2). Aucune modification sans accord.
Retour arrière : sans objet (lecture).

## Étape 2 — Sauvegarde Neon + preuve de restaurabilité 🔒 (crée une branche Neon : écriture sur Neon Production)
Changement : **création d'une branche Neon enfant** de la branche de production (copie sans impact sur la production), nommée `backup-prix-AAAAMMJJ-HHMM`.
```bash
neonctl branches create --project-id <NEON_PROJECT_ID> --name backup-prix-$(date -u +%Y%m%d-%H%M) --parent <branche-production>
```
Contrôles (lecture seule, sur la production **et** sur la branche) :
```sql
select 'profiles',count(*) from profiles union all select 'subscriptions',count(*) from subscriptions
union all select 'entitlements',count(*) from entitlements union all select 'monitoring_tasks',count(*) from monitoring_tasks
union all select 'plans',count(*) from plans union all select 'migrations',count(*) from waverti_migrations.schema_migrations;
select id, price_cents, stripe_price_id from plans order by id;      -- valeurs de référence AVANT
```
Les deux jeux de résultats doivent être **identiques**. Preuve de restaurabilité : `pg_dump` (version ≥ serveur) + `infra/ops/backup-check.sh` (restauration dans une base jetable sur **un autre serveur**, comparaison table par table, exit 0).
Retour arrière : supprimer la branche de sauvegarde (aucun effet sur la production).

## Étape 3 — Publier le correctif de webhook SEUL 🔒 (Vercel Production)
Changement : déploiement Production du commit **`3cc91a7`** (branche `hotfix/webhook-price-rotation`) ; la production passe de `bd42dab` à `bd42dab + 2 fichiers`. Aucun changement visuel, de prix, de base, ni de variable.
Prérequis : CI verte de `3cc91a7`, **sur cette branche** (3 jobs).
Contrôles : déploiement `READY` ; alias `www.waverti.com` → nouveau `dpl_…` (API Vercel) ; `curl -s https://www.waverti.com/api/health` → `status:"ok"`, `schema.applied = 8` (inchangé) ; `/tarifs` affiche **toujours les anciens prix** (attendu à ce stade) ; `git diff bd42dab 3cc91a7 --stat` = 2 fichiers.
Retour arrière : Vercel *Instant Rollback* vers `dpl_386L4GePyqMBL55DyXXvUV86WRrY`.

## Étape 4 — Créer et vérifier les nouveaux prix Stripe Live 🔒 (Stripe Live : écriture)
Changement précis (Plus, Pro, Business uniquement ; **Max ne change pas et n'est pas touché**) : **créer 3 nouveaux prix** récurrents mensuels EUR, TTC (`tax_behavior=inclusive`) :
| Formule | Produit existant | Nouveau montant | Clé de recherche (à transférer à l'étape 5) |
| --- | --- | --- | --- |
| Plus | produit Plus | 9,99 € (999) | `waverti_plus_monthly` |
| Pro | produit Pro | 19,99 € (1999) | `waverti_pro_monthly` |
| Business | produit Business | 49,99 € (4999) | `waverti_business_monthly` |
À cette étape, créer **sans** clé de recherche (le transfert est l'étape 5) ; noter les 3 `price_…`. Aucun ancien prix ni abonnement n'est modifié.
Contrôles (lecture) : pour chaque nouveau prix, `GET /v1/prices/<id>` → `unit_amount`, `currency=eur`, `recurring.interval=month`, `interval_count=1`, `tax_behavior=inclusive`, `active=true`, `livemode=true` ; **aucun** changement sur les anciens prix ; nombre d'abonnements par formule = référence préalable.
Retour arrière : archiver (`active=false`) les 3 nouveaux prix (aucun abonné dessus).

## Étape 5 — Transférer les clés de recherche 🔒 (Stripe Live : écriture) — **après** l'étape 3 vérifiée
Changement : pour Plus, Pro, Business, `POST /v1/prices/<nouveau> -d lookup_key=<clé> -d transfer_lookup_key=true` : la clé quitte l'ancien prix (qui reste actif, mêmes abonnés) et va au nouveau.
Contrôles : `pnpm stripe:prices` (lecture) → **4 prix conformes au catalogue de `337791a`** (999 / 1999 / 2999 / 4999) ; anciens prix sans clé ; nombre d'abonnés par ancien prix inchangé ; un abonné test (le vôtre ou un échantillon) : période et statut inchangés dans Stripe.
Retour arrière : retransférer chaque clé à son **ancien** `price_…` (`transfer_lookup_key=true`), noté à l'étape 1 du préalable.
Note : pendant la fenêtre d'incohérence, tout paiement est refusé par le serveur (sûr).

## Étape 6 — Migration PostgreSQL des prix 🔒 (Neon Production : écriture)
Changement exact : **3 UPDATE** `plans.price_cents` (plus 599→999, pro 1499→1999, business 3999→4999) via le migrateur ; ligne de suivi `20261102010000` ajoutée. Prouvé non destructif (`price-migration.int.test.ts`).
```bash
WAVERTI_MIGRATE_TARGET=production pnpm db:migrate:env                      # simulation : attendu « 1 migration en attente »
WAVERTI_MIGRATE_TARGET=production pnpm db:migrate:env --execute --confirm=<nom-exact-de-la-base>
```
Contrôles : `select id, price_cents from plans order by id;` → business 4999, max 2999, plus 999, pro 1999 ; **mêmes comptages qu'à l'étape 2** (profiles, subscriptions, entitlements, tasks) ; `waverti_migrations.schema_migrations` = 9 lignes.
Retour arrière : `db/rollbacks/20261102010000_update_plan_prices.down.sql` (psql) puis `delete from waverti_migrations.schema_migrations where version='20261102010000';` ; en dernier recours restauration de la branche Neon de l'étape 2.

## Étape 7 — Publier les nouvelles pages et le nouveau catalogue 🔒 (Vercel Production)
Changement : déploiement Production du commit **`337791a`** (prix, page Abonnement allégée, tests, documents ; migrations hors build).
Prérequis : étapes 3, 5, 6 vérifiées ; CI de `337791a` verte (✅ déjà constatée).
Contrôles : build `READY`, alias basculé ; `/api/health` → `ok`, `schema.applied = schema.expected = 9` ; `curl -s https://www.waverti.com/tarifs | grep -o -E '[0-9]+,[0-9]{2} ?€' | sort | uniq -c` → uniquement 9,99 / 19,99 / 29,99 / 49,99 ; `/`, `/connexion`, `/tarifs` répondent 200 ; connexion d'un compte réel → page Abonnement affiche sa formule et ses dates inchangées.
Retour arrière : Instant Rollback vers le déploiement de l'étape 3 (qui garde le correctif) ; si la base doit aussi revenir : script de l'étape 6.

## Étape 8 — Ouvrir Stripe en Production et vérifier 🔒 (Vercel Production + Stripe Live)
8a. Changements Vercel Production (variables **sensibles**, saisies par vous, jamais dans le chat) : `STRIPE_SECRET_KEY` (clé `sk_live_…` ou restreinte), `STRIPE_WEBHOOK_SECRET` (`whsec_…` de l'endpoint Live vers `https://www.waverti.com/api/stripe/webhook`, 7 événements de `STRIPE.md` §4), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, puis **`WAVERTI_LIVE_PAYMENTS_ENABLED=true`** après validation des obligations applicables. Puis redéploiement du même commit (les variables ne s'appliquent qu'au déploiement suivant).
8b. Contrôles réels :
* `/api/health` → `billing.mode = "live"` (pas `live_blocked`).
* Montants : `pnpm stripe:prices` → 4 conformes ; création d'une session Checkout via l'application (sans payer) : le récapitulatif affiche le bon montant et la date du premier prélèvement.
* Abonnés existants : mêmes comptages et mêmes `current_period_end` qu'avant (comparaison avec l'étape 2) ; renvoyer un `customer.subscription.updated` d'un abonné existant depuis Stripe → 200, **dates et formule conservées** (c'est le test réel du correctif).
* Webhooks : Stripe → Développeurs → Webhooks → livraisons récentes toutes en 2xx ; renvoyer les événements en échec accumulés avant l'ouverture.
* Facturation réelle (**optionnelle, autorisation séparée**) : un paiement réel de Plus (9,99 €) par vous, vérification du montant sur la facture, puis remboursement et résiliation.
Retour arrière : retirer `WAVERTI_LIVE_PAYMENTS_ENABLED` (paiements bloqués, `live_blocked`) puis, si besoin, retirer les clés Stripe de Production et redéployer ; les abonnements ne sont pas touchés.

## Tableau des autorisations demandées
| # | Opération | Système | Effet |
| --- | --- | --- | --- |
| 2 | Branche de sauvegarde | Neon Production | création d'une branche copie ; aucun effet sur la production |
| 3 | Déploiement `3cc91a7` | Vercel Production | alias vers le correctif seul |
| 4 | 3 nouveaux prix | Stripe Live | création ; rien d'existant modifié |
| 5 | Transfert de 3 clés | Stripe Live | nouveaux prix deviennent ceux du catalogue |
| 6 | Migration des prix | Neon Production | 3 UPDATE de montants |
| 7 | Déploiement `337791a` | Vercel Production | nouvelles pages et catalogue |
| 8a | Variables Stripe + drapeau juridique + redéploiement | Vercel Production | ouverture des paiements réels |
