# Rapport complet du projet — site immobilier « AEI Côté Mer »

> Contexte à donner à l'assistant : ce document résume tout ce qui a été fait sur le projet, dans l'ordre,
> avec l'architecture technique, l'état réel et les points ouverts. Il ne contient volontairement
> **aucun mot de passe ni aucune clé secrète**.

---

## 1. Le projet en bref

- **Client visé** : Agence Européenne Immobilière – Côté Mer (AEI Côté Mer), agence immobilière à Six-Fours-les-Plages (Var). SARL, SIREN 828 494 674, RCS Toulon. Leur site actuel : aei-var.com, fourni par La Boîte Immo.
- **Objectif** : proposer à l'agence un nouveau site haut de gamme, puis une solution de gestion qui se rapproche des fonctions visibles d'une plateforme comme La Boîte Immo :
  - gestion des biens ;
  - gestion des demandes clients ;
  - tableau de bord ;
  - espace client.
- **Démo en ligne** : https://aei-cote-mer.vercel.app (administration : `/admin`).
- **Code** : dépôt GitHub `rocket111111152442/milou`, branche `claude/pensive-cori-pk1857`, dossier `aei-var-redesign/`.
- **Hébergement** : Vercel, projet `aei-cote-mer`. Le déploiement se fait depuis la branche Git. Les données sont dans un stockage Vercel Blob **privé**.
- **Statut commercial** : maquette de démonstration. Un e-mail de présentation a été rédigé pour le directeur, aucun contrat n'est signé. Le site n'est pas référencé (`noindex`).

---

## 2. Historique des mises à jour (dans l'ordre)

1. **Analyse du site actuel :**
   - couleurs, contenus, équipe (5 personnes), 10 biens mis en avant ;
   - coordonnées : 175 av. Joseph Raynaud, 04 94 07 26 35 ;
   - 73 avis PagesJaunes de 2021 (note moyenne 4,7/5) ;
   - la fiche Google n'a pas pu être lue automatiquement.
2. **Première refonte :** site statique HTML/CSS/JS sans framework, très animé :
   - écran de chargement ;
   - titres révélés ligne par ligne ;
   - diaporama ;
   - parallaxe ;
   - compteurs ;
   - estimation en 4 étapes ;
   - équipe, avis, secteurs, FAQ, contact.
3. **Couleurs :** passage aux couleurs du logo, bleu marine `#1e146a` et rouge bordeaux `#a3262a`.
4. **Publication sur Vercel.**
5. **Premier espace `/admin` :** simple, protégé par un mot de passe unique, stockage Vercel Blob public.
6. **Vidéo d'accueil :** une vidéo de drone a remplacé le diaporama, puis a été retirée à la demande de l'utilisateur. Le diaporama photo est revenu.
7. **Plusieurs photos par bien :** galerie plein écran (flèches, clavier, glisser au doigt, miniatures).
8. **Fiche détaillée par bien** (`bien.html?id=…`), sur le modèle des fiches du site actuel :
   - mosaïque de photos ;
   - chiffres clés ;
   - description ;
   - caractéristiques ;
   - équipements ;
   - composition par étage ;
   - étiquettes DPE/GES ;
   - informations financières ;
   - simulateur de prêt ;
   - carte ;
   - formulaire de visite ;
   - partage ;
   - biens similaires.
9. **Rédaction d'un e-mail de prospection** pour le directeur de l'agence : sans prix, avec proposition de rendez-vous en personne.
10. **Grande refonte « solution professionnelle »**, détaillée dans les sections suivantes :
    - espace admin sécurisé multi-utilisateurs ;
    - gestion complète des biens ;
    - réception des demandes ;
    - formulaire d'estimation avec photos ;
    - espace client ;
    - tableau de bord ;
    - sauvegardes ;
    - API de synchronisation (à connecter) ;
    - pages légales et RGPD ;
    - passage du stockage en privé ;
    - migration des 10 biens.
11. **Correctifs trouvés pendant les tests en production :**
    - la première connexion plantait (erreur « fichier introuvable » de Vercel Blob mal reconnue) ;
    - un compte avec mot de passe provisoire pouvait utiliser l'API sans l'avoir changé ;
    - le code serveur était téléchargeable publiquement (le site a été déplacé dans `public/`) ;
    - les cases de consentement s'affichaient sur plusieurs colonnes ;
    - le délai anti-robot était trop strict.

