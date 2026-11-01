# Refonte UX/UI n°3 — 1er novembre 2026 (branche `claude/waverti-ux-refonte`)

Présentation et parcours uniquement : aucune logique de facturation, de migration ni de moteur de surveillance modifiée
(vérifié : aucun fichier de `billing`, `database`, `monitoring/src`, `db/migrations` dans la différence avec la branche de développement).
Base : rebase sur `337791a` (même commit que `release/waverti`), sans conflit.

## Assistant de création en 5 étapes
1. **Que souhaitez-vous surveiller ?** (10 types, ou phrase libre ; les types non inclus dans la formule affichent « Non inclus dans votre formule »)
2. **Quel site ou quel produit ?** adresse + « Vérifier la page » (titre, prix et éléments repérés), ou sujet à suivre pour les recherches Internet
3. **Quel changement souhaitez-vous détecter ?** objectifs en langage courant, condition, idées proposées pour la page ; **Options avancées** : zone précise de la page, sélecteur CSS, exclusions et fiabilité, groupes ET/OU
4. **Comment souhaitez-vous être prévenu ?** dans Waverti (toujours), e-mail (si la formule l'inclut), ordinateur (application installée) ; **Options avancées** : fréquence
5. **Vérifier et activer** : résumé, nom, bouton « Activer la surveillance »

Honnêteté des états : les options de l'offre Business restent configurées dans l'espace Business (l'assistant le dit au lieu de les créer) ; une page illisible n'empêche pas de continuer (message clair) ; la recherche de produit reste « Bientôt » (elle ne lance aucune recherche).
Correctif : arriver avec `?categorie=…` présélectionne maintenant l'objectif par défaut (avant, aucun objectif n'était choisi).

## Tableau de bord et navigation
Bloc « Pour bien démarrer » (étapes calculées sur données réelles), « Prochaines vérifications » en évidence, actions rapides colorées, barre d'onglets mobile (Accueil, Surveillances, Créer, Alertes), erreur de page plus utile (rassure, bouton Réessayer, retour à l'accueil), chargement annoncé aux lecteurs d'écran.
Pages Historique, Alertes, Détail, Abonnement, Paramètres, Aide : nouveau fond, cartes, en-têtes ; **aucun texte de facturation modifié**.

## Tests (état au dernier commit)
| Contrôle | Résultat |
| --- | --- |
| Typage, lint (tous les paquets) | réussis |
| Unitaires + intégration | 667 réussis, 3 ignorés |
| Build web, build desktop (tsc + vite) | réussis |
| E2E web (surveillances, règles/assistant, mobile, site public, abonnement, sécurité, accessibilité) | 39/39 |
| Accessibilité automatisée (axe WCAG 2.1 AA, ordinateur + téléphone, 5 étapes de l'assistant + écrans principaux) | aucune violation critique/grave |
| Clavier (lien d'évitement, assistant complet sans souris, focus sur le titre de chaque étape, barre d'onglets) | réussi |
| E2E desktop (binaire Tauri) | **non exécutés** : `tauri-driver` et `WebKitWebDriver` absents de cet environnement |
| Inscription par e-mail, Checkout Stripe TEST | **non exécutés** ici (Mailpit/stripe-mock absents) |

Limites : axe ne peut pas calculer le contraste sur fonds translucides (il le classe « à vérifier », pas « violation ») ; les contrastes ont été calculés à la main (voir `styles.css`). Aucun test avec lecteur d'écran réel ni appareil mobile réel.

## Captures
`docs/captures/refonte-3/avant` (état de `release/waverti`) et `apres`, ordinateur 1366 px et téléphone 412 px ; assistant `20`–`23` (n'existe qu'après). Base locale jetable, données « (test) » créées par `apps/web/e2e/captures.spec.ts`.
Sur les captures pleine page, menu et barre d'onglets fixes apparaissent à une position intermédiaire : effet de la capture.
