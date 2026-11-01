# Recherche d'un produit sur plusieurs boutiques — lots 1 et 2

État : **lot 1 (moteur de rapprochement) et lot 2 (vérificateur HTTP) ; la découverte reste simulée**. Aucune interface, aucune alerte, aucun appel Brave ni
requête HTTP vers une boutique, aucune table en base, aucun changement de forfait ni de budget. Rien n'est visible des
utilisateurs. Code : `packages/monitoring/src/products/` (export `@waverti/monitoring/products`).

## Architecture

```
ProductTarget ──► OfferDiscoverySource.discover()   (port : Brave Search plus tard ; ici « simulated »)
                      │  OfferCandidate[]  (titre + extrait + URL : AUCUN prix retenu)
                      ▼
          dedupeCandidates()  (URL canonique : suivi, www, fragment, « / » final)
                      ▼
   compareListings() sur le titre  ── accessoire / autre modèle / variante → écarté sans ouvrir la fiche
                      ▼               titre vague → « non déterminé » (vérifié en dernier, si le budget le permet)
          OfferVerifier.verify()      (port : vérification HTTP réelle plus tard ; budget maxVerifications)
                      ▼  VerifiedOffer (GTIN/MPN, état, prix, devise, stock, frais, vendeur, heure du contrôle)
   assessOffer()  = rapprochement + exigences de la cible (état, devise, livraison en France)
                      ▼
          ComparisonReport : matches · variants · rejected · ineligible · unverifiable · uncertain · sourceErrors
```

| Fichier | Rôle |
| --- | --- |
| `types.ts` | Modèle : `ProductIdentity` (marque, nom, MPN, GTIN, variante, état), `VerifiedOffer` (vendeur, URL, prix + devise, stock, frais, confiance), `ProductTarget`, `MatchResult` |
| `text.ts` | Normalisation du texte, validation/normalisation GTIN (clé de contrôle), MPN, URL canonique |
| `attributes.ts` | Extraction déterministe : capacité, mémoire, taille, couleur, version, état, lot, accessoire, génération, millésime |
| `match.ts` | `compareListings` (deux fiches), `assessOffer` (offre vs cible), `landedPrice` |
| `pipeline.ts` | Ports `OfferDiscoverySource` / `OfferVerifier`, budgets, orchestration, rapport |
| `simulated.ts` | Faux moteur de recherche et faux vérificateur (catalogue de pages fictives, aucun réseau) |

Brancher le réel = écrire deux classes (Brave → `OfferDiscoverySource`, extracteur HTTP existant → `OfferVerifier`) ;
`compareListings`, `assessOffer` et `compareProduct` ne changent pas.

## Règles de rapprochement (ordre d'évaluation)

1. **Accessoire contre produit → `different`** (étui, câble, chargeur, « pour / compatible avec… »). Jamais comparables.
2. **Conflit de marque, de génération (« 11e » ≠ « 12e », millésime), de gamme (Pro, Max, Plus, Ultra, Mini…) ou de
   référence de modèle (iPhone 14 ≠ 15) → `different`.** Exception : un **GTIN valide identique** ne se laisse pas
   écraser par un titre en conflit, mais le verdict tombe à `probable` (confiance ≤ 0,5, motif `identifier_contradiction`).
3. **Preuve d'identité** : GTIN valide identique → confiance 0,97 ; MPN identique avec même marque → 0,93. **`exact` exige
   cette preuve** et l'absence de contradiction. Un GTIN dont la clé de contrôle est fausse est ignoré.
