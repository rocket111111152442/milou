# Notifications par Gmail (gratuit, sans domaine)

À chaque **nouvelle annonce** sur le marketplace, tous les utilisateurs reçoivent :

1. Une **notification in-app** (cloche sur le site)
2. Un **e-mail** envoyé depuis ton Gmail

## Configuration Gmail (une fois)

1. Compte Google → **Sécurité** → active la **validation en 2 étapes**
2. **Mots de passe des applications** → Créer → nom « MILOU »
3. Copie le code à **16 caractères** (sans espaces)

## Fichier local `frontend/.env.local`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=lullinismael2@gmail.com
SMTP_PASS=ton_mot_de_passe_application_16_caracteres
EMAIL_FROM=MILOU <lullinismael2@gmail.com>
```

## Vercel (site en ligne)

Même 5 variables sur **milou** → Settings → Environment Variables → Production + Preview.

Ou : `cd frontend` puis `npm run env:vercel` → importe `vercel-import.env`.

Puis **Deployments** → **Redeploy**.

## Limites Gmail

- Environ **500 e-mails par jour** (suffisant pour démarrer)
- Les premiers mails peuvent aller dans **Spams**
- Expéditeur visible : ton adresse Gmail

## Sécurité

Ne partage jamais `SMTP_PASS` dans un chat public. Si exposé, supprime le mot de passe d’application sur Google et recrée-en un.
