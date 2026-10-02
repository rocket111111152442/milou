# Hors-Champ — vidéo hero en boucle

Composition Remotion (React + TypeScript) : faisceau tungstène, diaphragme, logo, light leak.

| Spec | Valeur |
|---|---|
| Dimensions | 1920 × 804 (2.39:1) |
| Cadence / durée | 24 i/s, 8 s, 192 images, boucle parfaite |
| Export | MP4 H.264, yuv420p, sans audio, < 4 Mo (CRF ajusté automatiquement) |

Livrables : `out/hero-hors-champ.mp4` et `out/hero-hors-champ-poster.jpg`.

## ⚠️ Logos à remplacer

Les fichiers `hors-champ-logo-clair.svg` et `hors-champ-icone-clair.svg` n'étaient pas fournis.
`public/` contient des **versions provisoires** (marquées `PLACEHOLDER` en tête de fichier).
Pour mettre les vrais logos : copiez-les dans `public/` avec exactement ces noms, puis relancez le rendu.
Le script ne régénère un logo provisoire que si le fichier est absent : il n'écrase jamais un vrai logo.

- L'animation « lame par lame » est dessinée en code (`src/Aperture.tsx`), puis passe en fondu sur l'icône SVG.
  Si la vraie icône a une taille ou une position différente, ajustez `ICON_SIZE` dans ce fichier.
- La largeur du logo complet se règle avec `LOGO_WIDTH` dans `src/Logo.tsx` (940 px par défaut).

## Installation

```bash
npm install
npm run studio      # aperçu interactif dans le navigateur
```

## Relancer le rendu

```bash
npm run render      # vidéo + poster dans out/
npm run check       # vérification ffprobe : dimensions, fps, durée, audio, poids, jonction de boucle
```

Le rendu fait un master quasi sans perte, puis réencode en remontant le CRF (départ 16) jusqu'à passer sous 4 Mo.
Pour imposer un CRF de départ : `CRF=20 npm run render`.

Variables utiles selon l'environnement :
- `REMOTION_BROWSER=/chemin/vers/chrome-headless-shell` : utilise un Chromium local si Remotion ne peut pas télécharger le sien.
- `REMOTION_IGNORE_CERT=1` : uniquement derrière un proxy HTTPS d'inspection (sinon les polices Google ne se chargent pas).

## Modifier les couleurs

Tout est dans `src/config.ts` → `COLORS` : fond, encre (texte/logo), accent tungstène, REC, dégradé du light leak.
Le grain se règle avec `GRAIN_OPACITY` (0.04 à 0.06).

## Modifier la durée

1. `src/config.ts` → `VIDEO.durationInSeconds`.
2. Dans le même fichier, recalez `TIMING`. Les valeurs sont en secondes : multipliez-les toutes par le même facteur,
   par exemple ×1,25 pour passer à 10 s.
3. **Pour garder la boucle parfaite**, `TIMING.close` doit se terminer avant la fin. Le faisceau revient alors à 0 :
   la dernière image est noire, comme l'image 0. Le clignotement REC a une période de 1 s : gardez une durée en secondes entières.
4. `POSTER_SECONDS` dans `scripts/render.mjs` : moment du poster, où le logo est net et le light leak passé.

## Structure

```
src/config.ts     réglages : dimensions, couleurs, slogan, timings
src/Beam.tsx      faisceau tungstène + poussière
src/Aperture.tsx  diaphragme et lueur
src/Logo.tsx      logo, slogan, light leak
src/Overlay.tsx   coins de viseur, ● REC, timecode, grain
scripts/          rendu, vérification, logos provisoires
```

La surimpression (coins, REC, timecode) est placée dans les 80 % centraux (`SAFE_X`) pour survivre au recadrage du site.
