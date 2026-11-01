# Plan de publication — nouveaux prix (9,99 / 19,99 / 29,99 / 49,99 €)

Rédigé le 1er novembre 2026. **Rien n'a été déployé en Production, aucune migration n'a été exécutée, Stripe n'a pas été interrogé ni modifié.**

## A. Constats (état vérifié)

| Point | Constat |
| --- | --- |
| CI de `44c86a6` | Tentative 1 : typage/lint/tests **succès**, E2E web **succès**, E2E desktop **échec de nettoyage seulement** (5 tests sur 5 réussis ; erreur `ENOTEMPTY … mesa_shader_cache` à la suppression du dossier temporaire). Tentative 2 (relance du seul job desktop) : **annulée** car la poussée suivante (`5916665`) a pris la place (`cancel-in-progress`). **Aucune exécution entièrement verte de `44c86a6`.** La validation à retenir est celle du commit de publication final (voir §E). |
| En Production | Alias `www.waverti.com` → `dpl_386L4GePyqMBL55DyXXvUV86WRrY`, commit **`bd42dab`** (branche `claude/upbeat-ritchie-sll5u2`, créé 18:04 UTC). Les pages publiques affichent encore **5,99 / 14,99 / 29,99 / 39,99 €** (mesuré sur `/` et `/tarifs`). |
| Différence `bd42dab` → `44c86a6` | 16 fichiers : catalogue (3 prix), migration `20261102010000`, textes du site, page Abonnement, tests, documents. |
| Différence `44c86a6` → `5916665` | Autre session : build sans migration, outil `db:migrate:env`, maintenance Brave non destructive, `db:reset-data` verrouillé, document `PLAN-DEPLOIEMENT-SECURISE.md`. |
| Branche de Production configurée | **Non lisible** avec les outils disponibles. Donnée fournie par LULLIN WEB : `main` (application Firestore sans rapport). Les déploiements Production réels viennent de la branche de développement, par création/redéploiement manuels. À vérifier dans Vercel → Settings → Git. |
| Migrations dans le build | **Supprimées** (`build` = `next build`). Une seule migration est en attente : `20261102010000_update_plan_prices`. |
| Prix Stripe | **Non vérifiés** : aucun accès à Stripe depuis cette session. Voir §C. |
| Cohérence catalogue / base / pages | **Vérifiée par test** (`packages/billing/test/price-consistency.int.test.ts`) : catalogue = base migrée = textes publics, clés de recherche comprises ; le test échoue si un ancien prix est réintroduit (vérifié). Stripe exclu. |

### Piège d'ordre (important)
La page `/tarifs` est **pré-calculée au build** à partir de la table `plans`. Si on déploie **avant** la migration, la nouvelle version affichera les **anciens** prix tirés de la base, alors que le catalogue du code exigera les nouveaux. **La migration passe donc avant le déploiement.** Une base migrée avec l'ancien code est sans danger (même lecture, montants différents seulement visibles au prochain build ; aucun paiement n'est possible en Production tant que Stripe n'y est pas configuré).

## B. Ce que je n'ai pas fait et ne ferai pas sans accord
Déployer en Production ; exécuter la migration ; créer ou modifier un prix Stripe ; toucher aux abonnements ; poser des variables Vercel.

## C. Prix Stripe (à faire par LULLIN WEB, en lecture seule pour la vérification)
1. Dans Stripe (mode live, puis test pour la Preview), quatre prix **mensuels, EUR, TTC (`tax_behavior=inclusive`), à l'unité** :

   | Formule | Montant (centimes) | `lookup_key` |
   | --- | --- | --- |
   | Plus | 999 | `waverti_plus_monthly` |
   | Pro | 1999 | `waverti_pro_monthly` |
   | Max | 2999 | `waverti_max_monthly` |
   | Business | 4999 | `waverti_business_monthly` |

   Un prix Stripe est **immuable** : pour Plus, Pro et Business, créer un **nouveau** prix et lui transférer la clé de recherche (« transfer lookup key »), puis archiver l'ancien. Les abonnements existants restent sur leur ancien prix (non touchés).
2. Vérification **sans écriture** (une clé restreinte en lecture suffit, même en live) :
   ```bash
   STRIPE_SECRET_KEY='<clé>' pnpm stripe:prices
   ```
   Attendu : 4 prix « conformes ». Tout écart = ne pas ouvrir les paiements.

## D. Procédure de migration séparée (sauvegarde et retour arrière)
Outil : `pnpm db:migrate:env` (simulation par défaut ; production : `--execute --confirm=<nom exact de la base>`).

