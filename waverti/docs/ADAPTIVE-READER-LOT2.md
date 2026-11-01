# Waverti — lot 2 : fiabilité et précision

## Périmètre

Branche : `codex/extraction-reliability-lot2`, dérivée de la version livrée du lot 1 (`codex/adaptive-reader-lot1`). Les protections HTTP/SSRF et les changements du lecteur adaptatif du lot 1 sont conservés. Le lot Chromium n’est pas inclus.

## Améliorations

- Ajout d’un statut par champ (`verified`, `uncertain`, `unavailable`, `contradictory`) avec sources et date de vérification.
- Extraction des candidats de prix et de leur provenance, sans devise EUR implicite.
- Distinction prix courant, prix régulier/promotion et prix contradictoires ; les offres JSON-LD de variantes ne sont pas arbitrairement fusionnées.
- Les alertes de prix ignorent les valeurs incertaines, les devises incompatibles et les prix contradictoires.
- Disponibilité multilingue avec état inconnu conservé ; une erreur HTTP reste une erreur et ne devient pas une rupture.
- Détection des changements de page basée sur le contenu stable lorsque disponible, pour éviter les alertes dues à une simple enveloppe HTML.
- Compatibilité avec les observations et surveillances historiques : les nouveaux champs sont optionnels et les anciennes observations restent lisibles.

## Fixtures et benchmark

Le benchmark [`RELIABILITY-BENCHMARK.json`](./RELIABILITY-BENCHMARK.json) utilise uniquement des HTML locaux synthétiques : JSON-LD, texte avec devises USD/GBP, promotion, variantes contradictoires, stock multilingue et page incomplète. Aucune collecte de site tiers n’est effectuée.

Dernière mesure : 7 fixtures, 4 prix vérifiés, 2 indisponibles et 1 contradictoire ; aucune divergence attendue. Les scénarios d’alerte montrent qu’un prix incertain ne déclenche pas de baisse, alors qu’un prix devenu vérifié peut déclencher l’alerte, et qu’une modification d’enveloppe HTML à contenu stable ne déclenche pas de changement.

## Vérifications

- Unit : 25 fichiers, 525 tests réussis.
- Typage TypeScript : monitoring, worker et web réussis.
- ESLint ciblé sur l’extraction, la comparaison, les fixtures et le benchmark réussi.
- E2E/intégration complète : à exécuter par la CI avec les services de test ; aucune base de production n’a été utilisée.

## Limites connues

Les sites qui ne publient aucun prix ou devise explicite restent volontairement incertains/indisponibles. Les pages rendues uniquement après interaction navigateur ne sont pas couvertes par ce lot. Le benchmark mesure la décision d’extraction et d’alerte, pas la couverture exhaustive de tous les catalogues réels.

## Livraison

Une Preview sera créée depuis cette branche uniquement. Aucun changement n’est effectué sur Stripe Live, Brave, Neon Production ou Vercel Production. La PR du lot 1 n’est pas fusionnée automatiquement.
