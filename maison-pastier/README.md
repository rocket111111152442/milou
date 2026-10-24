# Maison Pastier — site vitrine

Site statique (HTML/CSS/JS, sans étape de build) de **Maison Pastier**, fabrique artisanale de pâtes fraîches au 54 rue République, 83140 Six-Fours-les-Plages.

Charte : bleu canard, blanc, bois. Typographies Google Fonts : Fraunces, DM Sans, Oswald.

## Pages

| Fichier | Contenu |
|---|---|
| `index.html` | Intro animée du logo, héros, la Maison, univers produits, « Le métier » en défilement horizontal, carte des raviolis, tarifs des box, sauces, cave, avis, Instagram, accès |
| `savoir-faire.html` | Le métier étape par étape, lexique des formes, minuteur de cuisson interactif, conseils, FAQ |
| `produits.html` | Pâtes, raviolis, gnocchis, sauces, épicerie fine, cave à vins et accords |
| `repas.html` | Box du midi, tarifs (seule / menu), composeur de commande envoyée par SMS |
| `contact.html` | Téléphone, adresse, horaires en direct, message par SMS, plan |
| `mentions-legales.html` | Mentions légales (à compléter) et crédits photos |
| `404.html` | Page d’erreur |

## Animations

GSAP 3.12.5 + ScrollTrigger + Lenis 1.1.13, copiés dans `assets/vendor/` (aucune dépendance à un CDN pour les scripts).
Tout est désactivé si le visiteur a activé « réduire les animations » ; le contenu reste lisible sans JavaScript.

## Modifier le site

Les pages HTML sont générées par `_build/` (en-tête, menu, pied de page et horaires définis une seule fois) :

```sh
sh _build/build_all.sh
```

- Textes d’une page : `_build/page_*.py`
- En-tête, pied de page, téléphone, horaires affichés : `_build/common.py`
- Blocs partagés (tarifs, sauces, accès) : `_build/blocks.py`
- Horaires utilisés par l’indicateur « Ouvert / Fermé » : constante `HOURS` dans `assets/js/main.js`

Modifier directement un `.html` fonctionne aussi, mais la modification sera écrasée au prochain `build_all.sh`.

## Déploiement

Hébergement statique (Vercel) avec `maison-pastier` comme dossier racine, sans commande de build. `.vercelignore` exclut `_build/`.

## À compléter / vérifier par la boutique

- `mentions-legales.html` : raison sociale, SIRET, directeur de la publication.
- La note Google (5,0 – 31 avis) est écrite en dur : à mettre à jour de temps en temps.
- Seuls les tarifs des box figurent sur l’ancien site ; les prix des autres produits sont indiqués « en boutique ».
- Les idées d’accords mets-vins et les temps de cuisson sont des suggestions génériques à valider.
- Une vraie photo de la devanture améliorerait la section « Rendez-vous à la boutique ».

## Crédits

Photos de la boutique et des produits : Maison Pastier (site maison-pastier.fr). Photos d’illustration du métier : Unsplash (détail dans `mentions-legales.html`). Logo vectorisé à partir du logo original.
