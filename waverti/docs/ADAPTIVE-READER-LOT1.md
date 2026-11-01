# Lecture adaptative — audit et premier lot

Date : 1 novembre 2026. Branche : `codex/adaptive-reader-lot1`. Base : `44c86a6`.
Copie de travail isolée ; les modifications tarifaires non validées de la copie `prices-live` ne sont pas incluses.

## Périmètre et état

Premier lot seulement : audit et sélection du format dans le moteur de pages existant. Pas de nouveau moteur réseau, aucune migration, aucun changement Stripe ou Brave, aucun déploiement de worker. Les lots suivants ne sont pas commencés.

Le lot est validé par 712 tests unitaires et d’intégration sur GitHub, le typage, le lint du projet, 57 E2E web et l’E2E du binaire desktop Linux. La Preview est construite, sans migration. Aucun résultat ci-dessous ne représente un taux de compatibilité avec Internet.

## Audit du code existant

| Composant | Disponible | Écarts / suites nécessaires |
| --- | --- | --- |
| `net/safe-fetch.ts`, `safe-url.ts`, `ip-policy.ts` | HTTP(S), DNS vérifié dans la connexion, IP privées refusées, redirections revalidées, délais, limite après décompression, charset | Le résultat tronqué n'était pas refusé par le runner. En-têtes conditionnels possibles via options mais absence de gestion ETag/304. Politique robots non recontrôlée à chaque destination de redirection. |
| `net/robots.ts`, `politeness.ts` | robots.txt, cache des règles, espacement par hôte | Coordination locale au processus ; pas de quota distribué entre workers. Cache de pages consulté avant robots. |
| `extract/html.ts`, `structure.ts`, `price.ts` | JSON-LD, microdonnées, prix, stock, titres, liens, listes, dates, formulaires, empreintes | Devises EUR parfois implicites ; absence de statut de certitude systématique ; sélection de variantes moins stricte que le vérificateur produits. |
| `extract/pdf.ts` | Empreinte, texte simple et flux Flate bornés, chiffrement détecté | Extraction partielle ; ni OCR ni prise en charge complète des polices CID. Texte indisponible plutôt qu'inventé. |
| `runner.ts` | Même parcours aperçu/worker, cache SQL, HTTP prioritaire, repli navigateur | JSON accepté comme HTML ; flux refusés ; coquilles JS présentées comme lectures vides si navigateur absent ; cache sans consignes de la source. Corrigés dans ce lot. |
| `browser/pool.ts`, `egress-proxy.ts` | Chromium partagé, contextes neufs, concurrence, proxy DNS/IP, service workers et téléchargements bloqués, ressources réduites | Pas d'isolation système démontrée face aux secrets/fichiers du worker. Pas de plafond CPU/RAM par contrôle ni budget réseau global par page. Attente de file non bornée, course au premier lancement possible, temporisateur non nettoyé, attente networkidle générique. Plafond octets appliqué au tunnel CONNECT mais pas équivalent sur le chemin HTTP clair. À traiter avant toute extension d'activation. |
| `products/verify/*`, `pipeline.ts`, `match.ts` | Vérification stricte prix/devise, variantes ambiguës refusées, provenance, rapprochement, sémaphore, fusion des requêtes, cache, blocages explicites | Plus prudent que l'extracteur de pages ; conserver ces garanties. Cache produits ne tient pas compte de Cache-Control. Ce lot ne modifie pas le moteur produits ni les droits de recherche Brave. |
| `compare/evaluate.ts`, `rules.ts`, `results.ts` | Comparaison au précédent état, transitions, empreintes, règles enrichies, erreurs | Toute extension du schéma d'observation devra préserver les observations desktop anciennes et éviter les fausses alertes. |
| `apps/worker/src/jobs/pages.ts`, file et quotas | Réservation de jobs, concurrence, espacement, coût Playwright enregistré, contrôles d'abonnement existants | Pas de budget CPU/RAM/réseau complet par utilisateur. Coût fixe configuré, pas un coût mesuré. Prévisualisation sans limite par domaine dédiée dans le runner. |

## Changements livrés

