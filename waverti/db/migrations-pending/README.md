# Migrations préparées, NON appliquées

Ce dossier n'est lu par **aucun** déploiement : `packages/database/src/migrations.ts` (`MIGRATIONS_DIR`) ne lit que
`db/migrations/`, et c'est ce dossier que les déploiements Vercel (Preview et Production) appliquent automatiquement.

Une migration placée ici est testée sur une base jetable (`packages/database/test/pending-migrations.int.test.ts`) mais ne
touche aucune base réelle. Pour la **promouvoir** (décision à prendre explicitement) :

1. confirmer par écrit les droits correspondants (voir `docs/BRAVE-CONFORMITE.md` et `docs/PRODUITS.md`) ;
2. `git mv db/migrations-pending/<fichier>.sql db/migrations/` dans un commit dédié ;
3. le prochain déploiement Preview l'applique à la base de test ; la Production l'applique à son prochain déploiement.

Même une fois appliquée, la migration est **inerte** : la table `source_policies` refuse toute écriture dans le catalogue tant
qu'aucune source n'y est explicitement autorisée avec une référence de justificatif.
