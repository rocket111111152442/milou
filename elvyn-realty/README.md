# Elvyn Arnaud Realty Group — site, catalogue AlterEstate, assistant IA et CRM

Refonte de **elvynarnaudrealty.com** : site public bilingue (ES/EN), catalogue alimenté par AlterEstate, assistant IA immobilier, CRM privé pour Elvyn et demandes de visite.

> Ce dossier est indépendant du reste du dépôt (`frontend/`, `backend/` appartiennent au projet MILOU et ne sont pas utilisés).

## Architecture

| Bloc | Rôle | Fichiers |
|---|---|---|
| Site public | Pages, recherche, fiches, formulaires | `src/app/(site)/[lang]/*`, `src/components/site/*` |
| Catalogue | Appels AlterEstate côté serveur, normalisation, cache | `src/lib/alterestate/*`, `src/lib/catalog/*` |
| Assistant IA | Boucle d'outils côté serveur (Claude), base métier | `src/lib/ai/*`, `data/knowledge/base-conocimiento.md` |
| CRM | Prospects, demandes, visites, notes, historique | `src/lib/crm/*`, `src/app/(admin)/admin/*` |
| Notifications | E-mail (Resend), WhatsApp Cloud API optionnel, mode test | `src/lib/notify/*` |
| Base de données | PostgreSQL (prod) ou PGlite (aperçu local), migrations SQL | `src/lib/db/*`, `drizzle/` |

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Drizzle ORM · Zod · SDK Anthropic.

Le site, le catalogue et le CRM fonctionnent sans l'IA : si la clé Anthropic manque, si le budget mensuel est atteint ou si l'API échoue, l'assistant passe en **mode contact direct** (catalogue, WhatsApp, téléphone).

## Démarrage local

```bash
cd elvyn-realty
npm install
cp .env.example .env.local   # puis compléter SESSION_SECRET (voir le fichier)
npm run dev                  # http://localhost:3000
```

Sans `ALTERESTATE_PUBLIC_TOKEN`, le site tourne en **mode démonstration** : bandeau visible, toutes les pages en `noindex`, catalogue = instantané des 193 annonces publiques capturé le 24/11/2026 (`data/demo/listings.json`, non synchronisé).

Créer l'accès à l'espace privé (`/admin`) :

```bash
npm run admin:create -- --email elvyn@drspacefinders.com --name "Elvyn Arnaud"
```

Le mot de passe (12 caractères minimum) est demandé dans le terminal ; il n'apparaît ni dans l'historique ni dans le code.

## Renseigner la clé AlterEstate (sans la coller dans une conversation)

1. AlterEstate → **Paramètres → Mon compte → « API KEY PUBLICO »** : copier la clé **publique** (pas la clé privée).
2. Local : la coller dans `.env.local` sur la ligne `ALTERESTATE_PUBLIC_TOKEN=`.
3. Hébergement Vercel : *Project → Settings → Environment Variables* → `ALTERESTATE_PUBLIC_TOKEN`, environnements *Production* et *Preview*, type *Sensitive*.
4. Redémarrer / redéployer. *CRM → Configuration* doit afficher « Conectado » et la date de la dernière synchronisation complète.

La clé n'est envoyée qu'au serveur d'AlterEstate (en-tête `aetoken`) ; elle n'est jamais transmise au navigateur ni écrite dans les journaux.

## Variables d'environnement

Toutes sont documentées dans `.env.example`. Les indispensables en production :

| Variable | Pourquoi |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URLs canoniques, sitemap, liens des e-mails |
| `ALTERESTATE_PUBLIC_TOKEN` | Catalogue réel |
| `DATABASE_URL` | CRM persistant (PostgreSQL) |
| `SESSION_SECRET` | Sessions de l'espace privé |
| `ALLOW_INDEXING=true` | Seulement sur la production finale, une fois le catalogue réel branché |
| `CRON_SECRET` | Purge quotidienne et nouvelles tentatives de notifications (`vercel.json`) |
| `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` | Assistant IA (sinon mode contact direct) |
| `NOTIFY_MODE=live`, `NOTIFY_EMAIL_TO`, `EMAIL_FROM`, `RESEND_API_KEY` | E-mails réels à Elvyn |

## Déploiement (Vercel recommandé)

1. Créer une base PostgreSQL (Neon ou Supabase) et récupérer `DATABASE_URL`.
2. Importer le dépôt dans Vercel avec **Root Directory = `elvyn-realty`**.
3. Saisir les variables d'environnement, puis déployer. Les migrations SQL s'appliquent au premier accès (`DB_AUTO_MIGRATE=true`) ou via `npm run db:migrate`.
4. Créer l'utilisateur d'Elvyn : `DATABASE_URL=… npm run admin:create -- --email … --name …` depuis un poste de confiance.
5. Vérifier l'aperçu (`/api/health`, `/admin/ajustes`), puis seulement :
   - `ALLOW_INDEXING=true` sur la production ;
   - bascule du domaine `elvynarnaudrealty.com` (actuellement servi par AlterEstate) vers Vercel — **à faire uniquement avec l'accord d'Elvyn**.

Autres hébergeurs Node.js : `npm run build && npm start`, et appeler `GET /api/cron/purge` chaque jour avec l'en-tête `Authorization: Bearer $CRON_SECRET`.

## Comportement du catalogue

