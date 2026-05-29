# Mettre MILOU en ligne — 0 €

Guide pour que **tout le monde** accède au site via une URL publique, sans payer.

| Service | Rôle | Prix |
|---------|------|------|
| [MongoDB Atlas](https://www.mongodb.com/atlas) | Base de données | Gratuit (M0) |
| [Render](https://render.com) | API Node.js | Gratuit |
| [Vercel](https://vercel.com) | Site Next.js | Gratuit |

> **Note gratuite Render** : après ~15 min sans visite, l’API « dort ». La 1ʳᵉ requête peut prendre 30–60 s. Le site reste utilisable ; c’est la limite du plan gratuit.

---

## Étape 1 — Base de données (MongoDB Atlas)

1. Créez un compte sur https://www.mongodb.com/atlas  
2. **Build a Database** → plan **M0 FREE**  
3. Région proche de vous (ex. `Frankfurt`)  
4. **Database Access** → Add user (login + mot de passe) → notez-les  
5. **Network Access** → **Allow Access from Anywhere** (`0.0.0.0/0`) — requis pour Render/Vercel  
6. **Connect** → **Drivers** → copiez l’URI, ex. :
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/milou?retryWrites=true&w=majority
   ```
   Remplacez `USER`, `PASSWORD` et gardez `/milou` comme nom de base.

---

## Étape 2 — API sur Render

1. Poussez le projet sur **GitHub** (compte gratuit)  
2. https://render.com → **Sign up** (avec GitHub)  
3. **New +** → **Web Service** → repo `milou`  
4. Réglages :
   - **Root Directory** : `backend`
   - **Build** : `npm install`
   - **Start** : `npm start`
   - **Instance Type** : **Free**
5. Variables d’environnement :

   | Clé | Valeur |
   |-----|--------|
   | `MONGODB_URI` | URI Atlas (étape 1) |
   | `JWT_SECRET` | Chaîne longue aléatoire (ex. 32 caractères) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `FRONTEND_URL` | Laisser vide pour l’instant, on la remplit après Vercel |

6. **Create Web Service** → notez l’URL, ex. `https://milou-api.onrender.com`  
7. Test : ouvrir `https://VOTRE-API.onrender.com/api/health` → doit afficher `{"status":"ok"}`

### Créer l’admin (une fois)

Sur **votre PC**, dans le dossier `backend`, créez un fichier `.env` temporaire avec l’URI Atlas :

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=votre-secret
```

Puis :

```bash
cd backend
npm install
npm run seed
```

Compte admin : `admin@milou.app` / `admin123` — **changez le mot de passe** après la 1ʳᵉ connexion si le site est public.

---

## Étape 3 — Site sur Vercel

1. https://vercel.com → compte gratuit (GitHub)  
2. **Add New Project** → importez le même repo  
3. Réglages :
   - **Root Directory** : `frontend`
   - Framework : Next.js (détecté auto)
4. Variable d’environnement :

   | Clé | Valeur |
   |-----|--------|
   | `NEXT_PUBLIC_API_URL` | `https://VOTRE-API.onrender.com/api` |

5. **Deploy** → URL du site, ex. `https://milou.vercel.app`

---

## Étape 4 — Relier frontend et API

1. **Render** → service API → **Environment**  
2. Mettez à jour `FRONTEND_URL` :
   ```
   https://milou.vercel.app
   ```
   (votre vraie URL Vercel, sans slash final)  
3. **Save** → Render redéploie automatiquement.

---

## Résultat

- **Site public** : `https://votre-projet.vercel.app`  
- **API** : `https://votre-api.onrender.com`  
- Accessible depuis n’importe quel navigateur, sans installer quoi que ce soit.

Partagez uniquement l’URL Vercel aux utilisateurs.

---

## Garder l’API plus réactive (optionnel, toujours 0 €)

Sur https://uptimerobot.com (gratuit), créez un monitor HTTP qui appelle toutes les 5 minutes :

```
https://VOTRE-API.onrender.com/api/health
```

Cela réduit les mises en veille sur Render.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Erreur CORS | `FRONTEND_URL` sur Render = URL exacte Vercel |
| API ne répond pas | Attendre 1 min (réveil Render) ou vérifier logs Render |
| Connexion DB | Vérifier URI Atlas, IP `0.0.0.0/0`, user/mot de passe |
| Inscription impossible | `MONGODB_URI` correct sur Render |

---

## Sécurité (site public)

1. Changez `JWT_SECRET` (long et aléatoire)  
2. Changez le mot de passe admin après `npm run seed`  
3. Ne commitez jamais `.env` sur GitHub (déjà dans `.gitignore`)
