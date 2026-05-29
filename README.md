# MILOU — Plateforme d'économie virtuelle

MILOU est une application web où les utilisateurs échangent une monnaie fictive **Milou** pour acheter et vendre des services entre eux. Aucune monnaie réelle n'est impliquée.

## Stack

| Couche | Technologies |
|--------|--------------|
| Frontend | Next.js 14, React, TailwindCSS |
| Backend | Node.js, Express |
| Base de données | MongoDB (Mongoose) |
| Auth | JWT + bcrypt |

## Fonctionnalités

- **Comptes** : inscription (+10 Milou), connexion, session JWT
- **Monnaie** : solde, transferts par email, historique complet
- **Marketplace** : annonces offre/demande, catégories, tags
- **Escrow** : blocage des Milou à l'acceptation, libération à validation
- **Profil** : stats, réputation, annonces actives
- **Admin** : gestion utilisateurs, ajustements solde, modération

## Prérequis

- Node.js 18+
- MongoDB (local ou Atlas)

## Installation

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # ou utiliser le .env fourni
npm run seed           # crée admin@milou.app / admin123
npm run dev
```

API : http://localhost:5000

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App : http://localhost:3000

## Compte admin (après seed)

- **Email** : `admin@milou.app`
- **Mot de passe** : `admin123`

## Pages

| Route | Description |
|-------|-------------|
| `/` | Accueil |
| `/register` | Inscription |
| `/login` | Connexion |
| `/dashboard` | Tableau de bord |
| `/marketplace` | Liste des annonces |
| `/create` | Créer une annonce |
| `/transfer` | Transfert Milou |
| `/profile` | Profil utilisateur |
| `/admin` | Panel admin (rôle admin) |

## API principale

- `POST /api/auth/register` — Inscription
- `POST /api/auth/login` — Connexion
- `GET /api/auth/me` — Utilisateur courant
- `GET /api/transactions` — Historique
- `POST /api/transactions/transfer` — Transfert
- `GET/POST /api/listings` — Marketplace
- `POST /api/listings/:id/accept` — Accepter + escrow
- `POST /api/listings/missions/:id/complete` — Valider mission
- `GET /api/admin/*` — Administration

## Sécurité

- Mots de passe hashés (bcrypt, 12 rounds)
- Validation backend (express-validator)
- Transactions MongoDB atomiques
- Routes admin protégées par rôle JWT
- Pas de solde négatif

## Publier le site en ligne (0 €)

**[MODE-EMPLOI.md](./MODE-EMPLOI.md)** — guide pas à pas (~20 min) : GitHub → Firebase → Vercel.

Détails techniques : [DEPLOY-FIREBASE.md](./DEPLOY-FIREBASE.md)

## Licence

Projet éducatif / démo — monnaie 100 % fictive.
