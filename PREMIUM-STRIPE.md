# Premium MILOU — Configuration Stripe

## 1. Créer un produit Stripe

1. [dashboard.stripe.com](https://dashboard.stripe.com) → **Produits** → **Ajouter un produit**
2. Nom : `Premium MILOU`
3. Tarification : **Récurrent** → mensuel → ex. 4,99 €
4. Copiez l’**ID du prix** (`price_...`) → `STRIPE_PRICE_ID`

## 2. Clés API

**Développeurs** → **Clés API** :

- Clé secrète → `STRIPE_SECRET_KEY` (Vercel + `.env.local`)
- Ne jamais mettre la clé secrète côté client

## 3. Webhook

**Développeurs** → **Webhooks** → **Ajouter un endpoint**

- URL : `https://VOTRE-DOMAINE.vercel.app/api/premium/webhook`
- Événements :
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Copiez le **Signing secret** → `STRIPE_WEBHOOK_SECRET`

En local (optionnel) :

```bash
stripe listen --forward-to localhost:3000/api/premium/webhook
```

## 4. Variables Vercel

Ajoutez sur Vercel (Settings → Environment Variables) :

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook |
| `STRIPE_PRICE_ID` | ID du prix mensuel |
| `NEXT_PUBLIC_APP_URL` | URL du site (sans slash final) |
| `NEXT_PUBLIC_STRIPE_PRICE_LABEL` | Affichage prix (ex. `4,99 € / mois`) |

Puis **Redeploy**.

## 5. Test

1. Mode test Stripe : carte `4242 4242 4242 4242`
2. `/premium` → **Passer Premium**
3. Après paiement → `/premium/success`
4. Firestore `users/{uid}` : `isPremium: true`, `premiumExpiresAt` défini

## Champs utilisateur Firestore

- `isPremium` (boolean)
- `premiumExpiresAt` (timestamp)
- `stripeCustomerId` / `stripeSubscriptionId` (optionnel)
