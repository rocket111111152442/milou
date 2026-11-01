# Procédure — nouveaux prix Stripe (9,99 / 19,99 / 29,99 / 49,99 €) sans toucher aux abonnements existants

**À exécuter par LULLIN WEB** (Stripe n'est pas accessible depuis l'environnement de développement). Rien de ce document n'a été exécuté.
Faire d'abord TOUTE la procédure en **mode test** (Preview), puis seulement en **live**, sur autorisation explicite.

## 0. Comment l'application utilise les prix (vérifié dans le code)

* À chaque paiement et changement de formule, `resolvePlanPriceId` cherche le prix par **clé de recherche** (`lookup_key`), vérifie : actif, EUR,
  mensuel (1 mois), à l'unité, TTC (`tax_behavior=inclusive`), montant = catalogue. Sinon : paiement refusé. L'identifiant trouvé est mémorisé
  dans `plans.stripe_price_id`.
* Un **abonnement existant** pointe vers l'**identifiant** de l'ancien prix (pas vers la clé). Stripe n'y touche pas : il continue à être facturé
  à l'ancien montant tant qu'on ne le migre pas explicitement (hors périmètre ici : aucune migration d'abonné n'est faite).
* **Piège corrigé** : une fois la clé transférée, `plans.stripe_price_id` désigne le nouveau prix ; un webhook d'un abonné resté sur l'ancien prix
  n'était plus relié à son élément d'abonnement et **effaçait ses dates de période**. Corrigé dans `packages/billing/src/webhooks.ts`
  (la formule vient de la métadonnée `plan_id`, la période de l'élément de formule est conservée) et couvert par le test
  « rotation des prix Stripe… » (vu échouer avant le correctif, réussir après). **Ce correctif doit être déployé AVANT de transférer les clés en live.**

## 1. Préparation (lecture seule)
1. Lister l'existant (clé restreinte en lecture) :
   ```bash
   STRIPE_SECRET_KEY='<clé en lecture>' pnpm stripe:prices
   ```
   Noter, pour chaque formule, l'**identifiant `price_…` actuel** (ancien prix) et son montant. Les conserver dans un fichier hors dépôt.
2. Compter les abonnements par formule dans Stripe (Tableau de bord → Abonnements) : référence pour le contrôle final.

## 2. Création des nouveaux prix (écriture : mode test d'abord)
Pour **Plus, Pro, Business** (Max ne change pas : ne rien créer, ne rien toucher).
Tableau de bord → Catalogue de produits → le produit de la formule → **Ajouter un prix** :
* Tarification forfaitaire, **récurrent**, **mensuel**, devise **EUR**, montant **9,99 / 19,99 / 49,99**, **« Taxe incluse »** (tax_behavior inclusive).
* **Clé de recherche** : la même que l'ancien prix (`waverti_plus_monthly`, `waverti_pro_monthly`, `waverti_business_monthly`).
  Stripe propose alors **« Transférer la clé de recherche »** depuis l'ancien prix : accepter.

Équivalent API (écriture ; remplacer `<ancien>`, `<produit>`) :
```bash
curl https://api.stripe.com/v1/prices -u "$STRIPE_SECRET_KEY:" \
  -d product=<produit> -d currency=eur -d unit_amount=999 \
  -d "recurring[interval]=month" -d "recurring[interval_count]=1" \
  -d tax_behavior=inclusive -d lookup_key=waverti_plus_monthly -d transfer_lookup_key=true
```
(`unit_amount` : 999, 1999 ou 4999.) Ne **jamais** supprimer ni modifier un ancien prix : Stripe ne le permet pas pour le montant, et supprimer casserait les abonnements.

## 3. Vérification avant toute ouverture
```bash
STRIPE_SECRET_KEY='<clé en lecture>' pnpm stripe:prices
```
Attendu : **4 prix « conformes »** (Plus 999, Pro 1999, Max 2999, Business 4999), aucune « ancienne option encore active ».
Contrôler à la main : les anciens prix n'ont plus de clé de recherche ; le nombre d'abonnements par formule est **identique** à l'étape 1.2.

## 4. Archivage des anciens prix (facultatif, après vérification)
Archiver (désactiver) l'ancien prix : interdit pour les **nouvelles** souscriptions, **sans effet** sur les abonnements en cours (ils continuent de se renouveler à
l'ancien montant). Ne pas supprimer.

## 5. Ce que voit un abonné existant
* Son prix, sa date de renouvellement et ses droits : **inchangés**. Les pages publiques affichent les nouveaux prix ; la page Abonnement affiche la
  formule (le montant affiché pour un abonné existant vient du catalogue : à décider si on veut afficher l'ancien montant ; non traité ici).
* Un changement de formule dans Waverti l'amène sur le **nouveau** prix de la formule choisie (proratisé par Stripe).

## 6. Retour arrière
| Situation | Action |
| --- | --- |
| Erreur de montant sur un nouveau prix | Créer le bon prix avec `transfer_lookup_key=true`, archiver le mauvais. |
| Revenir à l'ancien prix | Transférer la clé de recherche **à l'ancien prix** : Tarification → ancien prix → modifier la clé (ou `POST /v1/prices/<ancien> -d lookup_key=… -d transfer_lookup_key=true`). Remettre la base : script `db/rollbacks/20261102010000_update_plan_prices.down.sql`. |
| Un abonné semble avoir perdu sa date de renouvellement | Ne rien corriger à la main : redéclencher l'événement dans Stripe (Développeurs → Webhooks → renvoyer `customer.subscription.updated`) après déploiement du correctif. |

## 7. Garde-fous
Aucune étape n'exécute de paiement. Ne pas ouvrir les paiements (variables Stripe de Production, drapeau `WAVERTI_ALLOW_LIVE_PAYMENTS`) tant que l'étape 3 n'est pas verte.
