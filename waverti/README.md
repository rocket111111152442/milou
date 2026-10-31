# WAVERTI — assistant de surveillance d'Internet

Waverti surveille pour ses utilisateurs des **pages web** (prix, stock, modifications, apparition d'un texte),
des **sujets sur Internet** (date de sortie, annonce, offre, publication officielle) et, pour les professionnels,
la **disponibilité de leur propre site** (contrôles à la minute, certificat HTTPS, scénario de parcours).

Développé par **LULLIN WEB** — https://www.lullin-web.com

> **Statut : version de démonstration (preview).** Paiements en **mode test Stripe uniquement**, mentions
> légales à compléter, aucun installateur publié. Voir l'état détaillé ci-dessous et `docs/ROADMAP.md`.

## Contenu du dépôt

```
waverti/
├── apps/
│   ├── web/        Site public + espace client + administration (Next.js 16, App Router) — déployé sur Vercel
│   ├── worker/     Traitements serveur (Node 22) : planification, contrôles, recherche Web, Business, e-mails
│   └── desktop/    Application Windows / macOS / Linux (Tauri v2 + React) avec agent de contrôle local
├── packages/
│   ├── database/   Schéma Drizzle, client, migrations, outils de test, scripts (migrate, seed, admin:grant)
│   ├── monitoring/ Moteurs A (pages), B (sujets Internet), C (Business), file hybride, protections SSRF
│   ├── billing/    Formules, droits, quotas, Stripe (Checkout, webhooks, gestion)
│   ├── notifications/ Notifications in-app / bureau / e-mail (Resend), modèles d'e-mails
│   ├── auth/       Comptes, mots de passe (scrypt), sessions, TOTP + codes de récupération, jetons d'appareil
│   ├── types/      Schémas Zod et types partagés, formatage français
│   ├── ui/         Design system (Tailwind v4, Radix) + écrans partagés web/desktop
│   └── config/     Constantes de marque, texte d'accord local, lecture de l'environnement
├── db/migrations/  Migrations SQL PostgreSQL (plateforme et identités, schéma, RLS, données de référence)
├── infra/          Docker (PostgreSQL, worker), systemd, sauvegardes
└── docs/           Architecture, déploiement, environnement, sécurité, tests, feuille de route
```

## Démarrage local

Prérequis : Node 22.12+, pnpm 10, Docker (PostgreSQL 17, Mailpit, stripe-mock), Rust stable (application desktop).

```bash
pnpm install
docker compose -f infra/docker/docker-compose.dev.yml up -d   # PostgreSQL :55432, Mailpit :8025, stripe-mock :12111
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/waverti
pnpm db:migrate && pnpm db:seed
cp .env.example apps/web/.env.local   # puis compléter (WAVERTI_ENCRYPTION_KEY, WAVERTI_HASH_PEPPER, SMTP_URL=smtp://127.0.0.1:1025)
pnpm --filter @waverti/web dev        # http://localhost:3000
pnpm --filter @waverti/worker dev     # traitements serveur
pnpm --filter @waverti/desktop tauri dev
```

Donner le rôle administrateur à un compte existant (ligne de commande uniquement) :

```bash
DATABASE_URL=… pnpm admin:grant prenom@lullin-web.com
```

Accès bêta privé sans paiement (ligne de commande uniquement, 60 jours au plus, quotas réduits, expiration
automatique ; un abonnement réel reste prioritaire) :

```bash
DATABASE_URL=… pnpm beta:grant testeur@exemple.fr --plan pro --days 30 --reason "Bêta privée novembre"
DATABASE_URL=… pnpm beta:grant testeur@exemple.fr --revoke
DATABASE_URL=… pnpm beta:grant --list
```

## Tests

`pnpm test` (unitaires + intégration), `pnpm test:e2e` (site web), `pnpm --filter @waverti/desktop test:e2e`
(application desktop réelle), `pnpm test:load` (charge). Détails et prérequis : `docs/TESTING.md`.

## État des fonctionnalités

| Domaine | État |
| --- | --- |
| Site public, SEO, accessibilité (axe), responsive | Fonctionnel et vérifié (E2E) |
| Inscription, e-mail de confirmation, connexion, réinitialisation, déconnexion | Fonctionnel et vérifié (E2E, PostgreSQL auto-hébergé + Mailpit) |
| Double authentification (TOTP), obligatoire pour l'administration avec `ADMIN_REQUIRE_MFA=1` | Fonctionnel et vérifié (E2E) — 10 codes de récupération à usage unique, anti-rejeu des codes TOTP |
| Surveillance de pages (moteur A), file hybride ordinateur / serveurs | Fonctionnel et vérifié (intégration, E2E, desktop réel) |
| Recherche sur Internet (moteur B, Brave Search) | Fonctionnel en environnement de test (API simulée) — clé Brave requise ; quota proportionnel aux jours de la période facturée ; compteur technique des requêtes |
| Business : vérification de propriété, disponibilité, HTTPS, scénarios, rapports | Fonctionnel et vérifié (intégration avec serveurs locaux et Chromium, E2E) |
| Abonnements, essai 72 h, résiliation, portail | Fonctionnel en environnement de test (Stripe mode test simulé par stripe-mock) |
| E-mails (Resend) | Fonctionnel en environnement de test (API simulée) — domaine d'envoi à configurer |
| Application desktop Linux | Fonctionnel et vérifié en CI (E2E sur le binaire réel ; .deb installé, lancé, désinstallé ; .rpm et AppImage construits) |
| Application desktop Windows | Voir `docs/RAPPORT-2026-10-31.md` § 5 (E2E WebView2 et installateurs NSIS/MSI en CI) — non signée |
| Application desktop macOS (Apple Silicon, Intel) | Construite en CI, lancement vérifié sur Apple Silicon ; pas d'E2E fonctionnel (non pris en charge par tauri-driver) ; non signée |
| Application sur téléphone (PWA) | Vérifiée dans Chromium (manifeste, service worker, hors ligne, aucune donnée privée en cache) ; non essayée sur un vrai iPhone / Android ; notifications push préparées, envoi non développé |
| Mises à jour automatiques signées du desktop | Développé mais non vérifié (activé seulement avec une clé de signature) |
| Administration LULLIN WEB | Fonctionnel et vérifié (E2E) |
| Mentions légales, CGV/CGU, politique de confidentialité | Modèles à compléter et à faire valider (aucune information inventée) |

Documentation : `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/ENVIRONMENT.md`, `docs/SECURITY.md`,
`docs/TESTING.md`, `docs/ROADMAP.md`, `docs/LOAD-TEST-RESULTS.md`, `docs/COUTS.md`, `docs/RAPPORT-2026-10-31.md` (état détaillé).
