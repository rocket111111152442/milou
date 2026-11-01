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
