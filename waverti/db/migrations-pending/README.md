# Migrations préparées, NON appliquées

Ce dossier n'est lu par **aucun** déploiement : `packages/database/src/migrations.ts` (`MIGRATIONS_DIR`) ne lit que
`db/migrations/`, et c'est le seul dossier que l'outil manuel `pnpm db:migrate:env` applique (plus aucun déploiement Vercel n'applique de migration).

Une migration placée ici est testée sur une base jetable (`packages/database/test/pending-migrations.int.test.ts`) mais ne
touche aucune base réelle. Pour la **promouvoir** (décision à prendre explicitement) :

1. confirmer par écrit les droits correspondants (voir `docs/BRAVE-CONFORMITE.md` et `docs/PRODUITS.md`) ;
2. `git mv db/migrations-pending/<fichier>.sql db/migrations/` dans un commit dédié ;
3. l'appliquer explicitement : d'abord à la base de test (`WAVERTI_MIGRATE_TARGET=preview pnpm db:migrate:env --execute`), puis, sur autorisation écrite, à la Production (voir `docs/PLAN-DEPLOIEMENT-SECURISE.md`).

Même une fois appliquée, la migration est **inerte** : la table `source_policies` refuse toute écriture dans le catalogue tant
qu'aucune source n'y est explicitement autorisée avec une référence de justificatif.
