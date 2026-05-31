# E-mails MILOU — faire arriver les messages à tout le monde

Sans configuration **Gmail (SMTP)**, Resend en mode test **n’envoie pas** vers des adresses comme `courmetrage1@gmail.com`. D’où « rien dans la boîte mail ».

La solution recommandée : **une adresse Gmail dédiée MILOU** + mot de passe d’application.

## Étapes (15 minutes)

### 1. Créer l’adresse

1. Créez par exemple **`milou.contact@gmail.com`** (ou un autre nom disponible).
2. Connectez-vous à ce compte Google.

### 2. Mot de passe d’application

1. Compte Google → **Sécurité** → **Validation en 2 étapes** (activez-la si besoin).
2. **Mots de passe des applications** → Créer → nom « MILOU Vercel ».
3. Copiez le mot de passe à **16 caractères** (sans espaces).

### 3. Variables sur Vercel

Projet **milou** → **Settings** → **Environment Variables** → ajoutez (Production + Preview) :

| Variable | Valeur |
|----------|--------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `milou.contact@gmail.com` |
| `SMTP_PASS` | le mot de passe d’application (16 car.) |
| `MILOU_EMAIL_FROM` | `MILOU <milou.contact@gmail.com>` |

Gardez aussi Firebase et `NEXT_PUBLIC_APP_URL=https://milou-delta.vercel.app`.

`RESEND_API_KEY` est **optionnel** une fois SMTP configuré (SMTP est utilisé en premier).

### 4. Local (optionnel)

Dans `frontend/.env.local`, ajoutez les mêmes lignes `SMTP_*`, puis :

```powershell
cd frontend
npm run env:vercel
```

Importez `vercel-import.env` sur Vercel si vous régénérez le fichier.

### 5. Redéployer

**Deployments** → **Redeploy** sur le dernier déploiement.

### 6. Tester

1. Inscrivez-vous avec une adresse **différente** de celle du compte Gmail MILOU.
2. Sur `/verify-email`, cliquez **Renvoyer**.
3. Vérifiez **Boîte de réception** et **Spams** — expéditeur **MILOU** / votre Gmail MILOU.

---

## Ce que le site envoie maintenant

- **Code à 6 chiffres** (inscription / vérification)
- **Lien de confirmation** (généré par Firebase, envoyé par votre Gmail)
- **Nouvelles annonces**, **litiges**, etc. — tous passent par `sendEmail` → SMTP en priorité

---

## Domaine propre plus tard (optionnel)

Pour `contact@milou.fr` au lieu de Gmail : vérifiez un domaine sur [resend.com/domains](https://resend.com/domains) et mettez `MILOU_EMAIL_FROM=MILOU <contact@votredomaine.fr>`.
