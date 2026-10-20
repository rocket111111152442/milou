# Blog de lullin-web.com

Ce dossier ajoute une section `/blog` au site lullin-web.com (projet Vercel `lullin-web-maquette`), avec deux articles publiés et trois sujets préparés. L’analyse SEO qui a guidé le choix des sujets est dans [SEO-ANALYSE.md](SEO-ANALYSE.md).

**Rien n’a été déployé.** Le code complet du site n’est dans aucun dépôt Git : il vit sur ton poste et part chez Vercel avec `vercel deploy`. Ce dossier contient donc uniquement les fichiers à ajouter ou à modifier dans ta copie locale, sur le même principe que `sites/lullin-web` du dépôt LRT.

## Le choix technique, en bref

Le site est en **Vite + React**, pas en Next.js. Le blog n’ajoute pas de framework ni de dépendance. À la fin du build, un script génère des pages HTML statiques :

- même design : les pages reprennent la feuille de style produite par Vite et le balisage exact de l’en-tête, du menu mobile, du pied de page et du bandeau de contact ;
- meilleures performances et meilleur référencement : le texte est dans le HTML dès le chargement, sans JavaScript à exécuter et sans charger React (environ 45 Ko de HTML par article, CSS du site mise en cache) ;
- aucun risque pour les pages existantes : `src/` n’est pas modifié, le script n’écrit que dans `dist/blog/` et ajoute des lignes au sitemap et à `llms.txt`.

## Installation dans la copie locale

### 1. Copier les fichiers

À la racine du projet (là où se trouvent `package.json`, `src/`, `scripts/`) :

```
blog/
  blog.config.mjs            réglages : URL, navigation, mesure d’audience, appel à l’action
  blog.css                   styles propres au blog (le reste vient du site)
  articles/                  un fichier .md par article publié
  brouillons/                sujets préparés, non publiés
scripts/
  build-blog.mjs             génère dist/blog, le flux RSS, complète sitemap.xml et llms.txt
  check-blog.mjs             vérifie les pages générées (fait échouer le build en cas d’erreur)
  blog/markdown.mjs          conversion Markdown → HTML, sans dépendance
  blog/content.mjs           lecture et validation des articles
  blog/templates.mjs         gabarits HTML
tests/
  blog.test.mjs              10 tests (node --test)
```

### 2. Modifier deux fichiers existants

Les versions complètes sont fournies ici (`package.json`, `vercel.json`), construites à partir de ceux du déploiement du 20 octobre 2026 à 10 h 29 (UTC). Si tu les as modifiés depuis, applique seulement ces changements.

`package.json`, scripts :

```diff
- "build": "tsc --noEmit && vite build && node scripts/generate-seo.mjs && node scripts/check-seo.mjs",
+ "build": "tsc --noEmit && vite build && node scripts/generate-seo.mjs && node scripts/check-seo.mjs && node scripts/build-blog.mjs && node scripts/check-blog.mjs",
- "test": "node --test tests/contact.test.mjs"
+ "test": "node --test tests/contact.test.mjs tests/blog.test.mjs",
+ "blog:check-links": "node scripts/check-blog.mjs --external"
```

`vercel.json`, à la fin de `rewrites` :

```json
{ "source": "/blog", "destination": "/blog/index.html" },
{ "source": "/blog/:slug([a-z0-9-]+)", "destination": "/blog/:slug/index.html" }
```

### 3. Ajouter le lien « Blog » dans le site React

Les pages du blog affichent déjà « Blog » dans leur en-tête, leur menu mobile et leur pied de page. Pour que le site React l’affiche aussi, dans `src/App.tsx` :

```diff
 const navigation = [
   { label: "Expertises", href: "/services" },
   { label: "Réalisations", href: "/realisations" },
   { label: "L’agence", href: "/a-propos" },
   { label: "Offres", href: "/offres" },
+  { label: "Blog", href: "/blog" },
 ];
```

Vérifie ensuite que « Blog » apparaît dans le menu mobile et dans le pied de page ; si ces listes sont séparées dans `App.tsx`, ajoute-le aussi (après « Questions fréquentes » dans le menu mobile, après « FAQ » dans le pied de page, comme sur les pages du blog). L’en-tête avec cinq liens a été vérifié sans débordement de 820 à 1 440 px de large.

Liens contextuels recommandés (texte à adapter) :

- page `/offres`, près des formules : « Comparer avec les prix du marché : [combien coûte un site internet en 2026 ?](/blog/combien-coute-un-site-internet) » ;
- page `/faq`, réponse « Combien coûte un site internet ? » : renvoyer vers le même article ;
- accueil, section « Un site pour chaque métier » : « Artisan ? [Notre guide pour un site qui fait appeler](/blog/site-internet-artisan) ».

