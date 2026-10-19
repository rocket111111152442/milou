# Site immobilier + espace de gestion — Acor’Immo

Site vitrine d'agence immobilière avec un espace d'administration :
- gestion des biens ;
- réception et suivi des demandes clients ;
- tableau de bord ;
- comptes de l'équipe ;
- espace client (favoris, suivi, alertes, rendez-vous).

Adaptation, pour l’agence Acor’Immo (La Seyne-sur-Mer, Six-Fours-les-Plages, Sanary-sur-Mer, Toulon), de la solution construite pour AEI Côté Mer (dossier `../aei-var-redesign`, inchangé). La base reste réutilisable pour d'autres agences (voir « Adapter à une autre agence »).

Démo : https://acorimmo.vercel.app · Administration : `/admin` · État détaillé : `docs/BILAN.md`

## Architecture

```
public/            Site statique (seul dossier servi publiquement)
  index.html, bien.html, espace-client.html, pages légales (générées)
  admin/           Interface d'administration (modules JS, sans framework)
  forms.js         Envoi des formulaires vers l'API (validation, anti-robot)
  favoris.js       Favoris (stockés dans le navigateur uniquement)
api/router.js      UNE fonction serveur : toutes les routes /api/* passent par elle
lib/
  storage.js       Couche de stockage remplaçable : Vercel Blob PRIVÉ ou fichiers locaux
  auth.js          Comptes, mots de passe (scrypt), sessions signées
  biens.js         Modèle et validation des biens
  leads.js         Modèle et validation des demandes, export CSV
  email.js         Envoi d'e-mails via Resend (désactivé tant que non configuré)
  ratelimit.js     Limitation des essais (anti-spam, anti force brute)
  routes/          public, auth, admin, sync (API externe), cron (tâche quotidienne)
config/agence.js   Toutes les informations de l'agence (à adapter par agence)
scripts/
  dev.mjs          Serveur local (site + API, mêmes en-têtes de sécurité qu'en production)
  build-pages.mjs  Génère les pages légales et l'espace client depuis config + gabarits
  pages/           Gabarits de ces pages
  import/          Relevé des annonces du site actuel (scrape-acorimmo.mjs) et import dans le stockage (import-annonces.mjs)
docs/API.md        API de synchronisation (à connecter)
```

Choix techniques :

- **Une seule fonction serveur.** Le forfait gratuit de Vercel limite le nombre de fonctions, et un point d'entrée unique est plus simple à sécuriser.
- **Stockage Blob privé.** Aucune donnée client n'est accessible par une URL publique. Les photos des biens sont diffusées par `/api/media/…`.
- **Écritures protégées.** Les écritures concurrentes sont contrôlées par empreinte (ETag) : deux personnes qui enregistrent en même temps ne s'écrasent pas.
- **Passage à une vraie base de données.** Pour une agence avec beaucoup de demandes (plusieurs milliers), il est conseillé de passer à PostgreSQL. Seul `lib/storage.js` (et les listes de `lib/leads.js`) serait à réécrire.

## Sécurité

- **Comptes :** comptes nominatifs avec 3 rôles (propriétaire, administrateur, négociateur).
- **Mots de passe :** hachés avec scrypt, 10 caractères minimum avec lettres et chiffres. Le mot de passe provisoire doit être changé à la première connexion.
- **Sessions :** cookie `HttpOnly`, `Secure`, `SameSite=Strict`, signé (HMAC) et valable 8 h. Un changement de mot de passe déconnecte les autres sessions.
- **Protections :**
  - verrouillage 15 min après 5 échecs de connexion ;
  - limitation des envois de formulaires par adresse IP (hachée) ;
  - piège à robots (champ caché + délai minimal) ;
  - vérification de l'origine des requêtes (protection CSRF).
- **Validation :** toutes les données sont revalidées côté serveur. Le vrai format des images est contrôlé (un faux fichier est refusé). L'export CSV est protégé contre l'injection de formules.
- **En-têtes HTTP :** CSP stricte (aucun script externe), HSTS, X-Frame-Options, etc. (voir `vercel.json`).
- **Secrets :** aucun secret dans le code ; tout passe par les variables d'environnement (voir `.env.example`).

## Lancer en local

```bash
npm install
STORAGE=fs SESSION_SECRET=$(openssl rand -hex 32) ADMIN_EMAIL=moi@exemple.fr ADMIN_PASSWORD=MotDePasse123 node scripts/dev.mjs
# → http://localhost:3000 ; admin : http://localhost:3000/admin
```

Après une modification de `config/agence.js` ou de l'en-tête et du pied de page de l'accueil :
`node scripts/build-pages.mjs`.

## Mise en ligne (Vercel)

1. Projet Vercel avec « Root Directory » = ce dossier.
2. Store **Vercel Blob privé** relié au projet. Cela crée `BLOB_READ_WRITE_TOKEN`.
3. Variables `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CRON_SECRET` (et les autres de `.env.example` au besoin).
4. Première connexion à `/admin` avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Le compte propriétaire est alors créé et le mot de passe doit être changé.

## Adapter à une autre agence

1. `config/agence.js` : nom, coordonnées, informations légales (carte T, garant, médiateur…).
2. `public/index.html` : textes, équipe, secteurs, photos d'accueil.
3. `public/styles.css` : couleurs (variables CSS en tête de fichier).
4. `node scripts/build-pages.mjs` pour regénérer les pages légales et l'espace client.
5. Nouveau projet Vercel, nouveau store Blob privé, nouvelles variables.
6. Annonces : `scripts/import/` montre comment reprendre celles du site actuel (relevé → fichier JSON → import avec photos
   redimensionnées, en local ou via l’API de synchronisation). Le relevé dépend du site d’origine : à réécrire pour chaque agence.

Limite actuelle : les textes de l'accueil sont écrits dans le HTML et non dans la config. Une agence = une copie du dossier.


## Import des annonces (Acor’Immo)

```bash
# 1. Relevé des annonces publiées sur acorimmo.fr → scripts/import/annonces-acorimmo.json
node scripts/import/scrape-acorimmo.mjs --cache=/tmp/acor-pages
# 2a. Import local (.data/), photos redimensionnées en WebP 1600 px (ImageMagick requis)
STORAGE=fs node scripts/import/import-annonces.mjs --fichier=scripts/import/annonces-acorimmo.json
# 2b. Import dans le site en ligne, via l'API de synchronisation (SYNC_API_KEY définie dans Vercel puis retirée)
SYNC_API_KEY=… node scripts/import/import-annonces.mjs --fichier=scripts/import/annonces-acorimmo.json --api=https://acorimmo.vercel.app
```

Relancer l'import met à jour les biens existants (clé : référence de l'agence) sans doublon. 8 photos par bien au maximum
(3 pour les biens vendus) : l'agence peut en ajouter depuis l'admin (30 max).

## Ajouts « parité + CRM »

- Rendu serveur : `lib/ssr.js` (gabarits générés par `node scripts/build-pages.mjs` dans `lib/*.generated.js` — à relancer après toute modification de `scripts/pages/*` ou de l'en-tête/pied de page de `public/index.html`, puis committer les fichiers générés).
- Contenu initial des communes et des avis : `config/contenu-initial.js` (utilisé tant que rien n'est enregistré dans l'admin).
- CRM : `lib/crm.js`, routes `lib/routes/crm.js`, vues `public/admin/js/views/{contacts,taches,mandats,rapports,contenu}.js`.
- Traductions : `public/i18n.js` + `public/i18n-dict.js` (clé = texte français exact).
