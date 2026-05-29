# Publier MILOU sur Internet

Ce guide vous explique comment mettre en ligne la plateforme **MILOU** : une application web gratuite où les utilisateurs échangent une monnaie fictive appelée **Milou** (aucun argent réel).

À la fin, vous obtiendrez une adresse du type `https://milou-xxx.vercel.app` que vous pourrez envoyer à n’importe qui. Le site reste accessible 24 h/24, sans payer et sans faire tourner votre ordinateur.

---

## Ce dont vous avez besoin

| Outil | Rôle | Coût |
|-------|------|------|
| [GitHub](https://github.com) | Héberger le code source | Gratuit |
| [Firebase](https://console.firebase.google.com) | Comptes utilisateurs + base de données | Gratuit |
| [Vercel](https://vercel.com) | Afficher le site au public | Gratuit |

Prévoyez environ **20 minutes** et **aucune carte bancaire**.

---

## Comment tout s’articule

Votre projet est découpé en deux parties sur le disque :

- **`frontend/`** — le site visible (pages, design, formulaires). C’est **seule cette partie** qui sera publiée.
- **`backend/`** — ancienne version locale ; **vous pouvez l’ignorer** pour la mise en ligne.

Le schéma suivant résume le parcours :

```
  Votre ordinateur          GitHub              Vercel
  (code MILOU)      →    (stockage)     →    (site public)
                              │
                              ▼
                         Firebase
                    (inscriptions, Milou,
                     annonces, transactions)
```

**GitHub** conserve votre code. **Vercel** le transforme en site web. **Firebase** gère les comptes et les données en arrière-plan, toujours disponibles (contrairement à certains hébergeurs gratuits qui « s’endorment » après quelques minutes d’inactivité).

---

## Étape 1 — Envoyer le code sur GitHub

GitHub sert de coffre-fort pour votre projet. Vercel s’y connectera ensuite pour déployer automatiquement le site à chaque mise à jour.

### Créer le dépôt

1. Rendez-vous sur [github.com](https://github.com) et créez un compte si nécessaire.
2. Cliquez sur **New repository** (nouveau dépôt).
3. Donnez-lui le nom `milou`, laissez les autres options par défaut, puis validez avec **Create repository**.

### Envoyer les fichiers depuis votre PC

Ouvrez **PowerShell** dans le dossier du projet et exécutez les commandes ci-dessous **une par une**. Remplacez `VOTRE-PSEUDO` par votre identifiant GitHub (visible en haut à droite sur le site).

```powershell
cd "c:\Users\Utilisateur\Downloads\numwork\virus pas suspect\milou"
git init
git add .
git commit -m "Première version de MILOU"
git branch -M main
git remote add origin https://github.com/VOTRE-PSEUDO/milou.git
git push -u origin main
```

La première fois, GitHub peut vous demander de vous connecter dans le navigateur : suivez les instructions à l’écran.

> **Git n’est pas installé ?** Téléchargez-le sur [git-scm.com/download/win](https://git-scm.com/download/win), installez-le, puis relancez PowerShell.

Quand la commande `git push` se termine sans erreur, votre code est en ligne. Passez à l’étape 2.

---

## Étape 2 — Configurer Firebase

Firebase remplace une base de données et un système de connexion que vous auriez dû installer vous-même. Tout se configure depuis le navigateur.

### 2.1 — Créer le projet

1. Ouvrez la [console Firebase](https://console.firebase.google.com).
2. Cliquez sur **Ajouter un projet**.
3. Nommez-le par exemple `milou`, puis suivez l’assistant jusqu’à **Créer le projet**.

Vous disposez maintenant d’un espace dédié à votre application.

### 2.2 — Activer la connexion par e-mail

Les utilisateurs se connecteront avec une adresse e-mail et un mot de passe.

1. Dans le menu de gauche : **Build** → **Authentication**.
2. Cliquez sur **Commencer**, puis ouvrez l’onglet **Sign-in method**.
3. Activez **E-mail/Mot de passe** et enregistrez.

### 2.3 — Créer la base de données Firestore

Firestore stockera les profils, les soldes en Milou, les annonces et l’historique des transactions.

1. **Build** → **Firestore Database** → **Créer une base**.
2. Choisissez le mode **Production** (les règles de sécurité protégeront les données).
3. Sélectionnez une région proche de vous, par exemple **europe-west**, puis **Activer**.

### 2.4 — Publier les règles de sécurité

Ces règles empêchent un visiteur malveillant de modifier le solde Milou de quelqu’un d’autre. Elles sont déjà rédigées dans votre projet.

1. Dans Firestore, ouvrez l’onglet **Règles**.
2. Sur votre PC, ouvrez le fichier `firestore.rules` à la **racine** du dossier MILOU.
3. Copiez tout son contenu, collez-le dans l’éditeur Firebase à la place du texte existant, puis cliquez sur **Publier**.

### 2.5 — Récupérer les clés « site web »

Ces identifiants permettent au navigateur de communiquer avec Firebase. Vous les copierez ensuite dans Vercel.

1. Cliquez sur l’**engrenage** en haut à gauche → **Paramètres du projet**.
2. Descendez jusqu’à **Vos applications** et cliquez sur l’icône **`</>`** (Web).
3. Donnez un nom à l’application (par ex. `milou-web`) et validez avec **Enregistrer l’application**.
4. Firebase affiche un bloc de configuration. Vous allez créer **six variables** sur Vercel en reprenant les valeurs indiquées :

| Nom exact sur Vercel | Valeur à copier depuis Firebase |
|----------------------|----------------------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

Gardez cette page ouverte ou notez ces valeurs dans un fichier texte : vous en aurez besoin à l’étape 3.

### 2.6 — Récupérer la clé « serveur »

Certaines actions sensibles (inscription avec bonus de 10 Milou, transferts, escrow) passent par le serveur Vercel. Il a besoin d’une clé d’administration Firebase.

1. Toujours dans **Paramètres du projet**, ouvrez l’onglet **Comptes de service**.
2. Cliquez sur **Générer une nouvelle clé privée**, confirmez : un fichier `.json` se télécharge.
3. Ouvrez ce fichier et créez **trois variables** supplémentaires pour Vercel :

| Nom sur Vercel | Contenu (dans le fichier JSON) |
|----------------|--------------------------------|
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | tout le champ `private_key`, de `-----BEGIN` à `-----END` |

Pour `FIREBASE_PRIVATE_KEY` sur Vercel : collez la clé entre guillemets doubles `"..."`. Si la clé contient des retours à la ligne, Vercel les accepte tels quels ou sous forme de `\n` — l’important est de ne pas tronquer le texte.

Au total, vous devez avoir **neuf variables** prêtes pour l’étape suivante.

---

## Étape 3 — Publier le site sur Vercel

Vercel lit votre code sur GitHub, compile le dossier `frontend` et le met à disposition sur Internet.

1. Connectez-vous sur [vercel.com](https://vercel.com) avec **Continue with GitHub**.
2. Cliquez sur **Add New…** → **Project**, puis sélectionnez le dépôt **milou**.
3. Avant de déployer, configurez le projet :
   - **Root Directory** : cliquez sur **Edit**, choisissez le dossier **`frontend`**, puis validez. Sans cela, Vercel ne trouvera pas l’application.
   - **Environment Variables** : ajoutez une par une les neuf variables préparées aux étapes 2.5 et 2.6 (nom + valeur).
4. Cliquez sur **Deploy** et attendez une à deux minutes.

Quand le déploiement est terminé, Vercel affiche une URL en vert, par exemple `https://milou-abc123.vercel.app`. **C’est l’adresse officielle de votre plateforme** : vous pouvez la partager, la mettre en signature d’e-mail ou sur les réseaux sociaux.

### Vérifier que tout fonctionne

Ouvrez cette URL dans un navigateur, cliquez sur **S’inscrire**, créez un compte test. Si vous voyez **10 Milou** sur le tableau de bord, la chaîne GitHub → Vercel → Firebase fonctionne correctement.

---

## Étape 4 — Obtenir l’accès administrateur

Par défaut, chaque nouvel utilisateur a le rôle `user`. Pour accéder au panneau d’administration (gestion des utilisateurs, modération, ajustement des soldes), il faut passer manuellement en `admin`.

1. Sur **votre site en ligne**, inscrivez-vous avec l’e-mail que vous voulez utiliser comme admin (par ex. `admin@milou.app`).
2. Retournez dans la [console Firebase](https://console.firebase.google.com) → **Firestore Database**.
3. Ouvrez la collection **`users`**, puis le document qui correspond à votre compte (l’identifiant est une longue chaîne de caractères).
4. Modifiez le champ **`role`** : remplacez `user` par **`admin`**, puis enregistrez.
5. Sur le site : déconnectez-vous, reconnectez-vous. Le lien **Admin** apparaît dans la barre de navigation.

---

## Après la publication

**Partager la plateforme**  
Envoyez uniquement l’URL Vercel. Les visiteurs n’ont rien à installer.

**Mettre à jour le site**  
Modifiez le code sur votre PC, puis dans PowerShell :

```powershell
git add .
git commit -m "Description de la modification"
git push
```

Vercel redéploie automatiquement en quelques minutes.

**Consulter les utilisateurs**  
Firebase → **Authentication** (liste des e-mails) ou **Firestore** → collection `users` (soldes, rôles, statistiques).

**En cas de problème**  
- Vercel → votre projet → **Deployments** → cliquez sur le dernier déploiement → **Logs** pour lire les erreurs.
- Vérifiez que les neuf variables d’environnement sont bien renseignées et relancez un **Redeploy** si vous les avez ajoutées après coup.
- Vérifiez que les règles Firestore ont bien été publiées (étape 2.4).

| Problème fréquent | Piste de solution |
|-------------------|-------------------|
| Message « Firebase non configuré » | Les six variables `NEXT_PUBLIC_FIREBASE_*` manquent ou sont incorrectes sur Vercel |
| Impossible de s’inscrire | Consultez les Logs Vercel ; vérifiez surtout `FIREBASE_PRIVATE_KEY` |
| Erreur « permission denied » sur Firestore | Republiez le contenu de `firestore.rules` |
| Pas de menu Admin | Le champ `role` doit être exactement `admin` dans Firestore |

---

## Tester sur votre ordinateur (optionnel)

Utile pour développer sans toucher au site public.

```powershell
cd frontend
copy .env.example .env.local
```

Ouvrez `.env.local` et collez les **mêmes neuf valeurs** que sur Vercel. Puis :

```powershell
npm install
npm run dev
```

Rendez-vous sur [http://localhost:3000](http://localhost:3000).

---

## Pour aller plus loin

- Guide technique complémentaire : [DEPLOY-FIREBASE.md](./DEPLOY-FIREBASE.md)
- MILOU reste une **économie fictive** : les Milou n’ont aucune valeur réelle et ne peuvent pas être échangés contre de l’argent.

Vous avez maintenant une plateforme en ligne, gratuite et accessible à tous. Bonne utilisation de MILOU.
