# Refonte interface et expérience utilisateur — 1er novembre 2026

Périmètre : présentation et parcours, **sans changer la logique métier** (API, quotas, règles, facturation inchangés).

## Écrans refondus
| Écran | Avant | Après |
| --- | --- | --- |
| Accueil (`/app`) | 4 tuiles techniques, 6 cartes (alertes, appareil, quotas, résultats, prochaines vérifications) | Bandeau d'accueil coloré + 3 indicateurs, bloc « Nécessite votre attention », « Activité récente » en phrases, « Actions rapides », « Votre formule » (quotas) ; appareils en détail repliable |
| Nouvelle surveillance | Barre d'étapes grise, tuiles blanches | Barre de progression colorée, 3 étapes nommées, tuiles avec icône colorée par type, encart « Ce que vous recevrez » |
| Rechercher un produit (`/app/produits`, **nouveau**) | n'existait pas | Parcours guidé en 3 étapes (produit, critères, résumé) — voir limites |
| Détail d'une surveillance | liste de réglages | 3 repères « en un coup d'œil » (état, dernier et prochain contrôle), « Vous serez prévenu quand… », détails techniques repliés |
| Coque (menu, fond) | fond blanc | fond bleuté avec halos discrets, menu actif en bleu, entrée « Rechercher un produit », « Vue d'ensemble » devient « Accueil » |

## Composants créés (`packages/ui`)
`HeroBanner`, `IconTile`, `StatTile`, `Section`, `Tip`, `StepProgress` (`components/blocks.tsx`) ; `DashboardView`, `attentionItems`,
`activityEntries` (`app/dashboard.tsx`) ; jetons `--color-canvas`, `--shadow-card`, classes `.app-canvas`, `.hero-banner`.
`Card` gagne des coins plus arrondis et une ombre légère. `OverviewView` (application desktop et démonstration du site) est conservé tel quel.

## Simplifications de langage
« Vue d'ensemble » → « Accueil » ; « Règle d'alerte » → « Vous serez prévenu quand… » ; « Réglages » → « Résumé des réglages » ; étapes « Catégorie / Configuration »
→ « Que surveiller ? / Vos réglages » ; « Exécution », zone CSS et date de création passent dans « Détails techniques » (second niveau).

## Vérifications
Typecheck et lint (21/21), 8 tests unitaires du tableau de bord, 645 tests existants, E2E locaux : surveillances, règles, mobile, authentification, site public + accessibilité (33/33).

## Limites
* **Recherche de produit** : le parcours prépare et résume la demande mais **ne lance aucune recherche** (droits Brave non confirmés, aucune donnée enregistrée). Il le dit clairement et propose la surveillance d'une page de boutique.
* Pas de graphique sur l'accueil : l'API ne fournit pas de série temporelle d'alertes ; les quotas servent de repère visuel.
* Autres pages (alertes, historique, abonnement, paramètres, Business, aide) : nouveau fond et cartes arrondies seulement ; textes non réécrits.
* Application desktop non modifiée.
* Pas de mode sombre.
