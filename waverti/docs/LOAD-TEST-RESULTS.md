# Résultats des tests de charge

Généré par `pnpm test:load` sur la machine de test (PostgreSQL local, serveurs HTTP locaux, Chromium local).
Ces chiffres décrivent l'environnement de test ; ils ne constituent pas une garantie de performance en production.

<!-- section:business -->
## Moteur Business — contrôles HTTP

Mesuré le 2026-10-29T14:57:56.307Z (linux, Node v22.22.0).

- Configuration : 30 clients × 3 points de contrôle = 90 points, 3 workers concurrents (concurrence 16 chacun), 40 tours où tous les points sont dus simultanément.
- Contrôles HTTP réels effectués : 3600 (requêtes reçues par le serveur de test : 3600).
- Durée : 15.6 s, soit 230 contrôles/s (incluant l'écriture en base de chaque résultat).
- Latence HTTP : médiane 26 ms, p95 186 ms, max 246 ms (dont 1/3 de points volontairement lents à ~150 ms).
- Contrôles en double dans un même tour : 0 (attendu : 0).
- Incidents : 3 ouverts pour 3 points en panne (attendu : un par point en panne, aucun faux positif).
- CPU du processus de test : 8.0 s ; mémoire résidente maximale : 172 Mo.
- Besoin réel à 30 clients Business (90 points toutes les 60 s) : 1,5 contrôle/s, soit 0.7 % du débit mesuré ici.

## Scénarios navigateur

- 6 scénarios lancés simultanément, pool limité à 2 navigateurs actifs (maximum observé : 2).
- Durée totale : 1.4 s ; durée par scénario : médiane 990 ms, max 1358 ms.
- Mémoire résidente du processus de test (hors processus Chromium) : +34 Mo.
- Besoin réel à 30 clients Business (1 scénario toutes les 2 h chacun) : 15 scénarios/heure.

<!-- /section:business -->

<!-- section:pages -->
## Moteur A — file hybride des surveillances de pages

Mesuré le 2026-10-29T14:58:36.036Z (linux, Node v22.22.0).

- 300 comptes Pro × 5 pages = 1500 surveillances dues au même instant, 50 sites distincts, 4 workers « serveur » (concurrence 8).
- Planification de toutes les tâches : 822 ms.
- Traitement complet (réservation, robots.txt, HTTP, extraction, résultat) : 30.2 s, soit 50 contrôles/s, limité volontairement par l'espacement d'1 s entre deux requêtes vers un même site.
- Résultats : 1500 enregistrés, 0 erreurs, 0 tâche contrôlée deux fois ; requêtes HTTP reçues par les sites : 1550 (robots.txt inclus, page_cache mutualisé).
- CPU du processus de test : 7.6 s ; mémoire résidente maximale : 172 Mo.
<!-- /section:pages -->
