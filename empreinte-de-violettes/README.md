# Maison Empreinte de Violettes — boutique en ligne

Site e-commerce de **Empreinte de Violettes**, artisane fleuriste à Six-Fours-les-Plages (830 av. Maréchal de Lattre de Tassigny, 04 94 32 87 32).

- **Direction artistique « herbier »** : la boutique se lit comme un vieil herbier ou un cabinet de curiosités. Papier crème teinté de violet, encre prune, l'étiquette noire de la carte de visite (lettres crème nacré, aucun or) ; typographies Fraunces (titres) et Newsreader (texte) ; numéros de planches en chiffres romains, titres courants, points de conduite, photos maintenues par des bandelettes, étiquettes d'herbier ; 23 gravures botaniques anciennes du domaine public rendues comme de l'encre, disséminées sur tout le papier des pages (elles s'encrent, se balancent et glissent en parallaxe).
- **Film d'ouverture plein écran (≈ 5 s)** : six gravures s'encrent autour d'une grande violette qui s'efface, l'encre des gravures (fougère, violette) monte sur le papier, l'étiquette noire se déplie depuis un filet, « Maison » s'espace, le nom s'imprime lettre à lettre puis prend la lumière ; l'en-tête apparaît ensuite. Version courte au cours d'une même visite, bouton « Passer », désactivable dans l'admin, réduite si l'appareil demande moins d'animations.
- Animations volontairement sobres : encre qui monte au défilement, titres révélés mot à mot, parallaxe douce de la couverture, survol des planches où le bouquet redevient gravure, lettres d'avis qui se succèdent, panier en forme de bon de commande, transitions de page discrètes. Pas de curseur personnalisé, de particules ni de bandeau défilant.
- **E-commerce complet** : catalogue, filtres, fiches produit (tailles, options), atelier « composez votre bouquet » où la planche se compose gravure après gravure, panier, livraison / retrait / Drive avec zones et créneaux, carte message, codes promo, **paiement Stripe**, e-mails, suivi de commande.
- **Panneau d'administration** (`/admin`) : tableau de bord, commandes (statuts, e-mail client, remboursement Stripe, impression bon + carte), planning de livraison avec tournée Google Maps, clients, produits, catégories, occasions, options, atelier, zones & créneaux, promos, textes de toutes les pages, avis, FAQ, galerie, messages, newsletter, horaires, fermetures, annonce, maintenance, sauvegarde/restauration.

Stack : Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion · Lenis · Stripe · Upstash Redis · Resend · Vercel Blob.

---

## 1. Lancer en local

```bash
cd empreinte-de-violettes
npm install
npm run dev        # http://localhost:3000
```

Sans aucune configuration, le site fonctionne en **mode démo** :
- les données sont enregistrées dans `.data/` (fichiers JSON) ;
- le paiement est simulé (bandeau « Mode démonstration » au moment de commander) ;
- les e-mails sont seulement affichés dans la console ;
- admin : `http://localhost:3000/admin`, mot de passe **`violettes`**.

Dans *Admin → Paramètres*, le bouton « Générer des commandes de démo » remplit le tableau de bord pour une présentation (supprimables en un clic).

## 2. Mettre en ligne sur Vercel

1. Importer le dépôt sur Vercel et définir **Root Directory = `empreinte-de-violettes`**.
2. **Base de données (obligatoire en production)** : Vercel → *Storage* → *Upstash (Redis)* → Connect au projet. Les variables `KV_REST_API_URL` / `KV_REST_API_TOKEN` sont ajoutées automatiquement.
   > Sans base, Vercel utilise une mémoire temporaire : les modifications de l'admin et les commandes peuvent disparaître. L'admin affiche un avertissement tant que ce n'est pas fait.
3. Variables d'environnement (voir `.env.example`) : `ADMIN_PASSWORD`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`.
4. Redéployer.

## 3. Activer le paiement Stripe

1. Créer le compte Stripe de la boutique (dashboard.stripe.com) et récupérer la **clé secrète** → `STRIPE_SECRET_KEY` (`sk_test_…` pour tester, `sk_live_…` en réel).
2. *Développeurs → Webhooks → Ajouter un endpoint* : `https://VOTRE-DOMAINE/api/stripe/webhook`, événements :
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `charge.refunded`.
   Copier le secret `whsec_…` → `STRIPE_WEBHOOK_SECRET`.