---

## 3. Architecture technique

```
aei-var-redesign/
├─ public/                 Seul dossier servi publiquement
│  ├─ index.html           Accueil (recherche, biens, estimation, contact…)
│  ├─ bien.html / bien.js  Fiche d'un bien
│  ├─ espace-client.html   Favoris, suivi, alertes, rendez-vous (page générée)
│  ├─ mentions-legales.html, confidentialite.html, cookies.html, honoraires.html (générées)
│  ├─ main.js, cards.js, gallery.js, forms.js, favoris.js, page.js, espace-client.js
│  ├─ styles.css, bien.css, pages.css, fonts/ (polices hébergées localement)
│  ├─ img/                 Photos des biens et de l'équipe (WebP)
│  └─ admin/               Interface d'administration (modules ES, sans framework)
│     ├─ index.html, admin.css
│     └─ js/ main.js, api.js, ui.js, views/{dashboard,biens,demandes,utilisateurs,integrations,compte}.js
├─ api/router.js           UNE seule fonction serveur, toutes les routes /api/* passent par elle
├─ lib/
│  ├─ storage.js           Couche de stockage remplaçable : Vercel Blob privé OU fichiers locaux
│  ├─ auth.js              Comptes, hachage scrypt, sessions signées HMAC
│  ├─ biens.js             Modèle et validation des biens
│  ├─ leads.js             Modèle et validation des demandes, export CSV
│  ├─ email.js             Envoi d'e-mails via l'API Resend (désactivé si non configuré)
│  ├─ ratelimit.js         Limitation d'essais, verrouillage de compte
│  ├─ http.js              Outils HTTP, contrôle d'origine (CSRF), détection du vrai format d'image
│  └─ routes/ public.js, auth.js, admin.js, sync.js (API externe), cron.js (tâche quotidienne)
├─ config/agence.js        Toutes les informations de l'agence (à adapter pour une autre agence)
├─ scripts/
│  ├─ dev.mjs              Serveur local (site + API, mêmes en-têtes de sécurité qu'en production)
│  ├─ build-pages.mjs      Génère les pages légales et l'espace client à partir de la config
│  ├─ pages/               Gabarits de ces pages
│  └─ demo-biens.json      Données de démonstration
├─ docs/ API.md, BILAN.md, RAPPORT-CHATGPT.md
├─ vercel.json             Réécriture /api/* → router, tâche quotidienne, en-têtes de sécurité
└─ .env.example            Liste des variables d'environnement (sans valeurs)
```

**Choix structurants :**

- **Pas de framework, pas de compilation.** HTML, CSS et JavaScript « purs », modules ES dans l'admin.
- **Une seule fonction serveur.** Le forfait gratuit de Vercel limite le nombre de fonctions.
- **Stockage Vercel Blob en accès privé.**
  - Un fichier JSON pour les biens, un pour les comptes, un fichier par demande.
  - Les écritures sont protégées par empreinte (ETag) contre les modifications simultanées.
  - Les photos des biens sont servies par `/api/media/photos/…`.
- **Développement local** : `STORAGE=fs` (fichiers dans `.data/`) et `node scripts/dev.mjs`.

---

## 4. Modèles de données

**Bien :**
- `id`, `titre`, `ville`, `cp`, `adresse` (privée, jamais publiée), `region` ;
- `transaction` (vente/location), `statut` (disponible, sous-compromis, vendu, loue), `publie` ;
- `type`, `ref`, `prix`, `surface`, `terrain`, `pieces`, `chambres`, `sdb`, `sde`, `niveaux`, `annee` ;
- `cuisine`, `chauffage`, `extra`, `badge`, `description`, `equipements[]` ;
- `composition[{niveau, piece, surface}]`, `photos[]` ;
- `dpe`, `dpeKwh`, `ges`, `gesCo2`, `energieMin`, `energieMax`, `energieRef` ;
- `honoraires`, `taxeFonciere`, `chargesCopro`, `lotsCopro` ;
- `externalRef`, `source` (manuel/api), `createdAt`, `updatedAt`, `publishedAt`.