0. **Sauvegarde** (LULLIN WEB) : branche/point de restauration Neon de la base de production **avant** toute migration, et noter son identifiant. À défaut : `pg_dump --format=custom` de la base, conservé hors serveur.
1. **Simulation** :
   ```bash
   WAVERTI_MIGRATE_TARGET=production pnpm db:migrate:env
   ```
   Attendu : exactement 1 migration en attente (`20261102010000 update_plan_prices`). Autre chose = arrêt.
2. **Prévisualisation du contenu** (lecture seule) : `select id, price_cents from plans order by 1;` → attendu 599 / 2999 / 1499 / 3999 avant.
3. **Exécution** : `WAVERTI_MIGRATE_TARGET=production pnpm db:migrate:env --execute --confirm=<nom-de-la-base>`.
4. **Contrôle** : mêmes valeurs → 999 / 2999 / 1999 / 4999 ; nombre de comptes, d'abonnements et de surveillances **identique** à l'avant (comptage avant/après).
5. **Retour arrière** (la migration ne modifie que 3 montants) : `db/rollbacks/20261102010000_update_plan_prices.down.sql` à la main, puis supprimer la ligne `20261102010000` de `waverti_migrations.schema_migrations`. En cas de doute sur autre chose : restauration de la sauvegarde de l'étape 0.

La Preview suit la même procédure avec `WAVERTI_MIGRATE_TARGET=preview` (la base de test n'est plus mise à jour par le build).

## E. Plan de publication, dans l'ordre

| # | Étape | Critère de passage | Retour arrière |
| --- | --- | --- | --- |
| 1 | Figer **un** commit de publication (le dernier de la branche) ; aucune poussée ensuite | CI de **ce** commit entièrement verte (typage, E2E web, E2E desktop) ; si le job desktop échoue sur le seul nettoyage `ENOTEMPTY`, le relancer, sans conclure avant qu'il soit vert | — |
| 2 | Tests locaux : `pnpm vitest run` (dont `price-consistency`), `pnpm turbo typecheck lint` | tout vert | — |
| 3 | Prix Stripe (§C) créés et vérifiés **avant** toute ouverture des paiements | `stripe:prices` : 4 conformes | archiver les nouveaux prix, rendre la clé aux anciens |
| 4 | Sauvegarde Neon (§D.0) | identifiant noté | — |
| 5 | Migration production (§D.1–4) | 1 migration, valeurs attendues, comptages identiques | script de retour arrière (§D.5) |
| 6 | Déploiement du commit figé en Production (le build ne touche plus à la base) | build réussi ; alias basculé | Vercel **Instant Rollback** vers `dpl_386L4G…` (`bd42dab`) — compatible : la base à 9 migrations avec l'ancien code est « ok » (`/api/health` n'est « degraded » que si `applied < expected`) |
| 7 | Vérifications : `/api/health` (`schema.applied = 9 = expected`, `database: ok`) ; `/` et `/tarifs` affichent 9,99 / 19,99 / 29,99 / 49,99 € et plus aucun ancien prix ; `/connexion` 200 ; compte test connecté (page Abonnement) ; comptages identiques | tout conforme | rollback étape 6 puis, si besoin, étape 5 |
| 8 | Ouverture des paiements (variables Stripe, drapeau juridique) **séparément**, après accord écrit | `billing.mode` attendu, premier paiement de test à vous | retirer les variables Stripe |

## F. Points qui bloquent encore la publication
1. CI entièrement verte du commit final (aucune pour `44c86a6`).
2. Prix Stripe non vérifiés.
3. Sauvegarde Neon à faire.
4. Production Branch de Vercel à vérifier (`main` annoncé).

---

## G. Compléments (vérifications demandées le 1er novembre, soir)

### G1. État de la CI et du commit
* Commit `34b6b35` : **CI entièrement verte à la première tentative** (typage/lint/tests, E2E web, E2E desktop : succès). Aucun autre commit ne l'a remplacé au moment du contrôle.
  Un correctif de facturation (voir G3) crée un **nouveau commit de publication** : c'est **lui** qu'il faudra valider, pas `34b6b35`.

### G2. La migration des prix est non destructive (prouvé)
Test `packages/database/test/price-migration.int.test.ts` : le script ne contient que 3 `UPDATE plans SET price_cents` ; avec deux abonnements et deux comptes présents,
l'empreinte de **chaque table** est identique avant/après sauf `plans` ; les abonnements restent intacts ; rejouer la migration est sans effet ; le script de retour arrière rétablit les anciens montants.

### G3. Correctif découvert pendant la vérification (à déployer avant de transférer les clés Stripe)
Après un transfert de clé de recherche, un webhook d'un abonné resté sur l'ancien prix **effaçait ses dates de période**. Corrigé et testé (`webhooks.ts`, test « rotation des prix Stripe »).
Détails et procédure : `docs/PROCEDURE-STRIPE-PRIX.md`.