3. Dans Stripe → *Paramètres → Moyens de paiement* : activer Carte, Apple Pay, Google Pay, Link.

Fonctionnement : le serveur **recalcule toujours les prix** (le navigateur n'est jamais cru), crée la commande, puis redirige vers Stripe Checkout. Le webhook confirme le paiement (stock décrémenté, e-mails envoyés). Si le webhook tarde, la page de confirmation vérifie elle-même la session Stripe. Le remboursement se fait depuis la fiche commande de l'admin.

Test : carte `4242 4242 4242 4242`, date future, CVC quelconque.

## 4. E-mails (Resend)

Créer un compte sur resend.com, vérifier le domaine, puis renseigner `RESEND_API_KEY` et `EMAIL_FROM`. E-mails envoyés : confirmation client, alerte nouvelle commande à la boutique, changement de statut (prête, en livraison, livrée, annulée, remboursée), nouveaux messages / demandes de devis. L'adresse qui reçoit les alertes se règle dans *Admin → Paramètres*.

## 5. Photos

Les photos actuelles sont des images libres de droits (Unsplash) **en attendant les vraies photos des créations**. Depuis l'admin, chaque produit, catégorie, page et la galerie acceptent un téléversement (compression automatique). Pour héberger les photos proprement, ajouter Vercel Blob (*Storage → Blob*) → `BLOB_READ_WRITE_TOKEN`.

### Gravures

Les gravures de `public/planches/` proviennent de la [Wellcome Collection](https://wellcomecollection.org) (Public Domain Mark) : eaux-fortes de Nicolas Robert (vers 1660), planches d'après Aubriet, Ehret, Sowerby, impression nature d'Alois Auer… Titres et liens sources dans `public/planches/credits.json`. Elles ont été détourées en encre (fond transparent) pour être recolorées en CSS. Chaque produit, catégorie et fleur de l'atelier reçoit automatiquement une gravure d'après son nom ; l'admin peut la changer (champ « Gravure de l'herbier »).

## 6. À valider avec la fleuriste avant la mise en ligne

Informations reprises de sources publiques (site officiel, Google, Sessile, Mariages.net) ou **posées par défaut** — tout est modifiable dans l'admin :

| Élément | Statut |
|---|---|
| Adresse, téléphone, SIRET, horaires (mar.–sam. 9 h–12 h 30 / 15 h–19 h 30, dim. 9 h–12 h 30) | sources publiques, à confirmer |
| Note Google 4,8 / 193 avis | capture Google fournie |
| Noms des bouquets (« constellations ») et prix « à partir de » | repris de la boutique Sessile |
| Descriptions des produits, textes des pages | rédigés, à relire |
| E-mail `contact@empreintedeviolettes.fr` | **hypothèse**, aucune adresse publique trouvée |
| Zones et frais de livraison (8 € / 12 € / 18 €), minimums, seuils de gratuité | **valeurs par défaut** |
| Créneaux, délai de préparation, heure limite 14 h | **valeurs par défaut** |
| Plantes, fleurs séchées, options (vase, bougie, chocolats), prix de l'atelier | **valeurs par défaut** |
| Avis affichés | extraits d'avis publics Mariages.net |
| Mentions légales, CGV, confidentialité | modèles à faire valider |

## 7. Structure

```
src/
  app/(site)/        pages publiques (accueil, boutique, produit, atelier, commande, mariage, deuil…)
  app/admin/         espace fleuriste (protégé par mot de passe)
  app/api/           commande, webhook Stripe, contact, créneaux, admin (CRUD, upload, sauvegarde)
  components/herbier/ charte « herbier » : en-tête, sommaire, panier, gravures, étiquette, planches, accueil
  components/shop/   catalogue, fiche produit, atelier, commande, suivi
  components/admin/  espace fleuriste
  lib/               données (Redis / fichiers / mémoire), prix, livraison, Stripe, e-mails, validation
public/planches/    gravures botaniques (WebP en alpha) + crédits
scripts/generate-patterns.mjs   génère le motif fougère utilisé par l'admin (public/patterns)
```

Commandes utiles : `npm run build` (vérifie tout le projet), `npm run typecheck`, `npm run patterns`.
