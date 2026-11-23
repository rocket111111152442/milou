# Tests

## Lancer

```bash
createdb antonio_test     # rôle et mot de passe : voir server/vitest.config.ts ou TEST_DATABASE_URL
```

```bash
npm test
```

La base de test est remise à zéro puis migrée avec les migrations versionnées à chaque exécution. Le parcours visuel : `npm run dev`, puis `node scripts/ui-smoke.cjs` (Playwright, captures dans `screenshots/`).

## Résultat au 23/11/2026

`npm test` : **41 tests réussis sur 41** (2 fichiers, ≈ 5 s), sur PostgreSQL 16.
Typecheck serveur et interface : sans erreur. Build de production : vérifié (`node server/dist/index.js` sert l'API et l'interface).
Parcours Playwright (ordinateur 1360×860 et iPhone 13) : inscription, onboarding complet, point du jour, mail de Sophie, créneaux jeudi après-midi, validation orale, e-mail piégé, connexions, agenda ; aucune erreur console, pas de défilement horizontal sur mobile.

## Correspondance avec les critères d'acceptation

Légende : ✅ automatisé et réussi · 🟡 partiellement vérifié · ⛔ non exécutable ici (dépend d'identifiants ou de matériel absents).

| # | Critère | Statut | Où / comment |
| --- | --- | --- | --- |
| 1 | Création de compte et profil | ✅ | `acceptance.test.ts` « 1. » + parcours Playwright |
| 2 | Connexion réelle messagerie + calendrier | ⛔ | Aucun identifiant OAuth ni compte de test fourni. Requêtes et interprétation des réponses testées contre des réponses simulées (`connectors.test.ts`). Procédure ci-dessous |
| 3 | Lecture des données du bon compte | ✅ | « 3. » (démo) ; les requêtes filtrent par utilisateur et organisation |
| 4 | Briefing fondé sur les données récupérées | ✅ | « 4. » : sources, période, non-répétition des actions déjà présentées |
| 5 | Création d'un brouillon | ✅ | « 5–6. » (démo) |
| 6 | Validation puis envoi unique | ✅ | « 5–6. » : validation liée à l'empreinte, double validation refusée, ré-exécution sans effet, un seul message envoyé |
| 7 | Réponse automatique selon une règle approuvée | ✅ | « 7–8. » |
| 8 | Demande hors périmètre mise en attente | ✅ | « 7–8. » (modification de prix) |
| 9 | Rendez-vous sans conflit | ✅ | « 9. » (création + détection de conflit) ; idempotence Google (409) et Graph (`transactionId`) dans `connectors.test.ts` |
| 10 | Événement reçu plusieurs fois | ✅ | « 10. » : 3 livraisons simultanées → 1 action, 1 envoi ; déduplication des webhooks |
| 11 | Corbeille et restauration | ✅ | « 11. » ; un envoi n'est pas présenté comme annulable |
| 12 | Révocation | ✅ | « 12. » (démo) ; la révocation côté Google est un appel simple non exécuté ici |
| 13 | Voix : conversation, interruption, transcription | 🟡 | Délégation, limites de durée et facturation testées côté serveur ; la session WebRTC GPT-Live, l'interruption et la veille locale n'ont pas pu être essayées (pas de clé OpenAI, pas de micro, Chromium sans service de reconnaissance locale) |
| 14 | Actualisation cohérente des panneaux | 🟡 | Vérifiée visuellement (Playwright) ; les statuts affichés sont relus depuis le serveur (SSE + rafraîchissement) ; pas de test automatisé dédié |
| 15 | Instructions malveillantes dans un e-mail | ✅ | « 15. » : signalement, contenu encadré, destinataire inconnu bloquant, validation et règle impossibles sans consentement explicite |
| 16 | Isolation entre utilisateurs | ✅ | « 16. » : lecture, validation, révocation et action croisée refusées |
| 17 | Échec ou résultat incertain | ✅ | « 17. » : coupure après envoi → vérifié réussi sans doublon ; coupure avant envoi → échec déclaré sans renvoi |
| 18 | Limites de consommation | ✅ | « 18. » : bascule sans IA, voix refusée, session vocale fermée, limite d'actions automatiques |

Le scénario de la vision produit (point → mail de Sophie → créneau jeudi après-midi → plus court → pourquoi → oui → dossiers en attente) est automatisé avec le moteur sans IA. **Avec `gpt-6-luna`, la qualité des réponses n'a pas été évaluée** (pas de clé) : à faire avec des scénarios réels avant toute mise en production.

## Procédure d'essai sur de vrais comptes (critère 2 et suivants)

1. Créer des comptes de test dédiés (une adresse Gmail et une Outlook) et les ajouter comme utilisateurs de test des applications OAuth.
2. Renseigner `TEST_RECIPIENT_ALLOWLIST` avec ces seules adresses : tout envoi vers une autre adresse est refusé par le serveur.
3. Connecter chaque compte avec toutes les capacités, puis vérifier dans **Connexions** : capacités affichées = scopes accordés, dernière synchronisation renseignée.
4. Depuis un compte, écrire à l'autre ; vérifier l'apparition du message (synchronisation ou webhook), son classement et son explication.
5. Rejouer : brouillon, réponse validée (vérifier un seul envoi dans « Envoyés »), règle avec modèle approuvé, rendez-vous (invitation reçue côté destinataire, statut « en attente de réponse »), corbeille et restauration, révocation (Google : l'accès disparaît de https://myaccount.google.com/permissions).
6. Couper le réseau pendant un envoi (ou arrêter le worker) et vérifier l'état « incertain » puis sa résolution.