- Liste : `GET /api/v1/properties/filter/` (30 max par page ; 24 affichées), filtres et tri traduits vers les paramètres documentés (`listing_type`, `category`, `city_name`, `search`, `currency`, `value_min/max`, `rooms_min`, `bath_min`, `parking_min`, `condition`, `sort`).
- Fiche : `GET /api/v1/properties/view/{slug}/`. Une annonce absente (404) affiche « Esta propiedad ya no está publicada » avec un vrai code HTTP 404.
- Cache mémoire de 10 min (`CATALOG_CACHE_SECONDS`). Si AlterEstate échoue ou répond 429, les données déjà en cache restent servies au maximum 6 h (`CATALOG_MAX_STALE_SECONDS`), puis un message d'indisponibilité s'affiche : jamais d'annonces inventées.
- **Réconciliation complète** : l'inventaire (facettes, assistant, sitemap) est relu page par page et ne remplace l'ancien qu'après une lecture complète réussie ; une annonce retirée disparaît donc à la synchronisation suivante, jamais sur un échec partiel.
- Rythme ≤ 8 requêtes/s par instance (limite AlterEstate : 10/s), nouvelles tentatives sur 429/5xx en respectant `Retry-After`.
- Prix affichés dans la devise et la périodicité reçues ; les filtres de prix utilisent la conversion d'AlterEstate.
- « Exclusiva » n'est affiché que si AlterEstate fournit `exclusive: true` ; la sélection d'accueil utilise `featured` si présent, sinon « Publicadas recientemente ». Une annonce dont l'agent n'appartient pas à l'agence est signalée « en colaboración ».
- Coordonnées : jamais affichées si `hide_location` (cas de toutes les annonces actuelles). Pas de carte intégrée (aucune clé cartographique fournie).

## Assistant IA

- Deux fournisseurs possibles, appels uniquement côté serveur (`/api/chat`) :
  - **OpenAI** si `OPENAI_API_KEY` est défini : modèle par défaut `gpt-4.1-mini` (si indisponible sur le compte, essai automatique de `gpt-4o-mini`).
  - **Anthropic** si `ANTHROPIC_API_KEY` est défini : modèle par défaut `claude-opus-5-5`, effort `low`.
  - `AI_PROVIDER` force le choix, `AI_MODEL` change le modèle.
- Connaissances : `data/knowledge/base-conocimiento.md` (copie du document de Drive du 23/11/2026). Mettre ce fichier à jour quand Elvyn modifie le document.
- Outils serveur (validés par Zod) : `search_properties`, `get_property`, `show_properties` (n'accepte que des annonces renvoyées par le catalogue), `update_prospect_profile`, `propose_handoff`. Aucun outil n'accède au CRM, aux notes ni aux autres conversations.
- Les coordonnées n'entrent dans le CRM que lorsque le visiteur clique « Enviar a Elvyn » (case de consentement) ; une visite reste « pendiente de confirmación ».
- Garde-fous : 5 tours d'outils maximum par message (le dernier interdit les outils), 30 messages par conversation, 400 messages/jour, 25 messages/10 min par IP, budget mensuel (`AI_MONTHLY_BUDGET_USD`, coût estimé à partir des jetons renvoyés par l'API et suivi dans *CRM → Panel*).
- Historique transmis tel quel (ajout seulement) : préserve le cache de prompt et les blocs de réflexion du modèle.

## CRM (`/admin`)

Tableau de bord, liste filtrable (statut, projet, niveau, priorité, dates), fiche complète (coordonnées, critères, biens, demandes, conversation, notes, historique, notifications), visites (confirmation avec contrôle de chevauchement), export JSON et suppression définitive.

- Étapes : Nuevo → Por contactar → Calificado → Visita programada → Seguimiento → Ganado / Perdido (`src/config/crm.ts`).
- Niveau chaud / tiède / froid : règles par points dans `src/config/crm.ts`, justification affichée et modifiable ; une modification manuelle bloque le recalcul automatique.
- Priorité : budget ≥ `PRIORITY_BUDGET_USD` (150 000 USD, règle du document métier) ou plusieurs unités.
- Dédoublonnage par e-mail ou téléphone normalisé (jamais par le nom) ; une nouvelle demande d'un contact existant s'ajoute à son historique sans écraser ses données.
- Conservation : conversations supprimées après `CHAT_RETENTION_DAYS`, prospects inactifs après `INACTIVE_CONTACT_RETENTION_MONTHS`, journal des notifications après 180 jours.

## Notifications

`NOTIFY_MODE=test` (défaut) : rien n'est envoyé, tout est visible dans *CRM → Notificaciones*. En `live` : e-mail via Resend. Chaque envoi a une clé d'idempotence (pas de doublon en cas de nouvelle tentative). Les boutons WhatsApp du site ouvrent seulement WhatsApp avec un message prérempli ; l'**envoi automatique** à Elvyn nécessite WhatsApp Cloud API (compte Meta Business vérifié + modèle de message approuvé) et `WHATSAPP_NOTIFY=true`.

## Tests

```bash
npm test                 # 54 tests unitaires/intégration (BD en mémoire, catalogue démo, API simulées)
npm run build && npm start
ADMIN_EMAIL=… ADMIN_PASSWORD=… node tests/e2e/run.cjs   # 68 vérifications navigateur (Playwright)
```

Le script E2E crée des prospects de test : ne jamais le lancer contre la production.

## Redirections depuis l'ancien site

Voir `docs/MIGRACION-URLS.md`. Les fiches gardent la même URL (`/propiedad/{slug}`).
