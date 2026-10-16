# Fan Tour Zanzibar – Guide Francophone

Site vitrine statique (HTML / CSS / JS, sans dépendance ni étape de build).

```
fan-tour-zanzibar/
├── index.html     contenu de toutes les sections + SEO + données structurées
├── styles.css     design (couleurs en variables au début du fichier)
├── main.js        liens WhatsApp, menu mobile, animations, formulaire
├── images/        photos (WebP, 800 px et 1600 px de large)
├── videos/        vidéo de fond du hero (MP4 H.264, sans son)
├── favicon.svg
├── robots.txt / sitemap.xml
└── vercel.json    en-têtes de cache et de sécurité
```

## Tester en local

```bash
cd fan-tour-zanzibar
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

Les chemins commencent par `/` : ouvrir `index.html` en double-clic n'affichera pas les images, il faut passer par un petit serveur comme ci-dessus.

## Déployer sur Vercel

1. Importer le dépôt dans Vercel.
2. **Root Directory** : `fan-tour-zanzibar`.
3. Framework preset : **Other**. Aucune commande de build, aucun dossier de sortie à renseigner.

## Ce qu'il faut personnaliser

Chaque endroit à adapter est signalé dans le code par un commentaire `À MODIFIER`.

| Quoi | Où |
|---|---|
| Domaine définitif | `index.html` (canonical, `og:url`, `og:image`, JSON-LD), `robots.txt`, `sitemap.xml` — remplacer `fan-tour-zanzibar.vercel.app` |
| Numéro WhatsApp | `main.js` (`WHATSAPP_NUMBER`) **et** les `href="https://wa.me/255786978003"` de `index.html` (lien de secours si le JS ne charge pas) + le numéro affiché dans la section Contact et le JSON-LD |
| Message prérempli d'un bouton | attribut `data-wa="…"` du bouton dans `index.html` |
| Texte de présentation | section `#confiance` |
| Excursions | une balise `<article class="card">` par excursion dans `#excursions` |
| Photos | remplacer les fichiers dans `images/` en gardant le même nom (ou changer le `src`) |
| Vidéo du hero | remplacer `videos/hero-coucher-soleil.mp4` et `images/hero-video-poster.webp` (première image de la vidéo) |
| Couleurs / typographies | variables `:root` en haut de `styles.css` |

### Ajouter des tarifs ou des disponibilités plus tard

Le site n'en affiche volontairement aucun. Pour en ajouter, le plus simple est une ligne `<p class="card-price">…</p>` dans la carte concernée, au-dessus du bouton.

## Vidéo du hero

Fournie par le client (fichier « No Copyright / Copyright Free Videos – sunset beach sea waves »). Sa licence exacte n'a pas été vérifiée : conservez la source d'origine. Résolution actuelle 640×360, un peu floue en plein écran sur grand écran ; une version 1080p serait préférable. Le son a été retiré et la vidéo est remplacée par son image fixe si le visiteur a demandé à réduire les animations.

## Photos

Toutes les photos actuelles viennent d'[Unsplash](https://unsplash.com/license) (utilisation commerciale gratuite, sans attribution obligatoire). **Ce sont des illustrations génériques : elles ne représentent pas les lieux exacts** (par exemple, la carte « The Rock » ou « Prison Island » ne montre pas le vrai site). Il est recommandé de les remplacer par vos propres photos dès que possible.

Ne pas utiliser de photos Instagram (les vôtres ou celles de clients) sans l'accord des auteurs et des personnes photographiées.

| Fichier | Source |
|---|---|
| mnemba | https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f |
| nakupenda | https://images.unsplash.com/photo-1535262412227-85541e910204 |
| prison-island | https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5 |
| stone-town | https://images.unsplash.com/photo-1527631746610-bca00a040d60 |
| safari-blue | https://images.unsplash.com/photo-1578922746465-3a80a228f223 |
| the-rock | https://images.unsplash.com/photo-1499793983690-e29da59ef1c2 |
| grottes | https://images.unsplash.com/photo-1510414842594-a61c69b5ae57 |
| safari | https://images.unsplash.com/photo-1516426122078-c23e76319801 |
| girafe | https://images.unsplash.com/photo-1523805009345-7448845a9e53 |
| elephants | https://images.unsplash.com/photo-1564760055775-d63b17a55c44 |
| rhinos | https://images.unsplash.com/photo-1547970810-dc1eac37d174 |
| transfert | https://images.unsplash.com/photo-1561361513-2d000a50f0dc |
| palmier | https://images.unsplash.com/photo-1506953823976-52e1fdc0149a |
| plage-aerienne | https://images.unsplash.com/photo-1505142468610-359e7d316be0 |
| plongee | https://images.unsplash.com/photo-1544551763-46a013bb70d5 |
| acacia | https://images.unsplash.com/photo-1516026672322-bc52d61a55d5 |
| lever-soleil | https://images.unsplash.com/photo-1471922694854-ff1b63b20054 |
| palmiers | https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f |
| recif | https://images.unsplash.com/photo-1582967788606-a171c1080cb0 |
