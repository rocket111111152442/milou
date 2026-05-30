# Importer toutes les variables sur Vercel en une fois

## Méthode rapide (recommandée)

Si tu as déjà `frontend/.env.local` qui marche en local :

```powershell
cd frontend
npm run env:vercel
```

Cela crée **`frontend/vercel-import.env`** avec tout Firebase + Stripe + URL Vercel.

Ensuite sur **Vercel** :

1. Projet **milou** → **Settings** → **Environment Variables**
2. Clique **Import** (ou **Import .env** / **Bulk import**)
3. Sélectionne le fichier `frontend/vercel-import.env`
4. Coche **Production** et **Preview**
5. **Import** puis **Deployments** → **Redeploy**

---

## Méthode manuelle (sans script)

1. Copie le modèle :
   ```powershell
   cd frontend
   copy .env.vercel.template vercel-import.env
   ```
2. Ouvre `vercel-import.env` et colle les valeurs depuis ton `.env.local` + Stripe
3. Importe ce fichier sur Vercel (même étapes qu’au-dessus)

---

## Variables Stripe à compléter

| Variable | Où la trouver |
|----------|----------------|
| `STRIPE_PRICE_ID` | Déjà dans le template : `price_1TckbB2fqOd9ClAbeX1JE9KZ` |
| `STRIPE_SECRET_KEY` | Stripe → Développeurs → Clés API |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → endpoint `https://milou-delta.vercel.app/api/premium/webhook` |
| `NEXT_PUBLIC_APP_URL` | `https://milou-delta.vercel.app` |

---

## Sécurité

- **Ne committe jamais** `vercel-import.env` (déjà dans `.gitignore`)
- Ne partage pas ce fichier (il contient tes clés secrètes)
