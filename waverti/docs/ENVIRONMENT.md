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

## Audit du 31 octobre 2026 (projet Vercel existant et code)

Valeurs non lues (variables sensibles) : seuls les **noms** et environnements ont été comparés au code.

| Variable sur Vercel (Production) | Lue par le code ? | Constat | Action recommandée |
| --- | --- | --- | --- |
| `BRAVE_API_KEY` | oui (alias) | Le nom canonique est `BRAVE_SEARCH_API_KEY` ; `BRAVE_API_KEY` est accepté en repli (si les deux existent, `BRAVE_SEARCH_API_KEY` l'emporte). **Les recherches sont faites par le worker, pas par le site** : sur Vercel, la clé ne sert qu'à l'indicateur de santé. | Placer la clé sur le serveur du worker (`worker.env`) ; la retirer de Vercel réduit son exposition. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **non** | Inutile : le paiement est une redirection vers Stripe Checkout créée côté serveur. Variable publique (pas un secret), mais si c'est une clé `pk_live_`, elle ne correspond pas au mode test. | Supprimer ou ignorer. |
| `STRIPE_SECRET_KEY` | oui | Si c'est une clé `sk_live_`, le site **refuse de l'utiliser** tant que `WAVERTI_ALLOW_LIVE_PAYMENTS` n'est pas défini (garde-fou vérifié) : les paiements restent indisponibles. | Pour tester le parcours de paiement : une clé `sk_test_` dans l'environnement **Preview** (jamais la clé live), avec `STRIPE_WEBHOOK_SECRET` de l'endpoint de test. |
| `RESEND_API_KEY` | oui | Correct. Sans `EMAIL_FROM`, l'expéditeur par défaut est utilisé. | Ajouter `EMAIL_FROM=Waverti <alertes@waverti.com>` après vérification du domaine chez Resend. |
| `NEXT_PUBLIC_LAUNCH_STATUS=preview` | oui | Correct (bandeau + `noindex`). | Conserver. |

Variables **absentes** nécessaires au fonctionnement du site : `DATABASE_URL` (PostgreSQL auto-hébergé, TLS),
`WAVERTI_ENCRYPTION_KEY`, `WAVERTI_HASH_PEPPER`, `NEXT_PUBLIC_APP_URL=https://www.waverti.com`,
`STRIPE_WEBHOOK_SECRET` (mode test), `ADMIN_REQUIRE_MFA=1`. Sans `DATABASE_URL`, l'espace client indique que le
service n'est pas configuré (aucune donnée envoyée).

### Configuration du worker (serveur)

Modèle : `infra/docker/worker.env.example`. Minimum : `DATABASE_URL`, `APP_URL`, `EMAIL_FROM`,
`RESEND_API_KEY` (ou `SMTP_URL`), `BRAVE_SEARCH_API_KEY`, `WORKER_ID`. `STRIPE_SECRET_KEY` facultative et en mode
test uniquement. Le worker n'a besoin ni de `WAVERTI_ENCRYPTION_KEY` ni de `STRIPE_WEBHOOK_SECRET`.
