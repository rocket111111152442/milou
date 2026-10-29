# Tests

Toutes les suites s'exécutent sans service payant ni compte réel : PostgreSQL et Supabase locaux,
stripe-mock (mode test Stripe simulé), serveurs HTTP/HTTPS locaux, Chromium local.

| Commande | Contenu | Prérequis |
| --- | --- | --- |
| `pnpm test:unit` | Unitaires (extraction, SSRF, droits, planification, agent desktop…) | aucun |
| `pnpm test:integration` | Base réelle : schéma, RLS, file hybride, webhooks Stripe, Business, worker de bout en bout, navigateur | PostgreSQL (`TEST_DATABASE_URL`), Chromium ; `STRIPE_MOCK_URL` pour le contrat Stripe |
| `pnpm test` | Unitaires + intégration | idem |
| `pnpm test:e2e` | Site web dans Chromium (Playwright) | Supabase local, application construite et lancée, stripe-mock |
| `pnpm --filter @watchly/desktop test:e2e` | **Binaire Tauri réel** piloté par WebDriver | `DESKTOP_E2E=1`, binaire `tauri build --debug --no-bundle`, `tauri-driver`, `WebKitWebDriver`, Xvfb, site lancé |
| `cargo test` (apps/desktop/src-tauri) | Politique IP/URL, téléchargement sécurisé, stockage du jeton | Rust |
| `pnpm test:load` | Charge Business (3 600 contrôles), scénarios concurrents, file de 1 500 tâches | PostgreSQL, Chromium |

## Préparer l'environnement local

```bash
npx supabase@2.122.0 start -x studio,imgproxy,vector,logflare,edge-runtime,realtime,storage-api,postgres-meta,supavisor
docker run -d --rm --name stripe-mock -p 12111:12111 stripe/stripe-mock:latest
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm db:migrate
# apps/web/.env.local : clés de `npx supabase status`, STRIPE_SECRET_KEY=sk_test_123,
# STRIPE_API_BASE=http://localhost:12111, STRIPE_WEBHOOK_SECRET=whsec_…, WATCHLY_HASH_PEPPER=…
pnpm --filter @watchly/web build && pnpm --filter @watchly/web start
E2E_BASE_URL=http://localhost:3000 pnpm test:e2e
```

Les e-mails d'authentification sont lus dans Mailpit (http://127.0.0.1:54324) par les tests.
Les tests E2E remettent à zéro les limites de débit de la base locale avant chaque test. Ils s'exécutent avec
`ADMIN_REQUIRE_MFA=1` (configuration de production) et calculent les codes TOTP comme une application d'authentification.

## Ce qui est simulé (et ce qui ne l'est pas)

- **Stripe** : stripe-mock valide la forme des appels selon le schéma officiel ; la logique des webhooks est
  testée avec de vrais événements signés et une instance Stripe dont les appels réseau sont remplacés.
  Aucun paiement réel n'a été effectué.
- **Resend** et **Brave Search** : serveurs HTTP locaux imitant les API (format des requêtes vérifié).
- **DNS de vérification Business** : résolveur injecté dans les tests ; en E2E, l'échec réel de la
  vérification d'un domaine `.test` est vérifié, puis la propriété est marquée en base.
- Tout le reste est réel : PostgreSQL, Supabase Auth, Chromium, WebKitGTK, réseau local, TLS.

## Résultats de la dernière exécution complète

Voir le rapport final du projet et `docs/LOAD-TEST-RESULTS.md`.