### 4. Corriger la cannibalisation sur « combien coûte un site internet »

Aujourd’hui, deux pages visent déjà cette requête : le title de `/faq` commence par « Combien coûte un site internet ? » et la description de `/offres` aussi. Avec l’article, ce serait trois pages en concurrence. Dans `src/seo.json` :

| Page | Actuel | Proposé |
|---|---|---|
| `/faq`, title | Combien coûte un site internet ? Questions fréquentes \| Lullin Web | Questions fréquentes sur la création de site internet \| Lullin Web |
| `/offres`, description | Combien coûte un site internet ? Essentiel dès 349 €, Vitrine 549 €… | Tarifs Lullin Web : Essentiel dès 349 €, Vitrine 549 €, Business 799 €, Premium 949 €, options à la carte, maintenance dès 39 €/mois. |

`/offres` reste la page de tarifs Lullin Web ; l’article devient la page « guide » sur le prix d’un site en général.

### 5. Vérifier puis déployer

```
npm run build      # build du site, puis du blog, puis vérifications
npm test           # tests du formulaire de contact et du blog
npm run lint
npm run blog:check-links   # optionnel : vérifie que les sources externes répondent
```

Puis `vercel deploy` (aperçu), contrôle visuel de `/blog`, et `vercel deploy --prod` quand tout est bon.

Après la mise en ligne, dans Google Search Console (gratuit) : soumettre `https://www.lullin-web.com/sitemap.xml` et demander l’indexation de `/blog`, `/blog/combien-coute-un-site-internet` et `/blog/site-internet-artisan`.

## Publier un nouvel article

1. Créer `blog/articles/mon-slug.md` (ou déplacer un fichier de `blog/brouillons/` et passer `status` à `published`).
2. Remplir l’en-tête :

```
---
slug: mon-slug                     adresse : /blog/mon-slug (minuscules, chiffres, tirets)
title: Title SEO                   « | Lullin Web » est ajouté s’il reste de la place (65 caractères)
h1: Titre affiché *partie en vert* les astérisques mettent en couleur, comme sur le site
description: 110 à 160 caractères  meta description, unique
excerpt: Résumé de la carte sur /blog
keyword: mot-clé principal
keywords: secondaires, séparés, par des virgules
category: Catégorie affichée
breadcrumb: Libellé court pour le fil d’Ariane (facultatif)
cta: Texte du bloc « devis » (facultatif)
datePublished: 2026-10-20
dateModified: 2026-10-20         à changer à chaque mise à jour importante
status: published                 ou draft
---
```

3. Écrire en Markdown : `##` et `###` pour les titres (le H1 vient de l’en-tête), listes, tableaux, `> citation`, `[lien](/offres)`, `**gras**`. La ligne `<!-- cta -->` place le bloc de demande de devis.
4. `npm run build` : la page, la liste du blog, le sitemap, le flux RSS et `llms.txt` se mettent à jour seuls. Un lien interne cassé, un H1 en trop ou une description en double font échouer le build avant le déploiement.

## Mesure d’audience

Ta dernière version (`src/consent.tsx`) charge Google Analytics seulement après consentement, avec la clé `lw-consent`. Les pages du blog font pareil : même clé, donc un choix fait sur le blog vaut pour le site et inversement ; aucune requête vers Google sans « Accepter » (vérifié dans Chromium). Le bandeau du blog est une version simple, aux couleurs du site : aligne son texte sur celui de `consent.tsx` si besoin, dans `scripts/blog/templates.mjs`. Pour ne rien charger, mettre `gaMeasurementId: ""` dans `blog/blog.config.mjs`.

## Points d’attention

- **Animations** : la version en ligne (déploiement du 18 octobre) contient la couche d’animations `fx.ts`, `fx-tech.ts`, etc. Le code source de ton dernier déploiement (20 octobre) ne les contient plus, et son `src/main.tsx` ne les importe plus. Si tu déploies depuis ta copie actuelle, ces animations disparaîtront du site.
- **Page de confidentialité** : celle en ligne indique « aucun cookie de suivi, donc pas de bandeau ». Elle doit mentionner Google Analytics si tu le mets en ligne.
- **Deux sources à ouvrir une fois** : les pages economie.gouv.fr citées (médiation de la consommation, location financière) bloquent tout accès automatisé (protection Cloudflare) ; leur contenu vient des résultats de recherche. Les autres liens externes ont été vérifiés.
- **Règle `/blog/:slug` de vercel.json** : syntaxe standard de Vercel, mais non testée sur Vercel lui-même (rien n’a été déployé). À contrôler sur le déploiement d’aperçu.
