# Déploiements sécurisés — constat, correctifs, plan et retour arrière

Date : 2026-11-01. Lecture seule côté Vercel : **aucun réglage Vercel, aucune variable, aucune base n'a été modifié.**

## 1. Constat Vercel (projet `watchly`, `prj_jgMEi5CYffPUwx6eY0vDaGXrNXks`)

| Constat | Source |
| --- | --- |
| Production Branch déclarée : `main` (information donnée par LULLIN WEB ; non lisible par l'API disponible) | utilisateur |
| Pourtant, les déploiements « production » récents de `watchly` viennent de la branche `claude/upbeat-ritchie-sll5u2` (commits `fb6af4a`, `3c2ea27`, `c429092` ×2, `bd42dab`) : redéploiements/créations manuels, pas des poussées sur `main` | API Vercel |
| `main` contient une **autre application** (Firestore) et 76 commits de moins | `git log` |
| Protection SSO : `all_except_custom_domains` (Preview protégée, domaine `www.waverti.com` public) | API Vercel |
| 4 autres projets sont reliés au même dépôt `milou` : `acorimmo`, `biorythme`, `empreinte-de-violettes`, `petrin-de-pepiole` (+ 15 projets d'équipe sans rapport) | API Vercel (déploiements) |
| Non vérifiable : Root Directory, Build Command surchargée dans le tableau de bord, Ignored Build Step, « Auto-assign domains » | — |

**Risque réel** : si `main` est la Production Branch, une poussée sur `main` déploierait sur `waverti.com` une application qui n'est
pas Waverti. Inversement, tant que la Production n'est alimentée que par des déploiements manuels de la branche de développement,
ce que voit le public dépend d'un geste manuel non tracé.

## 2. Proposition (à décider par LULLIN WEB — rien n'a été changé)

1. Créer une branche **stable** `release/waverti` à partir d'un commit validé (jamais de travail courant dessus ; fusion uniquement
   depuis la branche de développement après validation).
2. Vercel → `watchly` → Settings → Git → **Production Branch = `release/waverti`**.
3. Poussées sur `main` : plus aucun déploiement Production de `watchly` (elles produisent des Preview, voire rien avec un
   *Ignored Build Step*). C'est voulu : `main` n'est pas Waverti.
4. Toute autre branche (dont `claude/*`) = Preview uniquement, avec les variables **Preview** (base de test, Stripe TEST).
5. Optionnel : *Ignored Build Step* pour que `watchly` ne se construise que sur `release/waverti` et les branches `claude/*`.

**Conséquences** : (a) la Production ne change plus que par une fusion explicite dans `release/waverti` ; (b) les déploiements
Production existants et le domaine ne bougent pas au moment du réglage (seuls les futurs déploiements sont concernés) ; (c) un
redéploiement manuel d'un ancien commit reste possible ; (d) la protection de branche GitHub sur `release/waverti` (PR + CI obligatoire)
est recommandée ; (e) le réglage est propre à chaque projet : **les 4 autres projets ne sont pas affectés** ; mes changements
restent dans `waverti/`, aucun fichier racine du dépôt (`vercel.json` de `frontend/`, etc.) n'est touché.

Retour arrière du réglage : remettre la Production Branch précédente dans le même écran (effet immédiat sur les futurs déploiements).

## 3. Migrations séparées du build (corrigé dans ce commit)

Avant : `apps/web` `build` = `tsx scripts/deploy-migrate.ts && next build` → **chaque build Production et Preview appliquait les migrations**
(et écrivait le marqueur `preview`, et appelait Stripe TEST). Un simple redéploiement pouvait donc modifier le schéma.

Après :
* `build` = `next build` (testé : aucun script `migrat|db:|seed|reset` dans le build, ni dans `turbo.json`).
* Outil manuel `pnpm db:migrate:env` : **simulation par défaut** (liste les migrations en attente), `--execute` pour appliquer ;
  `WAVERTI_MIGRATE_TARGET=preview` (base de test uniquement, refusée si elle désigne le serveur de production) ou `production`
  (exige `--confirm=<nom exact de la base>`). Seul `db/migrations/` est lu.
* À vérifier dans le tableau de bord (non lisible ici) : que la *Build Command* du projet n'est pas surchargée par une commande
  appelant des migrations. Aucun `vercel.json` ne existe dans `waverti/`.
* **Conséquence** : un déploiement Preview ne met plus la base de test à jour tout seul ; lancer `db:migrate:env` avant de tester une
  migration. Une migration est en attente : `20261102010000_update_plan_prices` (voir `docs/PLAN-PUBLICATION-PRIX.md`, qui détaille l'ordre migration → déploiement). Le catalogue produits reste dans `db/migrations-pending/`.

## 4. Lot 4 rendu non destructif (corrigé dans ce commit)

* Avant : `runMaintenance` (toutes les heures, sans droits Brave confirmés = défaut) **supprimait** `search_cache` Brave, **vidait** adresses et
  titres de `monitoring_seen_items`, et **réécrivait** `monitoring_results` des sujets web — automatiquement, sans sauvegarde.
* Après : la maintenance **compte seulement** (lecture seule, journalisée). La neutralisation devient `pnpm brave:enforce` :
  simulation par défaut ; `--execute` exige `WAVERTI_ALLOW_DESTRUCTIVE_ENFORCE=yes` **et** `--confirm=<nom de la base>`.
* `db:reset-data` (déjà manuel, simulation par défaut) exige en plus `WAVERTI_ALLOW_DESTRUCTIVE_RESET=yes`.
* **Restrictions Brave conservées** : sans `WAVERTI_BRAVE_STORAGE_RIGHTS=granted`, les **nouveaux** résultats ne sont pas conservés
  (`runWebTopic`, inchangé, testé) ; la migration du catalogue reste non appliquée ; le test réel Brave reste verrouillé.
  Limite assumée : les données Brave **déjà** en base ne sont plus neutralisées automatiquement ; c'est une décision à prendre
  explicitement (sauvegarde, puis `brave:enforce`). Voir `docs/BRAVE-CONFORMITE.md`.
* Tests : `apps/worker/test/maintenance-nondestructive.int.test.ts` (3 comptes, 4 e-mails de confirmation, alertes, caches : empreinte
  des tables identique avant/après la maintenance ; vérifié qu'il **échoue** sur l'ancien code).

## 5. Plan de déploiement avec retour arrière (rien n'est exécuté sans accord explicite)

| Étape | Action | Retour arrière |
| --- | --- | --- |
| 0 | Sauvegarde/point de restauration Neon de la base de production (à faire par LULLIN WEB) | — |
| 1 | Fusionner la branche de correctifs dans `release/waverti` (PR) ; la CI doit être verte | `git revert` de la fusion |
| 2 | Régler la Production Branch (section 2) — aucun déploiement immédiat | remettre l'ancien réglage |
| 3 | Déploiement Production du commit validé (le build ne touche plus la base) | Vercel → *Instant Rollback* vers `c429092` (compatible avec une base migrée : `/api/health` n'est « degraded » que si `applied < expected`) |
| 4 | Contrôle : `/api/health`, connexion d'un compte test, comptage des lignes (3 comptes, 4 e-mails) identique à l'avant | — |
| 5 | Migrations de production : **séparément**, `db:migrate:env` en simulation puis, sur accord, `--execute --confirm=…` | restauration Neon (les migrations sont additives) |

## 6. Branche stable `release/waverti` (créée le 1er novembre 2026)

* Créée à partir du commit **`337791a`** de `claude/upbeat-ritchie-sll5u2`, validé avant création dans un worktree propre : typage, lint, 667 tests (3 ignorés) réussis.
  Elle contient : le build sans migrations, le lot 4 non destructif, les nouveaux prix (catalogue + migration **non appliquée**), le correctif de webhook pour la rotation des prix Stripe.
* **La Production Branch Vercel n'a pas été modifiée** et rien n'est déployé en Production.
* Fusions futures : uniquement par pull request depuis la branche de développement, CI verte. Ne jamais pousser de travail courant dessus.
* **Protections** — constatées : (a) le build ne touche plus à la base ; (b) aucune GitHub Action du dépôt ne déploie en Production ; (c) les pushs de branche créent des déploiements Preview (cible « preview »).
  **Non vérifiables ici** (pas d'accès aux réglages) : règles de protection de branche GitHub sur `release/waverti` et `main` (à activer : pull request obligatoire, CI « Waverti — CI » obligatoire, pas de force-push), « Ignored Build Step » Vercel, Build Command surchargée dans Vercel, valeur réelle de la Production Branch.
* **Autres sessions (prix Stripe)** : elles poussent sur `claude/upbeat-ritchie-sll5u2` (commits `567fc49`, `44c86a6`, `34b6b35`, `337791a`). Aucun fichier en commun avec la refonte UX (vérifié par comparaison des listes de fichiers). Risque restant : tant que la branche de développement avance, `release/waverti` ne la suit pas automatiquement (voulu).
  La migration `20261102010000_update_plan_prices.sql` **n'est plus appliquée par les déploiements** : elle doit l'être à la main (`pnpm db:migrate:env`), en suivant `docs/PLAN-PUBLICATION-PRIX.md`.
