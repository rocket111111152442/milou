# Monceau Fleurs — La Seyne-sur-Mer (maquette)

Site vitrine + boutique de démonstration, 100 % statique (HTML/CSS/JS, GSAP, Lenis). Aucun build nécessaire.

## Modifier le contenu

Tout se règle dans `assets/js/data.js` :

- `config.phone` / `config.email` : à compléter (les boutons d'appel s'affichent automatiquement).
- `config.hours` : horaires (repris de la fiche magasin monceaufleurs.com, à confirmer).
- `products` : catalogue (prix **indicatifs**), images Unsplash référencées par leur identifiant.
- `flowers` / `wraps` : fleurs et emballages du compositeur de bouquet.
- `zones` : codes postaux et frais de livraison (**exemples à valider**).

## À savoir

- Le formulaire de contact est encore **simulé**.
- Sans clé Stripe, le paiement reste en **mode démo** (le panier fonctionne, rien n'est débité).
- `noindex` (meta + en-tête HTTP + robots.txt) : le site n'est pas indexé tant qu'il reste une maquette.
- Les avis affichés se limitent à la note et au nombre d'avis Google réels (4,5/5, 749 avis) ; aucun témoignage inventé.

## Paiement & livraison (Stripe Checkout)

Fonctions serveur Vercel dans `api/` (aucune dépendance npm) :

| Route | Rôle |
|---|---|
| `POST /api/checkout` | Recalcule les prix depuis `data.js`, valide date / créneau / code postal, crée la session Stripe Checkout |
| `GET /api/session` | Résumé affiché au client après paiement |
| `POST /api/webhook` | Vérifie la signature Stripe et envoie la commande par e-mail à la boutique (Resend) |

Moyens de paiement : ceux activés dans le tableau de bord Stripe (carte, **Link**, Apple Pay, Google Pay…), aucun code à changer.

### Mise en service

1. Créer le compte Stripe **au nom de la boutique** (Paramètres → Moyens de paiement : vérifier que Link est actif).
2. Vercel → projet → Settings → Environment Variables :
   - `STRIPE_SECRET_KEY` : `sk_test_…` pour tester, puis `sk_live_…`
   - `STRIPE_WEBHOOK_SECRET` : `whsec_…` (étape 3)
   - `SHOP_EMAIL` : adresse(s) qui reçoivent les commandes (séparées par des virgules)
   - `RESEND_API_KEY` et `RESEND_FROM` (ex. `Commandes <commandes@domaine-verifie.fr>`) — sans domaine vérifié, Resend n'envoie qu'à l'adresse du compte Resend
   - `SITE_URL` (optionnel) : URL publique, sinon déduite de la requête
3. Stripe → Développeurs → Webhooks → ajouter `https://VOTRE-SITE/api/webhook`, événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`, copier le secret `whsec_…`.
4. Redéployer, puis tester avec la carte `4242 4242 4242 4242`.
5. Activer les reçus clients : Stripe → Paramètres → E-mails clients → « Paiements réussis ».

Les commandes sont aussi visibles dans Stripe → Paiements (détail : mode, date, créneau, articles, messages des cartes).


## Tester en local

```bash
cd monceau-fleurs && python3 -m http.server 8000
```
