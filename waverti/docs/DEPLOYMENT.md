# Déploiement

Ordre recommandé : Supabase → Vercel (Preview) → worker → Stripe (test) → Resend → Brave → desktop.
Chaque étape marquée **[humain]** nécessite un compte, un paiement ou une décision de LULLIN WEB.

## 1. Supabase (base de données + authentification) [humain]

1. Créer un projet (région UE, ex. Paris `eu-west-3`) ; noter l'URL, la clé `anon` et la clé `service_role`.
2. Appliquer le schéma depuis un poste de confiance :
   ```bash
   DATABASE_URL="postgresql://postgres:MOT_DE_PASSE@db.REF.supabase.co:5432/postgres" pnpm db:migrate
   ```
3. Authentification → URL Configuration : *Site URL* = URL publique ; *Redirect URLs* = `https://DOMAINE/**`
   (et l'URL de Preview Vercel si utilisée). E-mails : confirmation obligatoire, mot de passe ≥ 10 caractères.
   Authentification multifacteur : laisser « TOTP (App Authenticator) » activé (inscription et vérification).
4. Modèles d'e-mails (Confirm signup, Reset password) : reprendre `supabase/templates/*.html`
   (liens `{{ .RedirectTo }}&token_hash=…`, indispensables au flux `/auth/confirm`).
5. SMTP personnalisé (Resend) pour ne pas dépendre du service d'envoi limité de Supabase.
6. Sauvegardes : activer les sauvegardes quotidiennes / PITR (formule payante Supabase) et tester une
   restauration sur un projet de test avant le lancement.

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
- [ ] Registre des traitements RGPD, contrats de sous-traitance (Supabase, Vercel, Stripe, Resend, OVH, Brave).
- [ ] Vercel Pro, domaine, HTTPS, `NEXT_PUBLIC_LAUNCH_STATUS=live`.
- [ ] Double authentification des administrateurs (`ADMIN_REQUIRE_MFA=1`).
- [ ] Sauvegardes testées, supervision du worker, alertes de budget API.
- [ ] Installateurs signés, testés manuellement sur Windows et macOS.
