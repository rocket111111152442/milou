# Le Pétrin de Pépiole — site vitrine & commande en ligne

Site de la maison **Le Pétrin de Pépiole**, deux boutiques :

| Boutique | Adresse | Société |
|---|---|---|
| Le Pétrin de Pépiole | 1191 Route de la Gare, 83110 Sanary-sur-Mer · 04 94 32 57 47 | AS BOULANGERIE (SIREN 802 932 665) |
| Maison Sernesi | 230 Route des Sablettes, 83140 Six-Fours-les-Plages · 04 94 74 74 38 | MCS BOULANGERIE (SIREN 878 642 776) |

Mêmes dirigeants pour les deux sociétés (registre SIRENE / BODACC). La fiche Google de Maison Sernesi
s'appelait auparavant « Le Pétrin de Pépiole – Six fours ».

La boulangerie « Boulangerie Pépiole » (2483 av. Président John Kennedy, Six-Fours), berceau historique du nom,
est exploitée par une autre société (PEPIOLE SIX-FOURS, autre branche de la famille) : elle n'est volontairement
**pas** présentée sur ce site. À n'ajouter qu'avec l'accord des deux parties.

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
| Boutiques : adresse, téléphone, horaires, fermetures, société | `src/lib/shops.ts` |
| Nom, description, Instagram, directeur de publication | `src/lib/site.ts` |
| Délais de commande, pas des créneaux | `src/lib/hours.ts` |
| Produits, prix, photos, rayons | `src/lib/catalog.ts` |
| Photos | `public/images/` |

## Commandes en ligne

Sans configuration, le site est en **mode démonstration** : le parcours fonctionne mais une bannière indique
que la commande n'est pas transmise à la boutique. Pour activer la réception, définir dans Vercel
(*Project → Settings → Environment Variables*) l'une des deux options :

1. **E-mail (Resend)** : `RESEND_API_KEY`, `ORDER_EMAIL_FROM` (expéditeur sur un domaine vérifié dans Resend),
   et l'adresse qui reçoit les commandes : `ORDER_EMAIL_TO_SANARY` et `ORDER_EMAIL_TO_SIX_FOURS`
   (une adresse par boutique), ou `ORDER_EMAIL_TO` pour tout recevoir au même endroit.
   La boutique reçoit chaque commande par e-mail, le client reçoit une confirmation s'il a donné son e-mail.
2. **Webhook** : `ORDER_WEBHOOK_URL` — la commande est envoyée en JSON (Make, Zapier, n8n, Google Sheets,
   Discord…).

Voir `.env.example`. Le paiement se fait en boutique au retrait (pas de paiement en ligne pour l'instant).

## Espace boutiques : `/admin`

Protégé par le mot de passe `ADMIN_PASSWORD` (cookie de session 30 jours, 5 essais / 15 min), non indexé.
Installable comme une application (« Ajouter à l'écran d'accueil » → icône « Commandes »).

| Onglet | Rôle |
|---|---|
| **Commandes** | commandes par jour de retrait, filtres boutique / jour / statut, statuts nouvelle → prête → retirée (ou annulée), affichage par défaut « À venir » (aujourd’hui et jours suivants) avec alerte si une nouvelle commande est masquée par les filtres, suppression définitive d'une commande (🗑), liste « À préparer » cumulée par produit, impression, actualisation chaque minute avec carillon et compteur dans l'onglet |
| **Carte & prix** | ajouter un produit (photo, rayon, prix, format, description, délai de commande, choix du client pour les formules), le modifier ou le supprimer ; modifier aussi les produits d'origine (nom, photo, description, choix) avec « Rétablir » ; modifier les prix ; retirer un produit de la vente (« Momentanément indisponible ») ou de la carte |
| **Réglages** | notifications push sur chaque appareil, interrupteur « Commande en ligne » par boutique (test / réel), fermetures exceptionnelles, remise à zéro complète (taper « EFFACER ») |

Stockage : base **Postgres (Supabase)**, tables préfixées `petrin_` (la base est partagée avec d'autres projets) :
`petrin_orders` (commandes), `petrin_settings` (réglages), `petrin_push_devices` (appareils notifiés),
`petrin_photos` (photos des produits ajoutés). Le schéma est dans `supabase/schema.sql` ; il est idempotent et
appliqué à chaque build par `scripts/migrate.mjs`. L'accès se fait uniquement côté serveur (`src/lib/db.ts`, module
`server-only`) avec `POSTGRES_URL` ; aucune clé de base n'est exposée au navigateur. RLS activée sans politique :
l'API publique de Supabase n'a aucun accès à ces tables.

Variables : `POSTGRES_URL` (exécution) et `POSTGRES_URL_NON_POOLING` (migration), fournies par l'intégration Supabase,
`ADMIN_PASSWORD` (le compte admin vient de cette variable : il n'y a rien à recréer en base),
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. Optionnel : `ORDERS_LIVE=1` force le mode réel partout.
Sans `POSTGRES_URL`, le site s'affiche avec les réglages par défaut mais les commandes ne sont pas enregistrées.

Notifications : Android / ordinateur (Chrome, Edge, Firefox) directement ; iPhone / iPad (iOS 16.4+) après
« Sur l'écran d'accueil » depuis Safari.

## À faire avant une mise en ligne « officielle »

- **Prix** : les prix par défaut de `catalog.ts` sont indicatifs. La boutique les corrige dans `/admin/carte`.
- **Produits** : la liste est construite à partir des familles de produits publiées (Office de tourisme,
  MyBoulange). À ajuster avec la boutique (spécialités, produits de saison, allergènes).
- **Photos** : photos d'illustration Unsplash (licence gratuite, usage commercial autorisé). Les vraies
  photos des produits de la boutique seront nettement plus convaincantes. La photo de façade provient d'une
  capture Google Maps en basse définition.
- **Horaires** : Sanary 6h30–19h30 du lundi au samedi, 7h–13h15 le dimanche (Google / MyBoulange ; l'Office de
  tourisme indique 19h15 en semaine). Six-Fours 6h30–20h du lundi au samedi, 7h–20h le dimanche (données Google
  reprises par 3 annuaires). À confirmer avec la boutique, ainsi que les fermetures annuelles.
- **Mentions légales** : informations issues du registre SIRENE pour les deux sociétés. Le n° de TVA de
  MCS BOULANGERIE est calculé à partir du SIREN. À faire valider par la boutique.
