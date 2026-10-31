# Tests

Toutes les suites s'exécutent sans service payant ni compte réel : PostgreSQL et Mailpit locaux,
stripe-mock (mode test Stripe simulé), serveurs HTTP/HTTPS locaux, Chromium local.

| Commande | Contenu | Prérequis |
| --- | --- | --- |
| `pnpm test:unit` | Unitaires (extraction, SSRF, droits, planification, agent desktop…) | aucun |
| `pnpm test:integration` | Base réelle : schéma, RLS, file hybride, webhooks Stripe, Business, worker de bout en bout, navigateur | PostgreSQL (`TEST_DATABASE_URL`), Chromium ; `STRIPE_MOCK_URL` pour le contrat Stripe |
| `pnpm test` | Unitaires + intégration | idem |
| `pnpm test:e2e` | Site web dans Chromium (Playwright) | PostgreSQL 17, Mailpit, application construite et lancée, stripe-mock |
| `pnpm --filter @waverti/desktop test:e2e` | **Binaire Tauri réel** piloté par WebDriver | `DESKTOP_E2E=1`, binaire `tauri build --debug --no-bundle`, `tauri-driver`, `WebKitWebDriver`, Xvfb, site lancé |
| `cargo test` (apps/desktop/src-tauri) | Politique IP/URL, téléchargement sécurisé, stockage du jeton | Rust |
| `pnpm test:load` | Charge Business (3 600 contrôles), scénarios concurrents, file de 1 500 tâches | PostgreSQL, Chromium |

## Préparer l'environnement local

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d   # PostgreSQL :55432, Mailpit :8025, stripe-mock :12111
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/waverti pnpm db:migrate
# apps/web/.env.local : DATABASE_URL (ci-dessus), WAVERTI_ENCRYPTION_KEY, WAVERTI_HASH_PEPPER,
# SMTP_URL=smtp://127.0.0.1:1025, STRIPE_SECRET_KEY=sk_test_123, STRIPE_API_BASE=http://localhost:12111,
# STRIPE_WEBHOOK_SECRET=whsec_…, ADMIN_REQUIRE_MFA=1  (ou : bash infra/ci/e2e-env.sh)
pnpm --filter @waverti/web build && pnpm --filter @waverti/web start
E2E_BASE_URL=http://localhost:3000 pnpm test:e2e
```

Test de sauvegarde/restauration : il utilise `pg_dump`/`pg_restore` de même version majeure que le serveur
(sinon il est ignoré avec un message). Avec le PostgreSQL du conteneur :
`PG_DUMP="docker exec -i waverti-pg pg_dump" PG_RESTORE="docker exec -i waverti-pg pg_restore" PSQL="docker exec -i waverti-pg psql" BACKUP_TEST_DB_URL_PREFIX=postgresql://postgres:postgres@127.0.0.1:5432`.

Les e-mails d'authentification sont lus dans Mailpit (http://127.0.0.1:8025) par les tests.
Les tests E2E remettent à zéro les limites de débit de la base locale avant chaque test. Ils s'exécutent avec
`ADMIN_REQUIRE_MFA=1` (configuration de production) et calculent les codes TOTP comme une application d'authentification.

## Ce qui est simulé (et ce qui ne l'est pas)

- **Stripe** : stripe-mock valide la forme des appels selon le schéma officiel ; la logique des webhooks est
  testée avec de vrais événements signés et une instance Stripe dont les appels réseau sont remplacés.
  Aucun paiement réel n'a été effectué.
- **Resend** et **Brave Search** : serveurs HTTP locaux imitant les API (format des requêtes vérifié).
- **DNS de vérification Business** : résolveur injecté dans les tests ; en E2E, l'échec réel de la
  vérification d'un domaine `.test` est vérifié, puis la propriété est marquée en base.
- Tout le reste est réel : PostgreSQL, authentification Waverti (scrypt, sessions, TOTP), Chromium, WebKitGTK, réseau local, TLS.

## Résultats de la dernière exécution complète

Voir `docs/RAPPORT-FINAL.md` et `docs/LOAD-TEST-RESULTS.md`.
