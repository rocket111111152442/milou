# BLOOMED — site vitrine

Site one-page du salon **BLOOMED**, barbier & coiffeur au 98 rue République, 83140 Six-Fours-les-Plages.
Thème « la tête dans les nuages » : rose clair, vert menthe, blanc, nuages animés partout.

Site 100 % statique (HTML + CSS + JS, aucune dépendance, aucun build).

## Voir le site en local

```bash
cd bloomed
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

(Ouvrir `index.html` directement fonctionne aussi, sauf la carte Google qui préfère un vrai serveur.)

## Structure

```
bloomed/
├── index.html            # toute la page (contenu + sprite SVG du logo et des nuages)
├── assets/css/style.css  # couleurs, typo, nuages, animations, responsive
├── assets/js/main.js     # parallaxe, apparitions, curseur nuage, menu, galerie, avis, ouvert/fermé
└── assets/img/
    ├── logo.svg          # logo vectoriel (BL + fleur bleue + fleur rose + MED)
    ├── favicon.svg
    ├── og-image.jpg      # image de partage réseaux sociaux
    └── *.webp            # photos du salon
```

## Polices (Google Fonts)

- **Rubik Bubbles** : titres « nuage » (contours en bulles)
- **Fredoka** : textes et boutons (arrondie)
- **Playfair Display Black** : lettres du logo

## Ce qu'on modifie le plus souvent

| Quoi | Où |
|------|----|
| Prix / prestations | `index.html`, section `id="prestations"` |
| Horaires | `index.html` (tableau `.hours`) **et** `assets/js/main.js` (constante `HOURS`, pour le badge ouvert/fermé) |
| Avis + nombre d'avis | `index.html`, section `id="avis"` (chiffres relevés en octobre 2026) |
| Photos | déposer dans `assets/img/` (WebP ~1600 px de large) puis changer les `src` dans la section `id="feed"` |
| Couleurs | variables `--pink-*` / `--mint-*` en haut de `style.css` |

Le bouton « Réserver » pointe vers la page Planity du salon.

## Mettre en ligne

N'importe quel hébergement statique gratuit convient : Netlify (glisser-déposer le dossier), Vercel, GitHub Pages, Cloudflare Pages.

## À faire avant la mise en ligne

- **Mentions légales** : obligatoires pour un site professionnel en France (nom, SIRET, hébergeur…). Non incluses.
- **Nom de domaine** : ajouter la balise `canonical` et passer `og:image` en URL absolue (voir commentaire dans le `<head>`).
- **Photos** : les 5 photos proviennent des fiches Planity / Google du salon. Le compte Instagram @madeinbloomed n'était pas accessible sans connexion, donc aucune photo Instagram n'est incluse : en ajouter dans `assets/img/` pour enrichir la galerie. Faire valider l'usage des photos par le salon.
- **Boissons** : la carte des boissons (Iced Matcha Latte, Iced Latte) n'est plus listée sur Planity ; vérifier avec le salon qu'elles sont toujours proposées.
- **Galerie Instagram en direct** (optionnel) : nécessite un widget tiers (Behold, LightWidget…) ou l'API Instagram avec le compte du salon.
