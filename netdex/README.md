# Netdex — collectionne internet

Jeu de cartes à collectionner où chaque carte est un **vrai site web**. Plus un site est visité dans le monde, plus sa carte est rare.

- **973 000+ sites** issus du classement [Tranco](https://tranco-list.eu) (top 1 million, agrégé à partir de plusieurs mesures de trafic), téléchargé automatiquement au premier lancement.
- Domaines techniques (CDN, DNS, pub, télémétrie) et sites adultes retirés par filtres de mots-clés (imparfait : quelques-uns passent).
- **1 booster de 5 cartes toutes les 3 minutes**, calculé côté serveur : le chrono tourne même app fermée (stock max 10).
- Comptes (pseudo + mot de passe), amis, échanges entre amis, enchères ouvertes à tous, classement, Netdex (pokédex), recherche dans tout le classement, bonus quotidien, booster Premium, cartes HOLO, recyclage des doublons, thème clair/sombre.
- **Application installable** (PWA) sur Android et iPhone.

## Raretés

| Rareté | Rang mondial | Sites | Chance par carte | Valeur |
|---|---|---|---|---|
| Mythique | 1 – 25 | 25 | 0,1 % | 1 500 |
| Légendaire | 26 – 250 | 225 | 0,8 % | 200 |
| Épique | 251 – 2 500 | 2 250 | 3,6 % | 40 |
| Rare | 2 501 – 25 000 | 22 500 | 10,5 % | 10 |
| Peu commune | 25 001 – 150 000 | 125 000 | 25 % | 3 |
| Commune | au-delà | ~823 000 | 60 % | 1 |

La 5ᵉ carte de chaque booster est au moins Rare. 2 % de chance d'HOLO (valeur ×5). Réglages dans `server/sites.js` et `server/game.js` (`CONFIG`).

## Hébergement : Vercel + Postgres (Neon)

- Le front (`public/`) est servi par le CDN de Vercel, l'API est une fonction Vercel (`api/index.js`, toutes les routes `/api/*`).
- Les données sont dans **Postgres** (Neon, offre gratuite suffisante : la base pèse ~130 Mo).
- Au build, `scripts/migrate.js` crée les tables et importe le classement Tranco si la base est vide (~15 s).

Mise en place :
1. Projet Vercel avec **Root Directory = `netdex`**.
2. Onglet **Storage** du projet → **Create Database** → **Neon** (gratuit) → connecter au projet. Vercel ajoute `DATABASE_URL` tout seul.
3. **Redéployer** : le build initialise la base.

`/api/health` indique si la base est connectée.

## Lancer en local

```bash
cd netdex && npm install
export DATABASE_URL=postgres://user:mdp@localhost/netdex
npm run migrate    # tables + import Tranco
npm start          # http://localhost:3000
TEST_DATABASE_URL=postgres://user:mdp@localhost/netdex_test npm test   # base de test vidée à chaque passage
```

Hors ligne : `TRANCO_FILE=chemin/top-1m.csv.zip npm run migrate`. Ailleurs que sur Vercel : `Dockerfile` fourni (il faut aussi un `DATABASE_URL`).

## Installer sur téléphone

- **Android (Chrome)** : bouton « Installer » dans l'app, ou menu ⋮ → *Installer l'application*.
- **iPhone (Safari)** : bouton Partager → *Sur l'écran d'accueil*.

## Architecture

- `lib/api.js` — routes JSON, sessions par cookie HttpOnly, mots de passe scrypt.
- `lib/game.js` — règles : boosters, dex, échanges, enchères (anti-snipe, commission 5 %), amis. Transactions Postgres avec verrous : pas de double ouverture ni de solde négatif en cas de requêtes simultanées.
- `lib/sites.js` — import Tranco, filtres, paliers de rareté.
- `lib/db.js` — schéma et accès Postgres.
- `api/index.js` — fonction Vercel ; `server/dev.js` — serveur local / Docker.
- `public/` — application monopage en JavaScript natif (aucun framework), service worker, manifest.
