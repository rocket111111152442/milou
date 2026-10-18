# Le Pétrin de Pépiole — site vitrine & commande en ligne

Site de la boulangerie **Le Pétrin de Pépiole**, 1191 Route de la Gare, 83110 Sanary-sur-Mer.

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Motion (animations) · Lenis (défilement fluide) · Zustand (panier) · Zod · Resend.

## Lancer en local

```bash
cd boulangerie-pepiole
npm install
npm run dev        # http://localhost:3000
npm run build      # build de production
```

## Pages

| Route | Contenu |
|---|---|
| `/` | Accueil : hero animé, histoire, savoir-faire (défilement horizontal), rayons, formules, gâteaux sur commande, galerie, infos pratiques + carte |
| `/carte` | Carte complète avec filtres par rayon, recherche, ajout au panier |
| `/commande` | Tunnel de commande : panier → créneau de retrait → coordonnées → confirmation (+ ajout à l'agenda) |
| `/mentions-legales` | Mentions légales, RGPD, cookies |
| `/api/commande` | Réception et validation des commandes (prix et créneaux recalculés côté serveur) |

## Où modifier quoi

| Quoi | Fichier |
|---|---|
| Adresse, téléphone, Instagram, infos légales | `src/lib/site.ts` |
| Horaires, jours de fermeture, délais de commande | `src/lib/hours.ts` |
| Produits, prix, photos, rayons | `src/lib/catalog.ts` |
| Photos | `public/images/` |

## Commandes en ligne

Sans configuration, le site est en **mode démonstration** : le parcours fonctionne mais une bannière indique
que la commande n'est pas transmise à la boutique. Pour activer la réception, définir dans Vercel
(*Project → Settings → Environment Variables*) l'une des deux options :

1. **E-mail (Resend)** : `RESEND_API_KEY`, `ORDER_EMAIL_TO` (adresse de la boutique),
   `ORDER_EMAIL_FROM` (expéditeur sur un domaine vérifié dans Resend).
   La boutique reçoit chaque commande par e-mail, le client reçoit une confirmation s'il a donné son e-mail.
2. **Webhook** : `ORDER_WEBHOOK_URL` — la commande est envoyée en JSON (Make, Zapier, n8n, Google Sheets,
   Discord…).

Voir `.env.example`. Le paiement se fait en boutique au retrait (pas de paiement en ligne pour l'instant).

## À faire avant une mise en ligne « officielle »

- **Prix** : tous les prix de `catalog.ts` sont indicatifs. À remplacer par les tarifs réels.
- **Produits** : la liste est construite à partir des familles de produits publiées (Office de tourisme,
  MyBoulange). À ajuster avec la boutique (spécialités, produits de saison, allergènes).
- **Photos** : photos d'illustration Unsplash (licence gratuite, usage commercial autorisé). Les vraies
  photos des produits de la boutique seront nettement plus convaincantes. La photo de façade provient d'une
  capture Google Maps en basse définition.
- **Horaires** : 6h30–19h30 du lundi au samedi, 7h–13h15 le dimanche (Google / MyBoulange). L'Office de
  tourisme indique une fermeture à 19h15 en semaine : à confirmer.
- **Mentions légales** : informations issues du registre SIRENE (AS BOULANGERIE, SIREN 802 932 665).
  Capital social et directeur de la publication à faire valider par la boutique.
