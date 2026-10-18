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

- Paiement, envoi du formulaire et commandes sont **simulés** (maquette).
- `noindex` (meta + en-tête HTTP + robots.txt) : le site n'est pas indexé tant qu'il reste une maquette.
- Les avis affichés se limitent à la note et au nombre d'avis Google réels (4,5/5, 749 avis) ; aucun témoignage inventé.

## Tester en local

```bash
cd monceau-fleurs && python3 -m http.server 8000
```
