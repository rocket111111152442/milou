# Architecture

## Vue d'ensemble

```
                 ┌──────────────────────────── Vercel ─────────────────────────────┐
 Navigateur ───▶ │ apps/web (Next.js) : site public, espace client, API, admin       │
                 │  - Comptes et sessions internes (cookie httpOnly), API, Stripe   │
                 └──────────────┬───────────────────────────────┬────────────────────┘
                                │ SQL (RLS)                     │ HTTPS
                 ┌──────────────▼──────────────┐      ┌─────────▼─────────┐
                 │ PostgreSQL 17 auto-hébergé   │      │ Stripe (mode test) │
                 └──────────────▲──────────────┘      └───────────────────┘
                                │ SQL (file de travaux, résultats, notifications)
      ┌─────────────────────────┴───────────────────────┐
      │ apps/worker (serveur OVH, Docker)                │──▶ Brave Search API, Resend
      │  planification · contrôles serveur · Business   │──▶ sites surveillés (HTTP, Chromium)
      └──────────────────────────────────────────────────┘
                                ▲ HTTPS (jeton d'appareil, chemins /api/agent/*)
      ┌─────────────────────────┴───────────────────────┐
      │ apps/desktop (Tauri) sur l'ordinateur du client  │──▶ pages surveillées par CE client
      └──────────────────────────────────────────────────┘
```

## Les trois moteurs

### Moteur A — pages précises
- Cible : une URL publique (+ sélecteur CSS facultatif). Conditions : prix sous un seuil, baisse de prix,
  retour en stock, modification (significative ou toute), apparition / disparition d'un texte.
- Extraction (`packages/monitoring/src/extract`) : données structurées JSON-LD, microdonnées, balises meta,
  zone sélectionnée, puis texte (source indiquée à l'utilisateur). Même code côté serveur et desktop.
- Exécution **hybride** : ordinateur du client en priorité, relais par les serveurs selon la formule.

### Moteur B — sujets sur Internet
- Demande en langage naturel analysée par un planificateur **déterministe** (pas d'IA générative) :
  sujet, intention (date de sortie, annonce, offre, publication officielle), domaines officiels.
- Recherche via l'API Brave (clé côté serveur uniquement), cache mutualisé, budget mensuel, classement
  des sources (officielle / confirmée / probable / rumeur). Toujours exécuté par les serveurs.

### Moteur C — Business (site professionnel du client)
- Préalable obligatoire : **preuve de propriété** (TXT DNS ou fichier `.well-known`).
- Contrôles HTTP à la cadence de la formule (60 s), confirmation par un second contrôle 20 s plus tard
  avant toute alerte, rétablissement après deux succès, incidents uniques (index uniques partiels).
- Certificat HTTPS quotidien, scénarios navigateur (Chromium) limités au domaine vérifié, avec blocage des
  achats/paiements/suppressions, captures d'écran conservées 30 jours, statistiques quotidiennes réelles.
- Toujours exécuté par les serveurs (jamais par un ordinateur client).

## File de travaux hybride (PostgreSQL)

Pourquoi PostgreSQL plutôt que Redis/BullMQ : un seul système à opérer et sauvegarder, transactions
atomiques entre le résultat, l'état de la tâche et les notifications, et volumes modestes (des milliers de
contrôles par heure ; voir `docs/LOAD-TEST-RESULTS.md`).

- `monitoring_schedules` → `scheduleDueTasks` crée un job par créneau (`unique(task_id, slot_at)`) et
  au plus **un job vivant par tâche** (index unique partiel).
- Choix de l'exécutant (`decideExecutor`) : sujets Internet → serveurs ; formule sans relais → ordinateur
  uniquement ; sinon ordinateur en ligne en priorité puis relais serveur après un délai de grâce (600 s).
  Un ordinateur mis en pause n'est pas considéré comme disponible.
- Réservation `FOR UPDATE SKIP LOCKED` + jeton de réservation + bail ; un résultat dont le bail a expiré
  est refusé (`StaleClaimError`). Les jobs abandonnés sont remis en file (`recoverJobs`).
- L'agent desktop ne peut réserver **que les tâches de son propre utilisateur**.

## Application desktop

- Tauri v2 : processus Rust + interface React (composants partagés `@waverti/ui`).
- Le **jeton d'appareil reste dans Rust** (trousseau du système, repli fichier 0600 affiché à l'utilisateur) ;
  l'interface appelle une commande qui n'accepte que les chemins `/api/` du serveur configuré.
- Les pages surveillées sont téléchargées par Rust avec les **mêmes protections que le serveur** (adresses
  publiques uniquement après résolution DNS, IP épinglée, redirections revalidées, 2 Mo maximum).
- Liaison par code court validé dans le navigateur (aucun mot de passe saisi dans l'application).
- Accord explicite obligatoire avant tout contrôle local ; icône toujours visible, pause, démarrage
  automatique désactivé par défaut, journal « Activité de cet ordinateur ».

## Données et droits

- Schéma : `db/migrations/*` (≈ 35 tables), miroir Drizzle `packages/database/src/schema.ts`
  (un test vérifie leur concordance).
- **RLS** : les rôles `anon`/`authenticated` n'ont que des lectures de leurs propres lignes ; toutes les
  écritures passent par le serveur (API Next.js ou worker) après validation Zod, quotas et contrôle d'accès.
- Droits d'abonnement (`entitlements`) calculés côté serveur à partir des abonnements Stripe reçus par
  webhook signé ; jamais modifiables par le navigateur ou l'application desktop.

## Notifications

`notify()` crée une notification in-app dédupliquée, et selon les préférences et la formule : e-mail
(boîte d'envoi avec bail, nouvelles tentatives, clé d'idempotence Resend) et notification de bureau
(remise une seule fois à l'application desktop).

## Paiements

Stripe Checkout (page hébergée par Stripe : aucune donnée de carte chez Waverti), essai de 72 h avec carte
obligatoire, anti-abus (hachages de l'e-mail normalisé et de l'empreinte de carte), webhooks signés et
idempotents, portail client, changement de formule proratisé (quatre formules ; l'option « site supplémentaire » est abandonnée).
**Clés live refusées** tant que `WAVERTI_ALLOW_LIVE_PAYMENTS` n'est pas défini (après validation juridique).