- `packages/monitoring/src/extract/response.ts` : sélection HTML, JSON/JSON-LD, RSS/Atom, texte et PDF ; réutilisation des extracteurs existants. Pas d'exploration d'API cachée ni de téléchargement des liens de flux.
- JSON : lecture explicite, ordre des clés stabilisé, profondeur bornée ; les données génériques servent aux changements de texte et ne deviennent pas des offres inventées. Les données schema.org explicites utilisent l'extracteur JSON-LD existant.
- Flux : 60 entrées maximum, liens HTTP(S) seulement, entités/DTD refusées, aucun chargement externe.
- `packages/monitoring/src/runner.ts` : même adaptateur pour aperçu et worker ; refus des documents tronqués ; restrictions 401/403/429/451 et challenges reconnaissables signalés ; absence de navigateur signalée. Les limites personnalisées de taille sont conservées si plus strictes.
- Détection JS : prise en charge des coquilles React/Next/Vue/Nuxt/Angular ; pas de navigateur si données produit ou contenu structuré déjà suffisant. Une heuristique peut manquer un site ; ce n'est pas une preuve de compatibilité.
- Cache partagé : durée explicite bornée par max-age/s-maxage et Age ; pas de partage pour private/no-store/no-cache, cookie ou Vary. Nouvelle clé versionnée pour ne pas réutiliser les anciennes entrées sans politique connue. Rendu navigateur non mis en cache faute d'en-têtes fiables. Cela peut augmenter les requêtes sur les sites sans consigne de cache ; ETag/304 prévu au lot performance.
- Comptage Playwright effectué également en mode navigateur explicite et avant tentative, afin de comptabiliser les échecs. Aucun nouveau navigateur n'est installé ou activé en service.

## Fichiers de validation

- `packages/monitoring/test/adaptive-fixtures.ts` : 40 réponses représentatives locales, dont HTML de huit familles, coquilles et rendu serveur des frameworks, devises, JSON, RSS/Atom, texte, erreurs HTTP, restrictions et PDF.
- `packages/monitoring/test/adaptive.unit.test.ts` : format, titre/prix attendus, schéma d'observation, décision JS, cache, contenu malformé et limites.
- `packages/monitoring/test/adaptive-runner.unit.test.ts` : serveur HTTP réel local, aperçu et worker, robots, SSRF après redirection, cache et facturation des tentatives navigateur. Base et renderer simulés dans ce fichier ; le navigateur réel est testé séparément par la suite existante.
- `packages/monitoring/scripts/adaptive-benchmark.ts` : mesure reproductible sans site tiers.
- `docs/ADAPTIVE-BENCHMARK.json` : résultats bruts.

## Résultats mesurés

Windows, Node 24.19.0. 40 fixtures, 100 répétitions pour l'extraction. Le parcours historique reproduit la sélection MIME et l'extraction du runner de base ; ce n'est pas un déploiement comparatif de deux workers.

| Mesure | Ancien parcours | Adaptatif |
| --- | ---: | ---: |
| Réponses décodées / 40 | 36 (90 %) | 40 (100 %) |
| Titres et prix attendus / 40 | 33 (82,5 %) | 40 (100 %) |
| Extraction moyenne | 1,405 ms | 1,762 ms |
| RSS processus maximum observé pendant la phase | 108 802 048 octets | 147 025 920 octets |
| HTTP local + extraction, moyenne de 30 passages après 5 échauffements | 11,814 ms | 11,086 ms |
| Corps HTML décodé par passage HTTP | 189 octets | 189 octets |

Les réponses bloquées ou en erreur sont incluses dans les mesures de **décodage**, pas considérées comme des sites utilisables. Les assertions de titre/prix ne mesurent pas l'exactitude exhaustive du stock, des variantes ou du contenu. Les sept écarts historiques : deux documents JSON-LD mal extraits, quatre flux refusés, prix inféré à tort dans un JSON générique.

RSS inclut le runtime, les deux moteurs successifs et le ramasse-miettes : ce n'est ni une allocation par vérification ni une comparaison mémoire isolée. L'ordre des moteurs, la petite taille des fixtures et la charge Windows limitent la précision des temps. Les mesures HTTP excluent TLS, Internet, robots, ordonnanceur et base.

**Coût monétaire : non mesuré.** Aucun tarif d'infrastructure ni volume représentatif fourni. **Coût et durée moyenne Chromium : non mesurés.** Le test navigateur prouve un fonctionnement local, pas une consommation bornée en service. Ne pas convertir le coût fixe existant du worker en coût observé.

## Vérifications et reproduction

Commandes depuis `waverti/`, après installation des versions verrouillées :

```text
node node_modules/vitest/vitest.mjs run --project unit --maxWorkers=1
node node_modules/typescript/bin/tsc -p packages/monitoring/tsconfig.json
node node_modules/typescript/bin/tsc -p apps/worker/tsconfig.json
node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json
node node_modules/eslint/bin/eslint.js packages/monitoring/src packages/monitoring/test/adaptive.unit.test.ts packages/monitoring/test/adaptive-runner.unit.test.ts packages/monitoring/test/adaptive-fixtures.ts
node node_modules/tsx/dist/cli.mjs packages/monitoring/scripts/adaptive-benchmark.ts
```

