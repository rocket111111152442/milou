# Blog de lullin-web.com

Ce dossier ajoute une section `/blog` au site lullin-web.com (projet Vercel `lullin-web-maquette`), avec deux articles publiés et trois sujets préparés. L’analyse SEO qui a guidé le choix des sujets est dans [SEO-ANALYSE.md](SEO-ANALYSE.md).

## État : en ligne depuis le 20 octobre 2026

Déploiement de production `dpl_Ex9A9juVqBkGMgy7wmk9HNEq922m`, construit à partir du déploiement `dpl_9Am6b44nMgopbzKy9kr7UA1tGxKE` (version du 18 octobre, avec les animations `fx.ts` et `fx-tech.ts`), auquel ont été ajoutés exactement les fichiers de ce dossier. Rien d’autre n’a changé dans le site.

Pour revenir en arrière : dans Vercel, projet `lullin-web-maquette` › Deployments, « Promote » ou « Instant Rollback » sur le déploiement `9Am6b44`.

### À faire avant ton prochain `vercel deploy`

Le code du site vit sur ton poste, pas dans un dépôt Git. **Si tu redéploies depuis ta copie locale sans y avoir ajouté ces fichiers, le blog disparaît.** Et si ta copie locale est celle du déploiement `BNd95` (avec `consent.tsx`, sans `fx.ts`), les animations disparaissent aussi.

Pour te resynchroniser, copie dans ta copie locale, à la racine du projet, tous les fichiers de ce dossier (sauf `README.md` et `SEO-ANALYSE.md`) : `blog/`, `scripts/build-blog.mjs`, `scripts/check-blog.mjs`, `scripts/blog/`, `tests/blog.test.mjs`, et les versions modifiées de `package.json`, `vercel.json` et `vite.config.ts`. Si ces trois derniers ont changé chez toi depuis le 18 octobre, applique seulement les différences décrites plus bas.

## Le choix technique, en bref

Le site est en **Vite + React**, pas en Next.js. Le blog n’ajoute ni framework ni dépendance. À la fin du build, un script génère des pages HTML statiques :

- même design : les pages reprennent la feuille de style produite par Vite et le balisage exact de l’en-tête, du menu mobile, du pied de page et du bandeau de contact ;
- meilleures performances et meilleur référencement : le texte est dans le HTML dès le chargement, sans JavaScript à exécuter et sans charger React ;
- aucun risque pour les pages existantes : `src/` n’est pas modifié, le script n’écrit que dans `dist/blog/` et ajoute des lignes au sitemap et à `llms.txt`.

## Fichiers

```
blog/
  blog.config.mjs            réglages : URL, navigation, mesure d’audience, appel à l’action
  blog.css                   styles propres au blog (le reste vient du site)
  articles/                  un fichier .md par article publié
  brouillons/                sujets préparés, non publiés (pas déployés)
scripts/
  build-blog.mjs             génère dist/blog, le flux RSS, complète sitemap.xml et llms.txt
  check-blog.mjs             vérifie les pages générées (fait échouer le build en cas d’erreur)
  blog/markdown.mjs          conversion Markdown → HTML, sans dépendance
  blog/content.mjs           lecture et validation des articles
  blog/templates.mjs         gabarits HTML
tests/
  blog.test.mjs              10 tests (node --test)
package.json                 build et tests complétés
vercel.json                  réécritures /blog ajoutées
vite.config.ts               lien « Blog » ajouté à la navigation du site
```

### Différences avec les fichiers existants

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

`vite.config.ts` : un petit plugin ajoute `{ label: "Blog", href: "/blog" }` juste après « Offres » dans le tableau `navigation` de `src/App.tsx` au moment du build. L’en-tête, le menu mobile et le pied de page du site React en dépendent tous les trois. Il ne modifie pas le fichier sur le disque, et il fait échouer le build s’il ne trouve plus la ligne « Offres ». Le jour où tu ajoutes « Blog » directement dans `App.tsx`, le plugin ne fait plus rien et tu peux le supprimer.

## Recommandations restantes (non faites)

### Liens contextuels depuis les pages du site

- page `/offres`, près des formules : « Comparer avec les prix du marché : [combien coûte un site internet en 2026 ?](/blog/combien-coute-un-site-internet) » ;
- page `/faq`, réponse « Combien coûte un site internet ? » : renvoyer vers le même article ;
- accueil, section « Un site pour chaque métier » : « Artisan ? [Notre guide pour un site qui fait appeler](/blog/site-internet-artisan) ».

### Corriger la cannibalisation sur « combien coûte un site internet »

Le title de `/faq` commence par « Combien coûte un site internet ? » et la description de `/offres` aussi : avec l’article, trois pages se concurrencent. Dans `src/seo.json` :

| Page | Actuel | Proposé |
|---|---|---|
| `/faq`, title | Combien coûte un site internet ? Questions fréquentes \| Lullin Web | Questions fréquentes sur la création de site internet \| Lullin Web |
| `/offres`, description | Combien coûte un site internet ? Essentiel dès 349 €, Vitrine 549 €… | Tarifs Lullin Web : Essentiel dès 349 €, Vitrine 549 €, Business 799 €, Premium 949 €, options à la carte, maintenance dès 39 €/mois. |

### Google Search Console (gratuit)

Soumettre `https://www.lullin-web.com/sitemap.xml` et demander l’indexation de `/blog`, `/blog/combien-coute-un-site-internet` et `/blog/site-internet-artisan`.

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

Vérifications locales : `npm run build`, `npm test`, `npm run lint`, et `npm run blog:check-links` pour tester les sources externes.

## Mesure d’audience

Désactivée sur le blog (`gaMeasurementId: ""` dans `blog/blog.config.mjs`), comme sur la version en ligne du site, dont la page de confidentialité annonce « aucun cookie de suivi ».

Si tu mets en ligne `src/consent.tsx` (Google Analytics après consentement), mets `"G-QLDMCG36NE"` dans la configuration : le blog chargera alors Google Analytics seulement après « Accepter », avec la même clé de stockage `lw-consent` que le reste du site (choix partagé), un bandeau Accepter / Refuser et un lien « Cookies » dans le pied de page. Ce comportement a été testé dans Chromium : aucune requête vers Google sans accord. Pense alors à mettre à jour la page de confidentialité.

## Sources à vérifier une fois

Les deux pages economie.gouv.fr citées (médiation de la consommation, location financière) bloquent tout accès automatisé (protection Cloudflare) ; leur contenu vient des résultats de recherche. Les autres sources ont été vérifiées sur la page elle-même le 20 octobre 2026.
