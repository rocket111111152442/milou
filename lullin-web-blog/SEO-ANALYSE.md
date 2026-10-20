# Analyse SEO du blog Lullin Web

Analyse réalisée le 20 octobre 2026, sans budget et sans outil payant.

**Limite importante** : aucun outil de volumes de recherche n’était disponible (pas de Search Console, d’Ahrefs ou de SEMrush connectés). Les mots-clés viennent des **suggestions de recherche Google** (saisie semi-automatique, langue et pays France), qui montrent des requêtes réellement tapées, mais **sans volume ni difficulté chiffrée**. Aucune estimation de trafic n’est donnée dans ce document. Une fois le blog en ligne, Google Search Console fournira les vraies données (impressions, clics, positions) au bout de quelques semaines.

## 1. Pages existantes et requêtes visées

| Page | Title | Requête principale visée |
|---|---|---|
| `/` | Création de site internet professionnel dès 349 € | création de site internet professionnel |
| `/services` | Création, gestion et visibilité de sites internet | services création / maintenance / visibilité |
| `/realisations` | Exemples de sites internet réalisés | exemples de sites, portfolio |
| `/methode` | Comment se passe la création de votre site internet ? | étapes de création d’un site |
| `/a-propos` | Agence web à tarifs accessibles : pourquoi Lullin Web | agence web pas chère |
| `/offres` | Prix d’un site internet : offres dès 349 € | prix site internet, tarifs |
| `/faq` | Combien coûte un site internet ? Questions fréquentes | combien coûte un site internet |
| `/contact` | Devis gratuit pour votre site internet | devis site internet |
| `/partenaires` | Partenariat création de site internet : 10 à 20 % de commission | apporteur d’affaires site internet |
| `/creation-site-internet-six-fours` | (dans ta dernière version, pas encore en ligne) | création site internet Six-Fours |

Constats :

- **Cannibalisation existante** : `/offres` (description) et `/faq` (title) ciblent tous deux « combien coûte un site internet ». Correction proposée dans le README.
- **Toutes les pages visent des requêtes commerciales générales**, très concurrentielles pour un domaine encore peu connu. Rien ne cible les questions que se posent les clients avant de chercher un prestataire : c’est le rôle du blog.
- **Méta-descriptions trop longues** sur plusieurs pages (de 177 à 307 caractères pour `/`, `/services`, `/realisations`, `/methode`, `/a-propos`, `/offres`, `/faq`, `/contact`, `/partenaires`) : Google les coupe vers 155 à 160 caractères. À raccourcir dans `src/seo.json`.
- Le site est une application React avec un contenu de secours pré-rendu : c’est correct pour le référencement. Les pages du blog, elles, sont entièrement statiques.

## 2. Requêtes relevées (suggestions Google, 20 octobre 2026)

- **Prix** : combien coute un site internet (vitrine, pour une entreprise, en moyenne, par mois, professionnel, pour artisan en 2025), cout site internet par mois, prix site internet vitrine, prix création site internet professionnel, budget création site internet, prix maintenance site internet, tarif maintenance site internet freelance.
- **Artisans** : site internet artisan, site internet pour artisan, création site internet artisan, prix site internet artisan, combien coûte la création d’un site internet pour artisan, pourquoi créer un site internet pour artisan, site internet plombier, site internet électricien, création site internet menuisier, site internet paysagiste, site internet coiffeur. Beaucoup de suggestions locales (« … saint etienne », « … firminy ») : la concurrence est faite d’agences locales.
- **Visibilité** : comment apparaître sur google (maps, gratuitement, sans site internet, en tant que professionnel), être visible sur google gratuitement, fiche google business c’est quoi, comment être en premier sur google.
- **Choix** : site vitrine ou e commerce, difference site vitrine et ecommerce, definition site vitrine.
- **Obligations** : mentions légales site internet obligatoire, cookies site internet obligatoire, cgv site internet obligatoire.

## 3. Évaluation des cinq sujets proposés