### G4. Sauvegarde et restauration
Outil **lecture seule** : `infra/ops/backup-check.sh` (pg_dump format custom → `pg_restore --list` → restauration dans une base **jetable** d'un autre serveur → comparaison du
nombre de lignes de chaque table → suppression de la base jetable). Éprouvé en local (9 migrations, restauration concordante). Il refuse un serveur jetable identique à la source.
* Version : utiliser un `pg_dump` **de version ≥ celle du serveur** (Neon : voir la version du projet), sinon `pg_dump` refuse.
* Neon (avant la migration) : (a) Console Neon → projet → **Branches** → créer une branche depuis la branche de production (« backup-prix-AAAAMMJJ »), noter son identifiant ; ou en CLI
  `neonctl branches create --project-id <id> --name backup-prix-AAAAMMJJ --parent <branche-prod>` ; (b) contrôle : se connecter à la branche de sauvegarde et comparer
  `select count(*)` de `profiles`, `subscriptions`, `monitoring_tasks`, `notifications` avec la production ; (c) en plus, `backup-check.sh` pour un fichier hors Neon.
* Restauration (si besoin) : Console Neon → **Restore** de la branche de production à l'instant/branche de sauvegarde (en conservant l'ancienne branche sous un autre nom), ou `neonctl branches restore`
  (options exactes à vérifier avec `neonctl branches restore --help` : non testé ici) ; à défaut `pg_restore --clean --if-exists` du fichier. La fenêtre de restauration dépend du plan Neon : à confirmer dans la Console.
* Les commandes `neonctl` n'ont pas été exécutées (aucun accès Neon).

### G5. Production Branch de Vercel
**Non lisible** avec les outils disponibles (le champ n'est exposé ni par `get_project` ni par la liste des projets). Preuve indirecte : sur les ~20 derniers déploiements Production,
tous viennent de `claude/upbeat-ritchie-sll5u2` ou `codex/public-downloads` (jamais de `main`), et les poussées Git créent des Preview. À contrôler : Vercel → watchly → Settings → Git →
« Production Branch » (annoncée `main`), et Settings → General → « Build Command » (doit rester vide/par défaut).

### G6. Commandes exactes, dans l'ordre (aucune n'a été lancée)
```bash
# 0. Figer le commit de publication et vérifier la CI (GitHub : les 3 jobs verts sur CE commit)
git fetch origin claude/upbeat-ritchie-sll5u2 && git rev-parse origin/claude/upbeat-ritchie-sll5u2

# 1. Tests locaux
pnpm turbo typecheck lint && TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres pnpm vitest run

# 2. Sauvegarde (Neon : branche de sauvegarde, §G4) + fichier vérifié
SOURCE_URL='<url directe prod>' SCRATCH_ADMIN_URL='<serveur jetable, hôte différent>' bash infra/ops/backup-check.sh ./backups

# 3. Prix Stripe : procédure docs/PROCEDURE-STRIPE-PRIX.md puis
STRIPE_SECRET_KEY='<lecture>' pnpm stripe:prices                      # attendu : 4 conformes

# 4. Migration (simulation puis exécution)
WAVERTI_MIGRATE_TARGET=production pnpm db:migrate:env                 # attendu : 1 migration en attente (20261102010000)
WAVERTI_MIGRATE_TARGET=production pnpm db:migrate:env --execute --confirm=<nom-exact-de-la-base>

# 5. Contrôle base : prix + comptages
psql "$DATABASE_URL_UNPOOLED" -c "select id, price_cents from plans order by 1"   # 999 / 2999 / 1999 / 4999 (ordre alphabétique : business, max, plus, pro)

# 6. Déploiement du commit figé (Vercel → Deployments → ... ou création API sur le SHA exact) — sur autorisation écrite

# 7. Vérifications
curl -s https://www.waverti.com/api/health          # status ok ; schema.applied = schema.expected = 9
curl -s https://www.waverti.com/tarifs | grep -o -E '[0-9]+,[0-9]{2} ?€' | sort | uniq -c   # 9,99 / 19,99 / 29,99 / 49,99 uniquement
```
**Retour arrière** : code → Vercel *Instant Rollback* vers `dpl_386L4GePyqMBL55DyXXvUV86WRrY` (`bd42dab`) ; base → `db/rollbacks/20261102010000_update_plan_prices.down.sql` puis suppression de la ligne
`20261102010000` de `waverti_migrations.schema_migrations` ; en dernier recours, restauration Neon (§G4). Stripe : §6 de `PROCEDURE-STRIPE-PRIX.md`.
