# Lullin Web — film publicitaire vertical 2026

Film de 27,17 s en 1080 × 1920, 60 i/s, produit **entièrement par programme** : composition DOM + CSS 3D + Three.js,
rendue image par image dans Chromium (Playwright), assemblée par FFmpeg. Bande-son originale synthétisée en Python.

## Livrables (`output/`)

| Fichier | Contenu |
|---|---|
| `LullinWeb_Ad_2026_Vertical_1080x1920.mp4` | Version principale : H.264 High 4.2, 60 i/s, Rec.709, AAC 48 kHz 320 kb/s, −14 LUFS, crête vraie ≤ −1 dBTP |
| `LullinWeb_Ad_2026_Vertical_1080x1920_SansAudio.mp4` | Même image, sans piste son |
| `LullinWeb_Ad_2026_Vertical_1080x1920_30fps.mp4` | Version 30 i/s (exposition 1/60 s par image, obturateur 180°) |
| `LullinWeb_Ad_2026_Vertical_1080x1920_ControleZonesSures.mp4` | Calque de contrôle des zones d'interface TikTok / Reels / Shorts — **à ne pas publier** |
| `LullinWeb_Ad_2026_Vertical_1080x1920_Couverture.png` | Image de couverture (signature finale) |

Stems audio dans `assets/audio/` (FLAC sans perte, versionnés ; les WAV sont régénérés par `audio/build_audio.py`) :
`music_stem.flac`, `sfx_stem.flac`, `lullin_ad_mix.flac` (mix avant normalisation).

Seuls le MP4 principal et l'image de couverture sont versionnés ; les autres variantes se régénèrent avec `bash render/deliver.sh`.

## Ressources officielles utilisées

- **Logo** : `assets/logo/lullin-mark.svg`, téléchargé tel quel depuis `https://www.lullin-web.com/images/lullin-mark.svg`.
  Les 5 tracés du fichier sont lus à l'exécution (`BrandLogo.js`), jamais redessinés. En 3D (scène 5), ce sont ces mêmes tracés
  qui sont extrudés ; au verrouillage, l'image 3D est remplacée au pixel près par le SVG officiel (couleurs exactes).
- **Couleurs** (relevées sur le site, prioritaires sur celles du brief) : fond `#111211`, surface `#1a1c19`, crème du logo `#eeece2`,
  texte `#f0f0e8`, lime du logo `#c2f93a`, accent typographique `#d2fd79`.
- **Polices** : Space Grotesk (titres) et DM Sans (textes), fichiers servis par lullin-web.com, licence SIL OFL.
- **Wordmark** : « lullin » + « web » tel que composé sur le site (Space Grotesk 600 / 400).
- **Contenus** : titre « Votre site professionnel, simplement. », bouton « Demander un devis », intitulés des services et vocabulaire SEO
  (« Métadonnées », « Référencement local », « Maillage interne », « Performances techniques ») repris du site.
- `assets/screenshots/` : captures de la page d'accueil (desktop / mobile) ayant servi de référence pour la reconstruction.

## Ce que montre chaque scène (réellement réalisé)

| Temps | Scène | Contenu |
|---|---|---|
| 0,00–1,87 s | 01 Accroche | Maquette filaire déjà tracée à l'image 0, curseur lime géant, clic à 0,40 s (contraction, impulsion géométrique, lignes de construction), « VOTRE SITE » → « PEUT FAIRE MIEUX. » (MIEUX en lime), « MIEUX. » se fragmente en rectangles d'interface qui envahissent l'écran |
| 1,87–4,67 s | 02 Chaos → structure | 19 composants flottent en 3D, travelling latéral rapide, verrouillage un à un sur une grille de 12 colonnes (un son par verrouillage), « DES SITES QUI MARQUENT. » s'écrit de gauche à droite, la carte image grandit jusqu'à remplir l'écran |
| 4,67–8,40 s | 03 Révélation du site | On sort de la carte : c'est le héros de lullin-web.com. Recul + bascule en surface survolée. DESIGN (calques en profondeur, cadres de sélection, grille), PERFORMANCE (barre de chargement éclair, saut de section), VISIBILITÉ (pastilles SEO, repère local). Retour en carte frontale, silence rythmique |
| 8,40–12,60 s | 04 Écosystème | La carte se divise en 4 modules ; la caméra visite SITES WEB (blocs verrouillés), E-COMMERCE (clic, panier, retournement 3D), SEO (saisie, résultats génériques réordonnés, loupe), RÉSEAUX SOCIAUX (cartes en défilement de profondeur). Pivot autour de l'axe central, convergence, flash crème |
| 12,60–16,80 s | 05 Moment signature | Objet crème abstrait (les 5 pièces en éventail), orbite, détachement chorégraphié, la branche lime traverse le cadre, caméra collée à sa surface, recul brutal, réassemblage (lime en dernier), impulsion lime + ondulation + micro-vibration, « LULLIN WEB. » / « Votre présence. Notre expertise. » |
| 16,80–21,00 s | 06 Responsive | Le symbole se pose dans l'en-tête ; la page se construit ; morphing continu desktop → smartphone (composants réorganisés), une version desktop reste à gauche, le mobile à droite défile. « UN SITE À VOTRE IMAGE. » puis « PENSÉ POUR VOS CLIENTS. » |
| 21,00–23,80 s | 07 La décision | Les interfaces s'éloignent, filet lime, lignes qui montent depuis le filet : « VOTRE PROJET MÉRITE MIEUX. » puis « DONNONS-LUI VIE. » (VIE géant en lime). Rythme ralenti |
| 23,80–27,17 s | 08 Signature | Symbole officiel, wordmark, « Création web & solutions digitales », **lullin-web.com** + filet lime + flèche, « SIX-FOURS • TOULON » |

