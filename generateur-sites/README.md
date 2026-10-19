# Générateur de sites pour boulangeries et pâtisseries

Une application unique qui produit, à partir d'un formulaire, un **site complet** pour un commerce :
accueil animé, carte, commande en ligne avec créneaux de retrait, mentions légales, et un **espace boutiques**
(`/admin`) où le commerçant gère lui-même ses commandes, ses prix, ses produits et ses fermetures.

Issu du site « Le Pétrin de Pépiole » (projet séparé, non modifié). Next.js 16 · React 19 · Tailwind 4 · Motion.

## Fonctionnement

- **Studio** : `/studio` (mot de passe `ADMIN_PASSWORD`). On saisit nom, type (boulangerie / boulangerie-pâtisserie /
  pâtisserie), boutiques (adresse, téléphone, horaires, services, photo, mentions légales), couleurs, carte
  (bibliothèque de 39 produits à cocher, prix modifiables), e-mail de réception des commandes, et on clique sur
  **Générer le site**.
- Le site est en ligne tout de suite à l'adresse **`/s/<adresse>`**, en démonstration (commandes de test marquées
  « Test »). Le Studio affiche l'adresse du site, celle de son espace boutiques, le mot de passe de cet espace
  (affiché une seule fois) et un message prêt à envoyer au commerçant.
- Chaque site est isolé : son catalogue, ses réglages, ses commandes, ses photos, son mot de passe, son panier.
- Tous les textes (accroche, histoire, chiffres, bandeaux, mentions légales) sont **générés** à partir des informations
  saisies ; les champs libres du formulaire permettent de les personnaliser.
- Les sites générés ne sont **jamais indexés** par Google (`noindex`) : ce sont des démonstrations.

## Ce que le commerçant peut faire dans son espace (`/s/<adresse>/admin`)

Voir et traiter les commandes (nouvelle → prête → retirée / annulée, suppression définitive, liste « À préparer »,
alerte sonore et notifications push), modifier les prix, retirer ou rendre indisponible un produit, **ajouter,
modifier et supprimer des produits** (avec photo), créer des **formules à choix** (boisson, viennoiserie…),
fermetures exceptionnelles, passage en service réel, remise à zéro.

## Stockage

Vercel Blob (privé), tout sous un dossier par site : `t/<adresse>/site.json`, `reglages.json`, `commandes/`,
`push/`, `photos/`. Photos du Studio : `gphotos/`. Sans `BLOB_READ_WRITE_TOKEN`, en développement, tout est écrit
dans `.data/` (ou `LOCAL_DATA=1` pour forcer ce mode en production locale).

## Variables d'environnement

Voir `.env.example`. Indispensables : `ADMIN_PASSWORD` (Studio) et `BLOB_READ_WRITE_TOKEN` (Blob store relié au
projet). Facultatives : clés VAPID (notifications push), `RESEND_API_KEY` + `ORDER_EMAIL_FROM` (commandes par e-mail).

## Lancer en local

```bash
cd generateur-sites
npm install
ADMIN_PASSWORD=motdepasse npm run dev   # http://localhost:3000/studio
```

## Limites à connaître

- Photos d'illustration Unsplash et prix indicatifs : à remplacer par ceux du commerçant.
- Les sites vivent sur `/s/<adresse>` ; pour un domaine propre (ex. boulangerie-dupont.fr), il faut ajouter le domaine
  au projet Vercel et une règle de réécriture vers `/s/<adresse>` (non automatisé).
- Paiement en boutique au retrait uniquement.
- Les mentions légales sont générées à partir des informations saisies : à faire valider par le commerçant.