4. **Sans identifiant** : mêmes références distinctives du titre → `probable` (≈ 0,8), jamais `exact`.
5. **Titre insuffisant** (référence ou génération présente d'un seul côté, confiance < 0,55) → `different` avec
   `inconclusive = true` : l'offre est classée « non déterminée », pas « autre produit ».
6. **Variantes** — même modèle mais une caractéristique connue des deux côtés diffère → `variant` (+ dimensions) :
   capacité, mémoire vive, taille, couleur, version (Wi-Fi/Cellular/5G…), quantité (lot de N), contenu (lot avec
   accessoires), **état** (neuf / reconditionné / occasion). Une caractéristique absente d'un seul côté n'est pas une
   différence : elle réduit la confiance (−0,06) et est signalée (`attribute_missing`).
7. **GTIN/MPN différents sur un même modèle apparent** → `variant` (déclinaison commerciale), jamais `exact`.
8. **État** : jamais supposé « neuf ». Un état non indiqué sur la fiche plafonne la confiance à 0,8 et rend le verdict
   `probable` lorsque la cible exige un état (`assessOffer`).

Eligibilité (`assessOffer`) : devise ≠ devise de la cible (v1 : EUR, **aucune conversion**), livraison indiquée impossible
vers la France, prix invalide → l'offre est conservée dans `ineligible` avec ses motifs, hors de la comparaison.

Prix : `bestItemPrice` (prix article) et `bestLandedPrice` (article + livraison, **seulement si les frais sont connus**).
Frais inconnus ≠ 0 : une offre aux frais inconnus ne devient jamais « meilleur prix livré ».

Fiabilité : une fiche bloquée, expirée ou introuvable → `unverifiable` (motif, caractère temporaire) et **aucune** donnée
de prix ou de stock ; elle ne peut pas devenir une « rupture » ou une « baisse ». Une offre plus vieille que
`maxOfferAgeMs` est marquée `stale`. Un vendeur n'apparaît qu'une fois par produit identique (la moins chère).

## Limites connues du lot 1

- Les règles reposent sur le titre et les champs structurés : un titre trompeur ou très pauvre donne « non déterminé ».
- Listes de couleurs, gammes, mots d'accessoires et de catégories : françaises/anglaises, volontairement courtes ; à
  étendre avec des catalogues réels (elles sont testées, pas exhaustives).
- Pas de conversion de devises, pas de calcul de taxes ni de frais de douane, pays de livraison : France seulement.
- Aucun historique par offre ni alerte (lots suivants) ; aucune table ni migration.
- Le « seuil » de confiance (0,55) et les pénalités sont des valeurs de départ, à calibrer sur de vraies fiches.
- Testé uniquement sur des **données fictives** : aucun vrai site, aucun appel à Brave.

---

# Lot 2 — vérificateur HTTP des offres

Code : `packages/monitoring/src/products/verify/` (`HttpOfferVerifier`, implémente `OfferVerifier`). **Aucune découverte
réelle** (pas de Brave, aucun crédit consommé), **aucune interface, alerte ni table**. Testé uniquement sur des boutiques
HTTP locales.

## Ce qui est lu, et d'où

| Donnée | Sources, par ordre de priorité | Si absente ou douteuse |
| --- | --- | --- |
| Nom, marque, modèle, MPN, GTIN, état | JSON-LD (`Product`, `ProductGroup`, `Offer`, `AggregateOffer`, `@graph`) → microdonnées → meta (Open Graph, `product:*`) | inconnu (jamais déduit) |
| Prix + devise | JSON-LD → microdonnées → meta → **texte visible** (dernier recours : un seul prix courant, non barré, devise explicite) | échec `price_not_found` / `unsupported_currency` |
| Disponibilité | JSON-LD → microdonnées / meta | `unknown` (jamais « en stock » par défaut) |
| Frais de livraison | `shippingDetails` **pour la France explicitement**, même devise que le prix | `unknown` (jamais 0) ; `0` explicite = gratuit |
| Variantes (capacité, couleur, taille…) | propriétés déclarées, ajoutées au titre | non renseignées |

Règles : une devise absente n'est **jamais** supposée EUR (« $ » seul est refusé : ambigu) ; un prix ambigu
(« 1.299 », trois décimales, fourchette `AggregateOffer`) est inconnu ; un bloc JSON-LD malformé est ignoré et signalé,
jamais « réparé » ; des sources en désaccord (prix JSON-LD ≠ meta ou texte visible, plusieurs produits distincts, GTIN
différents) → **aucune valeur retenue** (`conflicting_data`, ou GTIN/MPN abandonné avec avertissement) ; plusieurs
variantes à prix différents sans variante désignée par l'adresse (`?variant=`, URL de l'offre, SKU) → `ambiguous_variant`.

## Traçabilité

Chaque `VerifiedOffer` porte `provenance` : adresse demandée et finale, code HTTP, **heure de lecture** (conservée lorsqu'une
réponse vient du cache), source du prix et de chaque champ, avertissements, empreinte SHA-256 des seules données extraites
(change si et seulement si les données changent), `fromCache`, `truncated`. Une offre plus ancienne que `maxOfferAgeMs`
est marquée `stale` : elle reste listée mais **ne peut pas devenir « meilleur prix actuel »**.

## Sécurité et coûts

- Récupération par `safeFetch` (existant) : http/https seulement, ports 80/443/8080/8443, pas d'identifiants dans l'URL,
  résolution DNS validée **à la connexion** (anti-rebinding), adresses privées/locales/métadonnées refusées, redirections
  revalidées une à une (4 max), délais, taille maximale après décompression (1,5 Mo), types de contenu HTML seulement.
- `robots.txt` respecté (erreur ou inaccessible = prudence) ; espacement minimal par site (2 s) ; **aucune protection
  contournée** : page anti-robot / CAPTCHA / 401 / 403 / 429 → `blocked`, rien n'est résolu ni simulé.
- Concurrence globale limitée (4), requêtes simultanées identiques fusionnées, cache à durée limitée (30 min ; échecs 2 min),
  `maxCandidates`, `maxVerifications` et `concurrency` du pipeline. Le cache est derrière l'interface `OutcomeCache`
  (mémoire par processus aujourd'hui ; une version partagée — base ou Redis — sera nécessaire avec plusieurs workers).
- Parcours JSON-LD borné (20 blocs, 500 Ko, 5 000 nœuds, profondeur 10) ; texte visible borné (200 éléments).

## Échecs possibles (`VerificationFailure.reason`)

`not_found`, `blocked`, `timeout`, `server_error`, `network_error`, `too_large`, `unsupported_content`, `unsafe_url`,
`robots_disallowed`, `rate_limited`, `not_a_product_page`, `price_not_found`, `unsupported_currency`, `conflicting_data`,
`ambiguous_variant`, `parse_failed` — avec `transient` (réessayer plus tard ?) et un `detail` non sensible. Aucun échec
n'est jamais traduit en rupture de stock ou en changement de prix.

## Limites du lot 2

- Pages rendues uniquement en JavaScript : non lues (pas de navigateur dans ce lot).
- Place de marché : le vendeur tiers n'est lu que si la fiche le déclare ; liste de places de marché courte.
- Pays de livraison : France ; pas de calcul de taxes ni de douane ; pas de conversion de devises.
- Lecture de texte visible volontairement stricte : des fiches réelles à structure atypique resteront « prix inconnu ».
- Aucun essai sur de vrais sites ni sur la Preview : il reste à calibrer sur des fiches réelles (lot suivant).
