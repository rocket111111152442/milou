# WATCHLY — assistant de surveillance d'Internet

Watchly surveille pour ses utilisateurs des **pages web** (prix, stock, modifications, apparition d'un texte),
des **sujets sur Internet** (date de sortie, annonce, offre, publication officielle) et, pour les professionnels,
la **disponibilité de leur propre site** (contrôles à la minute, certificat HTTPS, scénario de parcours).

Développé par **LULLIN WEB** — https://www.lullin-web.com

> **Statut : version de démonstration (preview).** Paiements en **mode test Stripe uniquement**, mentions
> légales à compléter, aucun installateur publié. Voir l'état détaillé ci-dessous et `docs/ROADMAP.md`.

## Contenu du dépôt

```
watchly/
├── apps/
│   ├── web/        Site public + espace client + administration (Next.js 16, App Router) — déployé sur Vercel
│   ├── worker/     Traitements serveur (Node 22) : planification, contrôles, recherche Web, Business, e-mails
│   └── desktop/    Application Windows / macOS / Linux (Tauri v2 + React) avec agent de contrôle local
├── packages/
│   ├── database/   Schéma Drizzle, client, migrations, outils de test, scripts (migrate, seed, admin:grant)
│   ├── monitoring/ Moteurs A (pages), B (sujets Internet), C (Business), file hybride, protections SSRF
│   ├── billing/    Formules, droits, quotas, Stripe (Checkout, webhooks, gestion)
│   ├── notifications/ Notifications in-app / bureau / e-mail (Resend), modèles d'e-mails
│   ├── auth/       Jetons d'appareil, hachages, codes de liaison
│   ├── types/      Schémas Zod et types partagés, formatage français
│   ├── ui/         Design system (Tailwind v4, Radix) + écrans partagés web/desktop
│   └── config/     Constantes de marque, texte d'accord local, lecture de l'environnement
├── supabase/       Migrations SQL (schéma, RLS, données de référence), config locale, modèles d'e-mails Auth
├── infra/          Docker / systemd du worker
└── docs/           Architecture, déploiement, environnement, sécurité, tests, feuille de route
```

## Démarrage local

Prérequis : Node 22.12+, pnpm 10, Docker (Supabase local), Rust stable (application desktop).

```bash
pnpm install
npx supabase@2.122.0 start -x studio,imgproxy,vector,logflare,edge-runtime,realtime,storage-api,postgres-meta,supavisor
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm db:migrate
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres STRIPE_PRICE_PLUS=price_… pnpm db:seed
cp .env.example apps/web/.env.local   # puis compléter (clés Supabase locales : `npx supabase status`)
pnpm --filter @watchly/web dev        # http://localhost:3000
pnpm --filter @watchly/worker dev     # traitements serveur
pnpm --filter @watchly/desktop tauri dev
```

Donner le rôle administrateur à un compte existant (ligne de commande uniquement) :

```bash
DATABASE_URL=… pnpm admin:grant prenom@lullin-web.com
```

## Tests

`pnpm test` (unitaires + intégration), `pnpm test:e2e` (site web), `pnpm --filter @watchly/desktop test:e2e`
(application desktop réelle), `pnpm test:load` (charge). Détails et prérequis : `docs/TESTING.md`.

## État des fonctionnalités

| Domaine | État |
| --- | --- |
| Site public, SEO, accessibilité (axe), responsive | Fonctionnel et vérifié (E2E) |
| Inscription, e-mail de confirmation, connexion, réinitialisation, déconnexion | Fonctionnel et vérifié (E2E, Supabase local) |
| Surveillance de pages (moteur A), file hybride ordinateur / serveurs | Fonctionnel et vérifié (intégration, E2E, desktop réel) |
| Recherche sur Internet (moteur B, Brave Search) | Fonctionnel en environnement de test (API simulée) — clé Brave requise |
| Business : vérification de propriété, disponibilité, HTTPS, scénarios, rapports | Fonctionnel et vérifié (intégration avec serveurs locaux et Chromium, E2E) |
| Abonnements, essai 72 h, résiliation, portail | Fonctionnel en environnement de test (Stripe mode test simulé par stripe-mock) |
| E-mails (Resend) | Fonctionnel en environnement de test (API simulée) — domaine d'envoi à configurer |
| Application desktop Linux | Fonctionnel et vérifié (E2E sur le binaire réel, paquets .deb / AppImage construits) |
| Application desktop Windows / macOS | Développé mais non vérifié (workflow de construction prêt, non exécuté) |
| Mises à jour automatiques signées du desktop | Développé mais non vérifié (activé seulement avec une clé de signature) |
| Administration LULLIN WEB | Fonctionnel et vérifié (E2E) |
| Mentions légales, CGV/CGU, politique de confidentialité | Modèles à compléter et à faire valider (aucune information inventée) |

Documentation : `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/ENVIRONMENT.md`, `docs/SECURITY.md`,
`docs/TESTING.md`, `docs/ROADMAP.md`, `docs/LOAD-TEST-RESULTS.md`.
