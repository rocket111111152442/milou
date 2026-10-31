# Déploiement

Ordre recommandé : PostgreSQL → Vercel (Preview) → worker → Stripe (test) → Resend → Brave → desktop.
Chaque étape marquée **[humain]** nécessite un compte, un paiement ou une décision de LULLIN WEB.

## 1. PostgreSQL auto-hébergé (base de données + comptes) [humain]

Supabase n'est plus utilisé : comptes, sessions et double authentification sont gérés par l'application.

1. Serveur (ex. le VPS du worker) : `infra/docker/docker-compose.postgres.yml` (PostgreSQL 17, TLS,
   `scram-sha-256`, volume persistant). Placer `server.crt`/`server.key` dans `infra/docker/pg-tls/`,
   définir `POSTGRES_PASSWORD` (fichier `.env` non versionné), puis `docker compose -f … up -d`.
   N'ouvrir le port 5432 qu'aux adresses nécessaires (pare-feu) — le site Vercel s'y connecte en TLS.
2. Appliquer le schéma depuis un poste de confiance :
   ```bash
   DATABASE_URL="postgresql://waverti:MOT_DE_PASSE@HOTE:5432/waverti?sslmode=require" pnpm db:migrate
   DATABASE_URL=… pnpm db:seed
   ```
   Les migrations sont suivies dans `waverti_migrations.schema_migrations` (verrou consultatif : deux
   exécutions simultanées ne se chevauchent pas).
3. Variables du site : `DATABASE_URL`, `WAVERTI_ENCRYPTION_KEY`, `WAVERTI_HASH_PEPPER`, `RESEND_API_KEY`
   (ou `SMTP_URL`), `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL` (voir `docs/ENVIRONMENT.md`).
4. Sauvegardes : `infra/backup/pg-backup.sh` (format personnalisé `pg_dump -Fc`, rotation) via cron ou
   minuteur systemd, copie hors du serveur ; vérifier chaque semaine avec `infra/backup/pg-restore-check.sh`
   (restauration dans une base temporaire, contrôle des tables et de la RLS). Ce test de restauration est
   aussi automatisé (`packages/database/test/backup.int.test.ts`).
5. Ne jamais exposer le rôle propriétaire de la base à l'application si un rôle dédié est créé ; l'isolation
   par utilisateur repose sur la RLS (`app_user`).

## 2. Vercel — projet distinct « waverti » [humain pour la production]

- Projet séparé (ne jamais réutiliser celui du site LULLIN WEB). *Root Directory* : `waverti/apps/web`,
  framework Next.js, commande d'installation `pnpm install --frozen-lockfile` (détectée).
- Variables : voir `docs/ENVIRONMENT.md` (Preview et Production séparées).
- **Formule Hobby : usage non commercial uniquement.** Un site commercial nécessite la formule Pro de Vercel.
- `NEXT_PUBLIC_LAUNCH_STATUS=preview` tant que le lancement n'est pas validé (bandeau + `noindex`).
- Domaine : à choisir et configurer par LULLIN WEB (DNS chez le registraire).

## 3. Worker (serveur OVH ou équivalent) [humain : achat du serveur]

Recommandation de départ : VPS 2 vCPU / 4 Go RAM (Chromium inclus), Ubuntu 24.04, Docker.

```bash
git clone … && cd waverti
cp infra/docker/worker.env.example infra/docker/worker.env   # compléter (non versionné)
docker compose -f infra/docker/docker-compose.worker.yml up -d --build
docker compose -f infra/docker/docker-compose.worker.yml logs -f
```

Alternative sans Docker : `infra/deployment/waverti-worker.service` (systemd). Le worker n'expose aucun port.
Vérification : l'administration (`/admin`) affiche le worker « En ligne ». Plusieurs workers peuvent tourner
en parallèle (réservations exclusives) ; `WORKER_ROLES` permet de spécialiser une machine (ex. `business`).

## 4. Stripe — MODE TEST [humain]

1. Créer les produits et prix mensuels TTC (Plus 5,99 €, Pro 14,99 €, Business 39,99 €, site supplémentaire
   14,99 €) **en mode test**, puis `STRIPE_PRICE_*=price_… DATABASE_URL=… pnpm db:seed`.
2. Webhook : `https://DOMAINE/api/stripe/webhook`, événements `checkout.session.completed`,
   `customer.subscription.created|updated|deleted|paused|resumed|trial_will_end`, `invoice.paid`,
   `invoice.payment_failed`
   → `STRIPE_WEBHOOK_SECRET`.
3. Portail client : autoriser la mise à jour de carte, l'historique des factures et la résiliation.
4. **Paiements réels** : uniquement après validation juridique (CGV, mentions légales, TVA, compte marchand
   activé), puis clés live + `WAVERTI_ALLOW_LIVE_PAYMENTS=I_HAVE_LEGAL_APPROVAL`.

## 5. Resend (e-mails) [humain]

Vérifier le domaine d'envoi (SPF, DKIM, DMARC), créer une clé API limitée à l'envoi → worker.

## 6. Brave Search API [humain : abonnement payant]

Créer une clé (offre « Data for AI » ou « Pro ») → `BRAVE_SEARCH_API_KEY` du worker. Ajuster le coût unitaire
`cost.brave_search_call_micros` et le budget `budget.monthly_api_eur` dans `app_settings`.

## 7. Application desktop

- Workflow manuel `.github/workflows/waverti-desktop-release.yml` : vérifications, construction Windows /
  macOS (Intel et Apple Silicon) / Linux, **brouillon** de version GitHub, `SHA256SUMS.txt`.
- Signature : certificats Authenticode (Windows) et Apple Developer ID + notarisation [humain, payants].
  Sans eux, les installateurs sont construits non signés et la note de version le précise.
- Mises à jour : générer une paire de clés (`pnpm --filter @waverti/desktop tauri signer generate`), mettre la
  clé privée en secret GitHub et la clé publique en variable `TAURI_UPDATER_PUBKEY`.
- La page Téléchargement n'affiche un installateur que s'il est enregistré comme publié dans
  `desktop_releases` (jamais de lien vers une version non testée).

## 8. Avant d'ouvrir au public (liste de contrôle)

- [ ] Mentions légales, CGU/CGV, confidentialité, cookies complétées avec les informations réelles de LULLIN WEB
      (SIRET, adresse, hébergeurs, DPO/contact) et validées juridiquement.
- [ ] Registre des traitements RGPD, contrats de sous-traitance (hébergeur de la base, Vercel, Stripe, Resend, OVH, Brave).
- [ ] Vercel Pro, domaine, HTTPS, `NEXT_PUBLIC_LAUNCH_STATUS=live`.
- [ ] Double authentification des administrateurs (`ADMIN_REQUIRE_MFA=1`).
- [ ] Sauvegardes testées, supervision du worker, alertes de budget API.
- [ ] Installateurs signés, testés manuellement sur Windows et macOS.