Aucun faux client, faux avis, faux chiffre, numéro de téléphone ou statistique. Les résultats de recherche (scène 4) sont des barres
génériques, le produit e-commerce est un objet stylisé sans marque.

## Choix et écarts assumés par rapport au brief

- **Durée 27,17 s** (tolérance 25–29 s) : la timeline est calée sur une grille musicale de 128,57 BPM où 1 temps = 28 images exactement.
  Les bornes de scènes sont donc décalées de ±0,3 s par rapport au brief.
- **Site en scène 3 et 6** : reconstruction vectorielle fidèle de la vraie page d'accueil plutôt qu'une capture plate, pour rester nette
  en zoom 3D et permettre la décomposition en calques. Textes, polices et couleurs proviennent du site.
- **Scène 6** : le format vertical ne permet pas un desktop et un mobile côte à côte lisibles d'emblée ; le desktop se transforme en
  mobile au centre puis une copie desktop se range à gauche, le mobile à droite.
- **Signature finale** : le wordmark officiel « lullinweb » remplace un « LULLIN WEB » tapé en capitales (le texte « LULLIN WEB. »
  en capitales apparaît en scène 5, comme demandé).
- **Musique** : composée et synthétisée par programme (aucun échantillon externe). Elle n'a pas été écoutée par un humain pendant la
  production : son équilibre a été contrôlé par mesures (spectre, sonie, crêtes, synchronisation). Une écoute critique et, si besoin,
  un remplacement par une musique de librairie licenciée sont recommandés avant diffusion payante.
- **Flou de mouvement** : 4 sous-images moyennées par image (obturateur 360° à 60 i/s). Les textes immobiles restent nets.

## Reproduire le rendu

Prérequis : Node 22, Python 3 (numpy, scipy, Pillow), FFmpeg ≥ 6, Chromium de Playwright.

```bash
npm install
node render/export_cues.mjs                 # repères sonores exportés depuis la composition
python3 audio/build_audio.py                # musique + effets → assets/audio/
node render/render.mjs --workers 4 --sub 4  # images → output/tmp/chunk_*.mkv (reprise possible)
bash render/deliver.sh                      # assemblage + encodages → output/
node render/preview.mjs /tmp/apercu 5.2 b33 # aperçu d'images isolées (secondes ou temps musicaux)
```

Rendu complet : environ 15 min sur 4 cœurs CPU (WebGL en rendu logiciel SwiftShader).

## Structure

```
assets/logo, assets/fonts, assets/audio, assets/screenshots
src/timeline.json            source unique des temps (image et son)
src/engine/                  easing, horloge, utilitaires DOM
src/components/              BrandLogo, TypographySystem, UIComponents, AnimatedGrid, MotionCamera,
                             TransitionController (scènes, repères audio, flash), SiteMock (reconstruction du site)
src/scenes/Scene01…08        une scène par fichier
audio/build_audio.py         synthèse musique + effets
render/                      serveur local, aperçus, rendu parallèle, livraison
output/                      livrables
```

## Visuels Google Business Profile (`output/google-business/`)

Générés par `node render/gbp.mjs` (source : `gbp/gbp.js`), même système graphique que le film. JPEG, sRGB, 175–400 Ko
(Google : JPG/PNG, 10 Ko–5 Mo, 720 × 720 px recommandés).

| Fichier | Où le déposer sur la fiche |
|---|---|
| `01_logo_1080x1080` | Logo (symbole centré dans un cercle de 70 % : reste entier si Google l'affiche en rond) |
| `02_couverture_2048x1152` | Photo de couverture (16:9) |
| `03` à `10` (1600 × 1200, 4:3) | Une image par service : section *Services* / *Produits*, et éventuellement *Photos* |
| `11_demander-un-devis_1600x1200` | Image d'une *Actualité* (post) avec le bouton « Demander un devis » vers lullin-web.com |
| `12_notre-methode_1600x1200` | Les 6 étapes d'un projet (textes de la page « Notre méthode ») : *Actualité* ou section *Services* |

Limites : Google demande des images « fidèles à la réalité ». Ces visuels graphiques peuvent être refusés (« Non approuvé »)
dans la section *Photos* ; ils sont surtout adaptés aux services, produits et posts. Ils ne remplacent pas de vraies photos
(vous au travail, votre espace, des réalisations publiées avec l'accord des clients). La page affichée dans les visuels est la
reconstruction de la page d'accueil de lullin-web.com ; l'« ancien site » du visuel Refonte est un schéma, pas un client réel.