- Suite unitaire complète : **24 fichiers, 515 tests réussis** (100,23 s). Deux premières exécutions ont rencontré des erreurs transitoires de dépendances et de délai ; exécution séquentielle complète réussie sans modifier les tests historiques.
- Typage monitoring, worker et web : réussi.
- Lint prévu par les scripts de chaque package : réussi localement et sur GitHub. Lint monitoring et nouveaux tests : réussi. Un contrôle supplémentaire `eslint .` au-delà du périmètre des scripts révèle trois erreurs préexistantes (`apps/desktop/e2e/desktop.e2e.test.ts`, deux dans `packages/monitoring/test/products-brave.int.test.ts`) et avertissements historiques ; non corrigés hors périmètre.
- Navigateur/proxy : **3 tests réussis** (16,15 s) avec `PLAYWRIGHT_CHROMIUM_EXECUTABLE` pointant vers Chrome installé localement. Le chemin Linux initial était absent.
- Intégration PostgreSQL locale (`rules.int.test.ts`) : connexion refusée sur 127.0.0.1:5432 ; 10 tests non exécutés localement. La suite complète a ensuite réussi sur GitHub.
- E2E web local tenté : échec au lancement du Chromium Playwright attendu, non installé ; 9 autres tests non exécutés. Les E2E sont donc exécutés sur GitHub avec les services isolés de test.

## Livraison de test

- Commit du code testé : `bcfc54c445790a82c76d8d446b132b7029822270`.
- [Proposition en brouillon n° 1](https://github.com/rocket111111152442/milou/pull/1), ciblant la branche de développement existante ; huit fichiers, un commit de code, aucune fusion.
- [CI GitHub](https://github.com/rocket111111152442/milou/actions/runs/41339194801) : **46 fichiers, 712 tests réussis, 71,20 s** ; typage et lint réussis. PostgreSQL, stripe-mock et Chromium sont ceux de la CI, aucun service de Production.
- E2E web GitHub : **57 tests réussis en 1,8 minute**, build compris dans le job réussi ; PostgreSQL, Mailpit et stripe-mock isolés. Cela valide les parcours existants, pas un nouveau parcours de compatibilité (prévu dans un lot suivant).
- Desktop Linux GitHub : build de l’application, tests et lint Rust, binaire debug et E2E du binaire réel réussis ; PostgreSQL, Mailpit et stripe-mock isolés.
- [Preview](https://watchly-16qaoxg34-lullinismael2-9456s-projects.vercel.app/) : Vercel `dpl_D5vyyCbq1hHpkz5njdUDy86R7MnK`, état READY, cible Preview (`target: null`). Construction via `pnpm exec next build`, sans script de migration. Le build automatique initial avait été ignoré ; une construction explicite de ce commit a été lancée.
- Accès HTTP à la Preview non vérifié : protection Vercel conservée, connecteur refusé avec 403 lors de la lecture. Le statut READY atteste la construction, pas les parcours utilisateurs.
- Build Windows local incomplet : dépendance `@radix-ui/react-hover-card` non résolue. La construction Vercel a réussi avec les dépendances installées sur le serveur.

## Limites et lots suivants — non commencés

1. **Clôture du lot 1** : Preview construite, tests, E2E web et E2E desktop validés. Revue du lot livré avant tout passage aux lots suivants.
2. **Fiabilité des informations** : unifier provenance et valeurs vérifiées/incertaines/indisponibles, supprimer les devises implicites, garantir les variantes, réutiliser les règles strictes du moteur produits. Tests par champ et fausses alertes.
3. **Navigateur isolé** : service sans secrets ni accès interne, plafonds OS CPU/RAM, concurrence et file bornées, budget réseau par page, fermeture, attente ciblée, validations de chaque requête et redirection. Recette SSRF et charge avant activation.
4. **Coûts et performance** : validateurs HTTP/304, politiques par source, coordination des domaines et requêtes simultanées, quotas par abonnement, mesures CPU/RAM/réseau et coûts HTML/Chromium comparables.
5. **Parcours utilisateur et couverture** : état de compatibilité et informations partielles dans l'interface, catégories de surveillance adaptées, fixtures plus réalistes et E2E de chaque famille. Aucune promesse universelle.

Les restrictions d'accès ne sont pas contournées. Les messages proposent un flux public ou une source autorisée. Aucun changement de Production, Stripe Live, droits Brave, comptes ou données existantes n'est inclus.
