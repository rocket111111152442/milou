# Variables d'environnement

Aucune valeur secrète n'est versionnée. Modèle : `.env.example` (racine) et `infra/docker/worker.env.example`.
« Secret » = ne jamais préfixer par `NEXT_PUBLIC_`, ne jamais le copier dans une conversation ou un ticket.

## Application web (Vercel, projet « waverti »)

| Variable | Obligatoire | Secret | Rôle |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | oui | non | URL publique (liens des e-mails, redirections). |
| `NEXT_PUBLIC_LAUNCH_STATUS` | non | non | `preview` (défaut) : bandeau « démonstration » et `noindex`. `live` après lancement. |
| `DATABASE_URL` | oui | **oui** | PostgreSQL 17 auto-hébergé (TLS obligatoire si distant : `?sslmode=require`). |
| `WAVERTI_ENCRYPTION_KEY` | oui | **oui** | 32 octets aléatoires en base64 (`openssl rand -base64 32`) ; chiffre les secrets TOTP. À sauvegarder hors du serveur. |
| `SMTP_URL` | si pas de Resend | **oui** | `smtp://utilisateur:motdepasse@hote:587` ; utilisé pour les e-mails si `RESEND_API_KEY` est absent. |
| `RESEND_API_KEY`, `EMAIL_FROM` | pour envoyer | **oui** / non | E-mails de confirmation et de réinitialisation (prioritaire sur `SMTP_URL`). |
| `DATABASE_POOL_MAX` | non | non | Connexions par instance serverless (défaut 3). |
| `WAVERTI_HASH_PEPPER` | oui | **oui** | ≥ 32 caractères aléatoires ; anti-abus des essais. Ne jamais le changer après lancement. |
| `STRIPE_SECRET_KEY` | pour payer | **oui** | `sk_test_…` uniquement tant que le cadre légal n'est pas validé. |
| `STRIPE_WEBHOOK_SECRET` | pour payer | **oui** | Secret de signature de l'endpoint `/api/stripe/webhook`. |
| `WAVERTI_ALLOW_LIVE_PAYMENTS` | non | non | Seule valeur acceptée : `I_HAVE_LEGAL_APPROVAL`. À ne définir qu'après validation juridique. |
| `ADMIN_REQUIRE_MFA` | recommandé | non | `1` : l'administration exige une session validée par double authentification (TOTP) ; un administrateur sans double authentification est redirigé vers Paramètres pour l'activer. |

Sans base configurée, le site public fonctionne et l'espace client affiche clairement que le
service n'est pas configuré. Sans Stripe, les formules payantes sont présentées comme indisponibles.

## Worker (serveur)

| Variable | Obligatoire | Secret | Rôle |
| --- | --- | --- | --- |
| `DATABASE_URL` | oui | **oui** | Même base que le site (connexion directe ou pooler en mode session recommandé). |
| `WORKER_ID` | non | non | Identifiant affiché dans l'administration. |
| `WORKER_ROLES` | non | non | `scheduler,pages,web,business,email,maintenance` (séparer sur plusieurs machines si besoin). |
| `APP_URL` | oui | non | URL publique (liens des e-mails). |
| `RESEND_API_KEY` ou `SMTP_URL`, `EMAIL_FROM` | pour envoyer | **oui** / non | Sans l'un ni l'autre, les e-mails restent en file (signalé dans les journaux). |
| `BRAVE_SEARCH_API_KEY` (alias accepté : `BRAVE_API_KEY`) | pour le moteur B | **oui** | Sans clé, les recherches échouent avec un message explicite. Si les deux sont définies, `BRAVE_SEARCH_API_KEY` l'emporte. |
| `STRIPE_SECRET_KEY` | non | **oui** | Mode test uniquement. |
| `WORKER_*_CONCURRENCY` | non | non | Concurrence par type de contrôle. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE` | non | non | Chemin de Chromium (inutile avec l'image Docker). |
| `WAVERTI_ALLOW_PRIVATE_TARGETS` | non | non | Tests uniquement ; refusé en production. |

## Application desktop (compilation)

| Variable | Rôle |
| --- | --- |
| `WAVERTI_API_URL` | Adresse du serveur intégrée au binaire (https:// obligatoire pour une version publiée). |
| `TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`), `TAURI_UPDATER_PUBKEY` | Mises à jour signées (secrets GitHub Actions). |
| `APPLE_*`, `WINDOWS_CERTIFICATE*` | Signature des installateurs (secrets GitHub Actions, facultatifs). |

## Tests

`TEST_DATABASE_URL` (PostgreSQL de test, défaut `postgres://postgres:postgres@127.0.0.1:5432/postgres`),
`STRIPE_MOCK_URL` (stripe-mock), `E2E_BASE_URL`, `E2E_DATABASE_URL`, `MAILPIT_URL`, `DESKTOP_E2E=1`, `WAVERTI_LOAD_TESTS=1`.
