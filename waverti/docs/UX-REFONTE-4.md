# Refonte UX n°4 — accueil public, compte sans formule, paramètres, animation d'achat (4 novembre 2026)

Présentation et parcours uniquement. Aucune logique de facturation, de migration ni de moteur de surveillance modifiée.
Seul ajout côté serveur : `DELETE /api/account/sessions` (ferme les autres sessions du compte ; même origine, compte connecté, limité à 10 appels/h).

## 1. Compte sans formule : accueil complet, sans menu
* Un compte **sans formule, sans essai et sans accès bêta** n'a plus de menu (ni barre latérale, ni onglets mobiles) : uniquement le logo et le **menu du compte**
  (Choisir une formule, Paramètres, Aide, **Changer de compte**, Déconnexion). Les administrateurs ne sont jamais verrouillés.
* Page d'accueil de ce compte (`/app/abonnement`) : bandeau « Bienvenue » avec visuel radar animé, **mode d'emploi en 4 étapes**, les **10 types de surveillance à débloquer**
  (+ « Rechercher un produit » : *Bientôt*), choix de la formule (essai de 3 jours si le compte y a droit, textes de facturation inchangés), comparatif détaillé des formules
  (valeurs du catalogue) et questions fréquentes.
* Pages accessibles sans formule : Abonnement, Paramètres, Aide, liaison d'appareil. Toute autre page `/app/...` renvoie vers `/app/abonnement?bienvenue=1`.
  Dès qu'une formule, un essai ou un accès bêta est actif, le menu complet apparaît.
* **Conséquence à connaître** : un ancien abonné dont l'abonnement est terminé (sans droit en cours) voit lui aussi cet écran jusqu'à ce qu'il se réabonne ; ses données ne sont pas supprimées.
* Garde côté interface : les API refusent déjà toute action sans droit (inchangé).

## 2. Animation d'achat validé (motion design)
Après un retour de paiement **vérifié par le serveur** : « Achat validé ! », coche animée, confettis, durée de l'essai, date de fin réelle, rappel e-mail ~24 h avant la fin, bouton « Découvrir Waverti ».
Une seule fois par achat, Échap pour fermer, focus géré, aucun confetti en mouvement réduit. Aperçu de recette : `/app/abonnement/apercu-achat` (404 en Production et hors `WAVERTI_BILLING_TEST_TOOLS=1`).
Page Abonnement d'un compte en essai : déroulé de l'essai en trois temps (calculé depuis la date réelle).

## 3. Paramètres refondus
Sommaire par sections (Compte, Formule, Notifications, Apparence, Sécurité, Appareils, Confidentialité), bandeau de profil avec **score de sécurité** réel (e-mail confirmé, mot de passe, double authentification).
Nouveautés réelles : **Apparence et accessibilité** (animations réduites, texte agrandi, contraste renforcé : enregistrés dans le navigateur), **sessions ouvertes** (liste + « fermer les autres »),
dates de modification du mot de passe et d'inscription, liens vers les documents légaux.
**Retiré à votre demande : le bouton « Exporter mes données ».** La route `/api/account/export` reste en place et testée.
⚠ La FAQ publique, la page Assistance et la politique de confidentialité indiquent toujours que l'export se fait « depuis vos paramètres » : à mettre en cohérence (droit d'accès / portabilité RGPD) — décision à prendre.
Non ajoutés faute de fonctionnement réel côté serveur (pas de faux réglages) : heures calmes, résumé hebdomadaire par e-mail, choix du canal par type d'alerte, changement d'adresse e-mail, thème sombre.

## 4. Page d'accueil publique
Nouvelle identité « sentinelle » : scène sombre avec **radar animé** (des points = pages surveillées, le faisceau les balaie, une alerte d'exemple apparaît), bandeau défilant des types de surveillance réels,
démonstration interactive conservée (« Exemple de fonctionnement »), étapes éditoriales à numéros géants, usages en grille asymétrique (courbe de prix animée), scène Business avec ligne de pouls, formule Pro en carte sombre, dernier appel à l'action.
Tous les textes, titres, liens et prix vérifiés par les tests existants sont conservés. Les visuels animés sont décoratifs (masqués aux lecteurs d'écran) et étiquetés « Illustration ».
Pas de vidéo : aucune vidéo n'a été produite (animations CSS/SVG et Motion uniquement).

## Tests
Typage, lint, unitaires et intégration : réussis (667, 3 ignorés). E2E web locaux (monitors, rules, responsive, landing, billing-page, security, business, admin, pwa, app-a11y, account-gate) : 52 réussis, 1 échec (débordement des Paramètres sur téléphone) corrigé puis relancé : account-gate, app-a11y et responsive 13/13. Nouveau fichier : `account-gate.spec.ts` (verrouillage, changer de compte, menu avec formule, API sessions, axe ordinateur/téléphone, paramètres, sessions réelles à deux navigateurs, animation d'achat).
Défauts trouvés et corrigés par ces tests : tableau comparatif non atteignable au clavier sur téléphone ; débordement horizontal de la page Paramètres sur téléphone.
Non exécutables localement (Mailpit et stripe-mock refusés par la session) : `auth.spec`, `billing.spec` — validés par la CI GitHub.

## Captures
`docs/captures/refonte-4/apres` (ordinateur 1366 px, téléphone 412 px). Données : base locale jetable.