| Sujet | Intention | Accessibilité pour un site peu connu | Risque de cannibalisation | Verdict |
|---|---|---|---|---|
| Combien coûte un site internet en 2026 | Commerciale (comparaison) | Faible sur la requête principale, correcte sur les variantes (« par mois », « vitrine », « pour une entreprise ») | Oui, avec `/offres` et `/faq` : à corriger | **Publié** : fort potentiel de conversion, car le positionnement prix de Lullin Web est l’argument central |
| Site internet pour artisan | Commerciale | Correcte : surtout des agences locales et des comparatifs d’outils | Aucun | **Publié** : le plus prometteur |
| Améliorer sa visibilité sur Google | Informationnelle, proche des offres Google Business et Visibilité | Faible sur la formulation générale, correcte sur « apparaître sur Google Maps » | Faible | Brief prêt, angle resserré sur Google Maps et les petites entreprises |
| Site vitrine ou e-commerce | Choix avant achat | Correcte | Aucun | Brief prêt |
| Pourquoi créer un site internet | Informationnelle | Faible (grandes plateformes, organismes publics) | Avec l’article artisan | Le moins utile : brief prêt avec un angle comparatif honnête, à traiter plus tard |

## 4. Articles publiés

| Article | URL | Mot-clé principal | Secondaires |
|---|---|---|---|
| Site internet pour artisan : prix, avantages et conseils | `/blog/site-internet-artisan` | site internet artisan | site internet pour artisan, création site internet artisan, prix site internet artisan, site vitrine artisan |
| Combien coûte un site internet professionnel en 2026 ? | `/blog/combien-coute-un-site-internet` | combien coûte un site internet | prix site internet professionnel, coût site internet, prix site vitrine, coût site internet par mois, budget site internet |

Règles appliquées : chiffres uniquement sourcés (Service Public, baromètre France Num 2026, La Fabrique du Net, DGCCRF), vérifiés sur les pages sources le 20 octobre 2026 ; aucun témoignage, aucune statistique inventée ; prix Lullin Web repris tels qu’affichés sur `/offres` ; exemples de budget présentés comme des calculs ; limites de chaque chiffre expliquées. Données structurées `BlogPosting` et `BreadcrumbList`. Pas de `FAQPage` : depuis 2023, Google réserve ces résultats enrichis aux sites officiels et de santé.

## 5. Prochaines opportunités, par ordre de priorité

1. **Mesurer avant d’écrire plus** : Google Search Console (gratuit), sitemap soumis. Après quatre à huit semaines, regarder les requêtes qui génèrent des impressions sur les deux articles et les enrichir en conséquence.
2. **Corriger la cannibalisation et les méta-descriptions** (README, section 4). C’est rapide et cela touche les pages qui convertissent.
3. **Maintenance de site internet : que comprend-elle et combien coûte-t-elle ?** Requêtes relevées : « prix maintenance site internet », « tarif maintenance site internet freelance ». Lien direct avec les trois abonnements (39, 69 et 119 €/mois), et sujet peu traité de façon transparente.
4. **Comment apparaître sur Google Maps** (brief prêt), relié à l’option Google Business à 79 €.
5. **Études de cas réelles** plutôt que des pages par métier génériques : par exemple, le site d’un paysagiste du Var ou d’un salon de coiffure, avec l’accord du client et des faits vérifiables (objectifs, pages, fonctionnalités). C’est le contenu le plus crédible pour « site internet paysagiste » ou « site internet coiffeur », et le plus difficile à copier.
6. **Référencement local** : publier la page Six-Fours déjà prête, puis créer ou compléter la fiche Google Business Profile de Lullin Web elle-même.
7. **Site vitrine ou e-commerce** (brief prêt).
8. Plus tard : choisir son nom de domaine et son adresse e-mail professionnelle (lié à l’option e-mail à 69 €/an) ; une checklist des mentions obligatoires pour TPE, en citant uniquement les sources officielles.

À éviter : des dizaines de pages « création site internet + ville » ou « site internet + métier » au contenu interchangeable. Google les traite comme des pages satellites, et elles peuvent nuire à l’ensemble du site.