**Demande (lead) :**
- `id` (triable par date), `code` (code de suivi client à 8 caractères) ;
- `type` (contact, estimation, visite, achat, location, gestion, rendezvous, alerte) ;
- `status` (nouveau, contacte, rendezvous, termine) ;
- `nom`, `tel`, `email`, `projet`, `message`, `bienId`, `bienTitre` ;
- `details` (estimation : type, ville, adresse, surface, pièces, état, atouts ; rendez-vous : date, créneau, motif ; alerte : critères) ;
- `photos[]` (privées), `consent{at, text}`, `notes[]`, `history[]`, `alert{active, token, lastSentAt}`.

**Utilisateur :**
- `id`, `email`, `name` ;
- `role` (owner/admin/agent) ;
- `hash` (scrypt), `mustChange`, `disabled`, `sessionVersion`, `lastLogin`.

---

## 5. Routes de l'API

**Publiques :**
- `GET /api/biens` (biens publiés, sans les champs internes) et `GET /api/biens/:id` ;
- `GET /api/config` ;
- `POST /api/leads` (validation, anti-robot, limite par IP) ;
- `POST /api/leads/photo` (photo d'estimation, jeton signé) ;
- `POST /api/suivi` (code + e-mail ou téléphone) ;
- `GET /api/alertes/desinscription` ;
- `GET /api/media/photos/:file`.

**Authentification :**
- `POST /api/auth/login`, `logout`, `password`, `forgot`, `reset` ;
- `GET /api/auth/me`.

**Administration (session obligatoire) :**
- biens : `GET/POST /api/admin/biens`, `PUT/DELETE /api/admin/biens/:id`, `POST /api/admin/biens/ordre` ;
- photos : `POST /api/admin/photos` ;
- demandes : `GET /api/admin/demandes`, `GET /api/admin/demandes.csv`, `PATCH/DELETE /api/admin/demandes/:id`, `GET /api/admin/demandes/:id/photos/:n` ;
- tableau de bord : `GET /api/admin/stats` ;
- utilisateurs : `GET/POST /api/admin/utilisateurs`, `PATCH/DELETE /api/admin/utilisateurs/:id` ;
- intégrations : `GET /api/admin/integrations` ;
- sauvegardes : `GET /api/admin/sauvegarde`, `POST /api/admin/sauvegarde/biens`.

**Synchronisation externe (« à connecter », clé `SYNC_API_KEY`) :**
- `GET /api/v1/biens` ;
- `PUT/DELETE /api/v1/biens/:refExterne` ;
- voir `docs/API.md`.

**Tâche quotidienne** (Vercel Cron à 4 h, `CRON_SECRET`) : `GET /api/cron/daily`. Elle fait :
- la sauvegarde complète ;
- le nettoyage des fichiers temporaires ;
- l'envoi des alertes e-mail ;
- la suppression des demandes de plus de 36 mois.

---

## 6. Sécurité et RGPD

- **Rôles :** propriétaire (tout), administrateur (tout sauf les autres administrateurs), négociateur (biens et demandes, sans suppression ni export).
- **Mots de passe :** hachés avec scrypt, 10 caractères minimum avec lettres et chiffres.
  - Le mot de passe provisoire doit être changé, et c'est imposé par le serveur.
  - Verrouillage de 15 minutes après 5 échecs.
  - Réinitialisation par e-mail (si configuré) ou par un administrateur.
- **Sessions :** cookie `HttpOnly`, `Secure`, `SameSite=Strict`, signé, valable 8 h. Un changement de mot de passe invalide les autres sessions.
- **Protection CSRF :** vérification de l'origine et en-tête dédié.
- **Validation côté serveur** de tous les champs.
- **Images :** le vrai format est vérifié à partir du contenu du fichier.
- **Export CSV** protégé contre l'injection de formules.
- **En-têtes HTTP :** CSP stricte (aucun script externe), HSTS, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy.
- **Formulaires :** consentement enregistré avec la date et le texte, piège à robots, limite d'envois par IP (hachée).
- **Aucun traceur :**
  - polices hébergées sur le site ;
  - carte Google chargée seulement après un clic ;
  - favoris stockés uniquement dans le navigateur ;
  - donc aucun bandeau cookies n'est nécessaire.
- **Pages légales** générées depuis la config. Les informations inconnues sont marquées « À compléter », rien n'est inventé.
- **Secrets :** aucun dans le code, tout passe par les variables d'environnement.

**Variables d'environnement** (noms seulement) :
- obligatoires : `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `BLOB_READ_WRITE_TOKEN` ;
- recommandées : `CRON_SECRET`, `SITE_URL` ;
- e-mails : `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFY_EMAIL` ;
- synchronisation : `SYNC_API_KEY` ;
- en local : `STORAGE=fs`.

---

## 7. Tests réalisés

- **API, 36 vérifications :**
  - connexion, verrouillage, rôles, CSRF ;
  - validation, faux fichiers refusés, anti-spam ;
  - suivi, export CSV ;
  - API de synchronisation, tâche quotidienne.
- **Navigateur (Playwright), en local puis en production :**
  - recherche, favoris ;
  - estimation avec photo, contact, visite ;
  - suivi par code, alerte, rendez-vous (week-ends refusés) ;
  - pages légales ;
  - réception dans l'admin : statut, note, photo, CSV.
- **Mobile (375 px)** : aucun débordement horizontal, aucune erreur JavaScript.
- **En production :**
  - migration des 10 biens ;
  - envoi d'une photo par l'admin ;
  - sauvegarde nocturne déclenchée ;
  - suppression des demandes de test.

---

## 8. État réel

**Fonctionnel :**
- comptes et sécurité ;
- gestion complète des biens ;
- réception et suivi des demandes ;
- espace client ;
- tableau de bord ;
- sauvegardes et restauration ;
- pages légales.

**Données de démonstration ou provisoires :**
- les 10 biens sont de vraies annonces, mais figées au 13/10/2026 ; seul Bandol est complet ;
- textes et équipe de l'accueil repris du site actuel ;
- note d'avis 4,7/5 issue de PagesJaunes (avis de 2021) ;
- identifiant administrateur provisoire `admin@aei-cote-mer.fr` ;
- informations légales « À compléter ».

**À connecter (service externe) :**
- e-mails via Resend (code prêt, désactivé) ;
- logiciel de transaction de l'agence (API générique prête, désactivée, aucune intégration inventée) ;
- base de données PostgreSQL seulement en cas de fort volume.

**À vérifier avant de vendre :**
- compléter les mentions légales et le barème d'honoraires (obligatoire), avec une relecture juridique ;
- contrat de sous-traitance RGPD ;
- connaître le logiciel de l'agence et ses portails de diffusion (risque de double saisie) ;
- activer les e-mails ;
- nom de domaine, puis retrait du `noindex` ;
- référencement des fiches (construites dans le navigateur) ;
- forfait Vercel Pro (le gratuit est non commercial) ;
- comptes nominatifs, changement des mots de passe communiqués, double authentification sur Vercel ;
- suppression de l'ancien store public ;
- contrat de maintenance.

**Limite honnête :** ce n'est pas l'équivalent de La Boîte Immo. Il manque notamment :
- la multidiffusion vers les portails (SeLoger, Leboncoin…) ;
- le rapprochement automatique acquéreurs/biens ;
- le registre des mandats ;
- la signature électronique.

C'est un site d'agence haut de gamme avec une vraie gestion des biens et des demandes.

---

## 9. Pistes pour la suite (par priorité)

1. Activer les e-mails (Resend + domaine vérifié de l'agence).
2. Identifier le logiciel de transaction de l'agence, puis écrire le connecteur vers `/api/v1`.
3. Générer les fiches de biens côté serveur pour un meilleur référencement.
4. Ajouter une page « Nos biens » avec pagination quand le catalogue dépassera quelques dizaines de biens.
5. Passer à PostgreSQL si le volume de demandes devient important.
6. Mettre en place la double authentification pour l'admin.
7. Rendre les textes de l'accueil configurables, pour réutiliser la solution plus vite avec d'autres agences.
