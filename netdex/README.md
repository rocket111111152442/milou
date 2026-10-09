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

## Lancer en local

Node.js **22.13+** requis, **aucune dépendance** à installer (SQLite est intégré à Node).

```bash
cd netdex
npm start          # http://localhost:3000
npm test           # tests de la logique de jeu
```

Le premier démarrage télécharge la liste Tranco (~10 Mo) et remplit la base `data/netdex.db` (~20 s). Hors ligne : `TRANCO_FILE=chemin/top-1m.csv.zip npm start`.

## Mettre en ligne

Il faut un hébergeur avec **disque persistant** (la base SQLite y vit) et **HTTPS** (obligatoire pour installer l'app sur téléphone).

- **Docker** (VPS, Railway, Fly.io…) : `docker build -t netdex . && docker run -p 3000:3000 -v netdex-data:/data netdex`
- Variables : `PORT` (défaut 3000), `DB_FILE` (défaut `data/netdex.db`).
- Sauvegarde : copier le fichier `netdex.db` (sauvegarde à chaud possible avec `sqlite3 netdex.db ".backup save.db"`).

Les offres gratuites sans disque persistant (Render free, Vercel) **ne conviennent pas** : les comptes seraient effacés à chaque redémarrage.

## Installer sur téléphone

- **Android (Chrome)** : bouton « Installer » dans l'app, ou menu ⋮ → *Installer l'application*.
- **iPhone (Safari)** : bouton Partager → *Sur l'écran d'accueil*.

## Architecture

- `server/index.js` — serveur HTTP Node pur, sessions par cookie HttpOnly, mots de passe scrypt, fichiers statiques préchargés et précompressés (brotli/gzip).
- `server/game.js` — règles : boosters, dex, échanges, enchères (anti-snipe, commission 5 %), amis.
- `server/sites.js` — import Tranco, filtres, paliers de rareté.
- `public/` — application monopage en JavaScript natif (aucun framework), service worker, manifest.
