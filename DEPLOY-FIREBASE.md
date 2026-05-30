# MILOU en ligne — 100 % gratuit avec Firebase

**Une seule plateforme à déployer : Vercel.**  
Plus besoin de Render ni MongoDB.

| Service | Rôle | Toujours actif ? | Prix |
|---------|------|------------------|------|
| **Firebase Auth** | Connexion / inscription | Oui | Gratuit |
| **Firestore** | Données (users, annonces, Milou…) | Oui | Gratuit (quota généreux) |
| **Vercel** | Site + API sécurisée | Oui (pas de veille comme Render) | Gratuit |

La navigation (marketplace, profil, solde) lit **Firestore directement** → réponse instantanée, sans attente.

---

## Étape 1 — Projet Firebase (5 min)

1. https://console.firebase.google.com → **Créer un projet** (ex. `milou-app`)
2. Désactivez Google Analytics si vous voulez (optionnel)
3. **Build** → **Authentication** → **Commencer** → activez **E-mail/Mot de passe**
4. **Build** → **Firestore Database** → **Créer** → mode **production** → région `europe-west`
5. **Règles** → collez le contenu du fichier `firestore.rules` à la racine du projet → **Publier**

### Config Web (frontend)

**Paramètres projet** (engrenage) → **Vos applications** → **</> Web** → enregistrez l’app.

Copiez les clés dans `frontend/.env.local` :

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### Compte de service (API Vercel)

**Paramètres** → **Comptes de service** → **Générer une nouvelle clé privée** (JSON).

Dans Vercel, ajoutez ces variables (depuis le JSON) :

```env
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> Pour `FIREBASE_PRIVATE_KEY` sur Vercel : collez la clé entière entre guillemets, avec les `\n` pour les retours à la ligne.

---

## Étape 2 — GitHub + Vercel

1. Poussez le dossier `milou` sur **GitHub** (gratuit)
2. https://vercel.com → **Import** le repo
3. **Root Directory** : `frontend`
4. Ajoutez **toutes** les variables `.env` (NEXT_PUBLIC_* + FIREBASE_*)
5. **Deploy**

Votre URL publique : `https://milou-xxx.vercel.app` — partagez-la à tout le monde.

---

## Étape 3 — Compte admin

1. Sur le site : **S’inscrire** avec `admin@milou.app` (ou votre email)
2. Firebase Console → **Firestore** → collection `users` → votre document
3. Modifiez le champ `role` : `user` → **`admin`**
4. Optionnel : mettez `balance` à `1000`

Reconnectez-vous → menu **Admin** visible.

---

## Comparaison avec l’ancienne méthode (Render + MongoDB)

| | Render + MongoDB | Firebase + Vercel |
|--|------------------|-------------------|
| Coût | 0 € | 0 € |
| Site qui dort | Oui (30–60 s) | Non |
| Carte bancaire | Non | Non (plan Spark) |
| Services à gérer | 3 | 2 |

---

## Développement local

```bash
cd frontend
cp .env.example .env.local
# Remplir les clés Firebase
npm install
npm run dev
```

Ouvrez http://localhost:3000

Le dossier `backend/` (Express + MongoDB) n’est plus nécessaire pour la version en ligne.

---

## Limites gratuites (largement suffisantes pour démarrer)

- **Firestore** : 50 000 lectures / jour, 20 000 écritures / jour
- **Auth** : illimité en pratique pour un petit projet
- **Vercel** : bande passante généreuse en hobby

Aucune monnaie réelle — Milou reste 100 % fictif.

---

## Premium MILOU (Stripe)

Voir le guide détaillé : **`PREMIUM-STRIPE.md`**

Variables supplémentaires sur Vercel :

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_STRIPE_PRICE_LABEL` (optionnel, ex. `4,99 € / mois`)
