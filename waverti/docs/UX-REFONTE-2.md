# Refonte UX/UI n°2 — 1er novembre 2026 (branche `claude/waverti-ux-refonte`)

Périmètre : présentation et parcours uniquement. Aucune logique métier, API, quota, prix, droit ou règle d'essai modifié.

## Ce qui change
| Zone | Avant | Après |
| --- | --- | --- |
| Menu latéral (web) | Blanc | Indigo profond à reflets colorés, entrée active en pastille blanche, pastille rose pour les alertes non lues, mention « Bientôt » sur la recherche de produit |
| Fond de l'espace connecté | Bleu très pâle | Lavis de bleu, violet et cyan (fixe au défilement) |
| Cartes (`Card`, `Section`) | Blanc opaque | Verre translucide sur le fond coloré + barre d'accent colorée selon la section |
| Indicateurs de l'accueil | Pastilles pâles sur blanc | Cartes teintées + icônes pleines en dégradé |
| Accueil | Hero + indicateurs | + bloc « Pour bien démarrer » (3 gestes), affiché tant qu'il n'y a ni surveillance ni premier contrôle ; actions rapides colorées |
| Création | Tuiles blanches | 10 tuiles teintées (bleu, violet, vert, ambre, rose) à icône pleine |
| Liste des surveillances | Tableau blanc | Cartes avec liseré d'état (en plus du libellé), icône pleine, valeur en pastille |
| Alertes | Liste blanche | Cartes ; non lues : fond teinté + liseré bleu ; icône pleine selon le type |
| Mobile | Menu « hamburger » seul | + barre d'onglets en bas (Accueil, Surveillances, Créer, Alertes avec compteur) |
| Texte secondaire | `#6b6b79` | `#4f4f62` (5,97:1 sur le fond coloré ; l'ancien gris y tombait à ≈ 4,0:1) |

## Choix à connaître
* **Recherche de produit** : la page ne lance aucune recherche (droits Brave non confirmés). Elle n'est donc plus mise en avant : retirée du bandeau et des actions rapides de l'accueil, conservée dans le menu avec « Bientôt ». Elle n'a pas été redessinée. Pour la remettre en avant : passer `productSearchHref` à `DashboardView`.
* **« Pour bien démarrer »** : étapes 1 et 2 calculées à partir des données réelles (surveillances, contrôles) ; l'étape 3 (notifications) n'a pas d'état connu, elle n'est jamais « cochée ».
* **Desktop** : la coque de l'application desktop reste inchangée (`variant="default"`). Les cartes `Card` y deviennent légèrement translucides.
* **Non traité** : états de chargement (`loading.tsx`) et d'erreur (`error.tsx`) existants conservés tels quels ; pages Historique, Abonnement, Paramètres, Aide, Business et détail d'une surveillance : seuls le fond, les cartes et le menu changent (pas de réécriture de contenu).

## Vérifications
Typage et lint : réussis. Tests unitaires et d'intégration : 658 réussis, 3 ignorés. E2E (surveillances, règles, mobile, site public, abonnement, sécurité) : 35/35 sur une base locale jetable. E2E non lancés : ceux qui exigent Mailpit ou stripe-mock (inscription par e-mail, Checkout), non disponibles ici.
Contrastes calculés (WCAG) : texte sur fonds teintés ≥ 5,9:1 ; icônes pleines (éléments graphiques) ≥ 3,8:1.
Aucun test d'accessibilité automatisé (axe) n'a été exécuté sur les nouvelles pages ; le clavier et le lecteur d'écran n'ont pas été testés à la main.

## Captures
`docs/captures/refonte-2/avant` et `apres` (ordinateur 1366 px et téléphone 412 px). Données : base locale jetable, comptes et surveillances « (test) » créés par `apps/web/e2e/captures.spec.ts` ; aucune donnée réelle. Les captures « pleine page » montrent le menu fixe et la barre d'onglets à une position intermédiaire : c'est un effet de la capture, pas de l'interface.
