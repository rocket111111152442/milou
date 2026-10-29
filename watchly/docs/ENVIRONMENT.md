# Variables d'environnement

Aucune valeur secrète n'est versionnée. Modèle : `.env.example` (racine) et `infra/docker/worker.env.example`.
« Secret » = ne jamais préfixer par `NEXT_PUBLIC_`, ne jamais le copier dans une conversation ou un ticket.

## Application web (Vercel, projet « watchly »)

| Variable | Obligatoire | Secret | Rôle |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | oui | non | URL publique (liens des e-mails, redirections). |
| `NEXT_PUBLIC_LAUNCH_STATUS` | non | non | `preview` (défaut) : bandeau « démonstration » et `noindex`. `live` après lancement. |
| `NEXT_PUBLIC_SUPABASE_URL` | oui | non | URL du projet Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui | non (clé publique) | Clé publique Supabase (soumise à la RLS). |
| `SUPABASE_SERVICE_ROLE_KEY` | oui | **oui** | Suppression de compte (Auth admin). Serveur uniquement. |
| `DATABASE_URL` | oui | **oui** | PostgreSQL via le pooler Supabase (mode transaction, port 6543). |
| `DATABASE_POOL_MAX` | non | non | Connexions par instance serverless (défaut 3). |
| `WATCHLY_HASH_PEPPER` | oui | **oui** | ≥ 32 caractères aléatoires ; anti-abus des essais. Ne jamais le changer après lancement. |
| `STRIPE_SECRET_KEY` | pour payer | **oui** | `sk_test_…` uniquement tant que le cadre légal n'est pas validé. |
| `STRIPE_WEBHOOK_SECRET` | pour payer | **oui** | Secret de signature de l'endpoint `/api/stripe/webhook`. |
| `WATCHLY_ALLOW_LIVE_PAYMENTS` | non | non | Seule valeur acceptée : `I_HAVE_LEGAL_APPROVAL`. À ne définir qu'après validation juridique. |
| `ADMIN_REQUIRE_MFA` | recommandé | non | `1` : l'administration exige une session validée par double authentification (TOTP) ; un administrateur sans double authentification est redirigé vers Paramètres pour l'activer. |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | non | non | `1` seulement si le fournisseur Google est configuré dans Supabase. |

Sans Supabase ou base configurée, le site public fonctionne et l'espace client affiche clairement que le
service n'est pas configuré. Sans Stripe, les formules payantes sont présentées comme indisponibles.

## Worker (serveur)

| Variable | Obligatoire | Secret | Rôle |
| --- | --- | --- | --- |
| `DATABASE_URL` | oui | **oui** | Même base que le site (connexion directe ou pooler en mode session recommandé). |
| `WORKER_ID` | non | non | Identifiant affiché dans l'administration. |
| `WORKER_ROLES` | non | non | `scheduler,pages,web,business,email,maintenance` (séparer sur plusieurs machines si besoin). |
| `APP_URL` | oui | non | URL publique (liens des e-mails). |
| `RESEND_API_KEY`, `EMAIL_FROM` | pour envoyer | **oui** / non | Sans clé, les e-mails restent en file (signalé dans les journaux). |
| `BRAVE_SEARCH_API_KEY` | pour le moteur B | **oui** | Sans clé, les recherches échouent avec un message explicite. |
| `STRIPE_SECRET_KEY` | non | **oui** | Mode test uniquement. |
| `WORKER_*_CONCURRENCY` | non | non | Concurrence par type de contrôle. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE` | non | non | Chemin de Chromium (inutile avec l'image Docker). |
| `WATCHLY_ALLOW_PRIVATE_TARGETS` | non | non | Tests uniquement ; refusé en production. |

## Application desktop (compilation)

| Variable | Rôle |
| --- | --- |
| `WATCHLY_API_URL` | Adresse du serveur intégrée au binaire (https:// obligatoire pour une version publiée). |
| `TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`), `TAURI_UPDATER_PUBKEY` | Mises à jour signées (secrets GitHub Actions). |
| `APPLE_*`, `WINDOWS_CERTIFICATE*` | Signature des installateurs (secrets GitHub Actions, facultatifs). |

## Tests

`TEST_DATABASE_URL` (PostgreSQL de test, défaut `postgres://postgres:postgres@127.0.0.1:5432/postgres`),
`STRIPE_MOCK_URL` (stripe-mock), `E2E_BASE_URL`, `E2E_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase
local), `DESKTOP_E2E=1`, `WATCHLY_LOAD_TESTS=1`.
