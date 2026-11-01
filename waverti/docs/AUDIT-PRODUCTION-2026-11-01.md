# Audit des déploiements Production Vercel — 1er novembre 2026

Lecture seule : aucun déploiement, secret ou paramètre n'a été modifié. Source : API Vercel (projet `watchly`,
`prj_jgMEi5CYffPUwx6eY0vDaGXrNXks`) et dépôt Git (`rocket111111152442/milou`).

## 1. Ce qui est en ligne maintenant

* `waverti.com` → redirection 308 → `www.waverti.com`, alias du déploiement **`dpl_AWn1tvXuLpeNEY8mhHauzz52YTzX`**
  (créé 16:52:15 UTC, source **redeploy**), construit à partir du commit **`c429092`** de la branche `claude/upbeat-ritchie-sll5u2`.
* Écart avec la branche de développement (`168b4c1`) : **uniquement le lot 4** (19 fichiers : conformité Brave, catalogue préparé,
  garde-fou du test réel, documents). Aucune autre différence.
* Production = lots 1 à 3 + refonte de la page d'accueil (`3c2ea27`) + page de téléchargement Codex. **Le lot 4 n'est pas en production.**

## 2. Historique des déploiements Production du jour (UTC)

| Heure | Déploiement | Commit / branche | Origine | Commentaire |
| --- | --- | --- | --- | --- |
| 16:09:14 | `dpl_HFhTH…` | `526fb0a` / **`codex/public-downloads`** | redeploy | **Autre branche** ; son arbre diffère de la branche de développement de **133 fichiers (−11 064 lignes)** : il n'a pas l'assistant de règles, ni les lots 1-3. |
| 16:34:15 | `dpl_4eJMU…` | `fb6af4a` (lot 3) / dev | création par API | Déploiement que vous aviez demandé (« deploie tout en production »). |
| 16:44:56 | `dpl_9snP8…` | `3c2ea27` (accueil) / dev | redeploy | **Commit plus ancien que le lot 3** : retour en arrière du code (lots 2-3 absents) pendant ≈ 1 min. |
| 16:45:57 | `dpl_264SR…` | `c429092` / dev | redeploy | |
| 16:52:15 | `dpl_AWn1t…` | `c429092` / dev | redeploy | **Actuel** (doublon du précédent). |

Les déploiements du 31 octobre (`1f95a52`, `d6ff124`, `1e48dd9`, `3c0871e`, `3e821a5`, `99e29d0`) sont tous sur la branche de
développement. Tous les commits en production, hors `526fb0a`, sont des ancêtres de la branche de développement.

## 3. Modifications inattendues

1. **`526fb0a` (branche `codex/public-downloads`) a été promu en Production à 16:09 UTC** — pendant ≈ 25 minutes, `waverti.com`
   servait une version sans plusieurs fonctions (assistant de règles, découverte de produits…). Ce n'est pas moi : je n'ai fait
   qu'**un** déploiement Production (16:34, lot 3, à votre demande).
2. **Trois « redeploy » en Production (16:44, 16:45, 16:52)** que je n'ai pas lancés dans cette session. Je ne peux pas dire qui les a
   faits : Vercel affiche le même compte (`lullinismael2-9456`) pour toutes les actions passant par ce jeton, y compris les miennes.
   Le premier a fait **revenir la production à un code antérieur au lot 3** pendant ≈ 1 minute.
3. **La Production n'a pas le code du lot 4** alors que la variable `BRAVE_API_KEY` y est définie (voir §5).

## 4. Mécanismes de déploiement automatique

* **Poussée Git → Preview uniquement** (constaté : tous les déploiements issus de Git ont `target = null`). Aucune poussée n'a créé de
  Production. Les Productions sont toutes des « redeploy » ou des créations par API (manuelles).
* **Cinq projets Vercel sont reliés au même dépôt** `milou` : `watchly` (Waverti), `petrin-de-pepiole`, `biorythme`, `acorimmo`,
  `empreinte-de-violettes`. Les quatre autres **échouent à chaque poussée** (applications sans rapport avec Waverti) : bruit et
  consommation de minutes de build, risque de confusion.
* **Non vérifiable avec les outils disponibles** : la *Production Branch* du projet, le *Root Directory*, les *Ignored Build Step* et
  « Auto-assign domains ». La branche par défaut du dépôt est `main`, qui contient une **autre application** (corrections Firestore)
  et 76 commits de moins que la branche de développement. **Si la Production Branch de `watchly` était `main`, une poussée sur `main`
  déploierait cette autre application sur `waverti.com`.** Rien ne l'indique dans l'historique, mais ce n'est pas démontré.
* Les migrations de base s'exécutent **à chaque build Production** (`deploy-migrate.ts`, dossier `db/migrations/` seulement).
  `db/migrations-pending/` n'est lu par aucun déploiement (vérifié par test).
* Un redeploy d'un ancien commit réexécute les migrations de **ce** commit : sans danger ici (migrations additives), mais le code ancien
  tourne contre un schéma plus récent.

## 5. Brave en Production

* `BRAVE_API_KEY` (ancien nom, sensible) existe en **Production** ; `WAVERTI_BRAVE_STORAGE_RIGHTS` **n'existe nulle part** (droits de stockage
  désactivés, comme demandé).
* **Mais le code en Production (`c429092`) ne contient pas la neutralisation du lot 4** : si des recherches de sujets y tournent, elles
  **conservent encore** titres, extraits et adresses Brave (cache, éléments déjà vus, résultats, alertes, e-mails). L'inscription y est
  **ouverte** (`WAVERTI_SIGNUP_MODE=open`) et l'accès bêta donne `pro:30` : il peut donc y avoir de vrais utilisateurs.
* Inconnu : où tourne le worker de production (aucun déploiement de worker visible dans Vercel) et donc si des appels Brave ont lieu.
  Aucune clé Stripe en Production (seulement en Preview).

## 6. Données existantes à effacer ou anonymiser (aucune suppression faite)

Inventaire en lecture seule : `docs/sql/brave-inventaire-lecture-seule.sql` (transaction `read only`, compteurs uniquement). Je n'ai pas
d'accès à la base de Production et n'en ai pas demandé : l'exécution est à votre main ou sur votre accord explicite.

| Donnée | Table / colonne | Contenu Brave | Action sans droits | Réversible ? |
| --- | --- | --- | --- | --- |
| Cache de recherche | `search_cache` (`query`, `results`) | texte de requête, titres, extraits, adresses | supprimer | non (cache reconstructible, mais il faut un droit pour le refaire) |
| Éléments déjà vus | `monitoring_seen_items.url`, `.title` | adresse, titre | vider (le hachage de déduplication reste) | non |
| Résultats | `monitoring_results.observation.findings`, `.change_summary` | titres, extraits, adresses, domaines | masquer | non |
| Alertes | `notifications` (`title`, `body`, `source_url`, type `web_topic`) | texte lu par l'abonné | **décision du propriétaire** | non |
| E-mails envoyés | `email_outbox` (`subject`, `payload`) | idem | **décision du propriétaire** | non |
| E-mails en attente | `email_outbox` status `pending/sending` | idem | traiter **avant** l'envoi | oui tant qu'ils ne sont pas partis |
| Métadonnées | `provider_requests` | aucune (compteurs, coûts, statut) ; `error` peut citer un message fournisseur | conserver, vérifier `error` | — |
| Sauvegardes | sauvegardes Neon / hors site | copies de tout ce qui précède | **non traité** : dépend de la durée de rétention de l'hébergeur | — |

Ce que je n'ai **pas** pu vérifier : l'existence d'autres copies (journaux d'application Vercel, sauvegardes Neon, exports) ; si les
données de la Production contiennent réellement des résultats Brave.
La fonction `enforceBraveStoragePolicy` (testée) fait les suppressions ci-dessus, avec `dryRun` (comptage) et `scrubHistory` séparé
(alertes et e-mails). Elle s'exécute dans la maintenance du worker **de la version du lot 4 seulement**.

## 7. Risques classés

| # | Risque | Gravité | Probabilité | Action recommandée (à votre accord) |
| --- | --- | --- | --- | --- |
| 1 | Production conserve encore des résultats Brave (code sans lot 4) → non-conformité §3(b)(i) | élevée | probable si des recherches de sujets tournent | Soit déployer le lot 4 en Production (**interdit pour l'instant**), soit retirer `BRAVE_API_KEY` de la Production tant que les droits manquent. Mesurer d'abord avec l'inventaire SQL. |
| 2 | Production Branch du projet non vérifiée ; `main` = autre application | élevée | faible | Vérifier dans Vercel → Settings → Git ; la fixer sur une branche dédiée ; protéger la branche. |
| 3 | Promotions Production par un autre agent/personne (Codex) sans validation ; régressions temporaires constatées | moyenne | avérée | Un seul propriétaire des promotions ; désactiver ou restreindre le jeton utilisé par Codex ; exiger une approbation. |
| 4 | Quatre projets Vercel étrangers reliés au même dépôt échouent à chaque poussée | faible | avérée | Les déconnecter du dépôt ou ajouter une règle « Ignored Build Step ». |
| 5 | Inscriptions ouvertes + accès bêta Pro 30 jours + Brave actif sans stockage autorisé | moyenne | possible | Décider si le lancement ouvert est voulu avant d'avoir les droits Brave. |
| 6 | Historique d'alertes/e-mails contenant des contenus Brave | moyenne | probable | Décision sur `scrubHistory` après lecture de l'inventaire. |
| 7 | Garde-fou budgétaire sous-estimé si un plan avec stockage était pris sans mise à jour des coûts | moyenne | conditionnelle | Voir `docs/SIMULATIONS-BRAVE-STOCKAGE.md` §3. |
| 8 | Sauvegardes contenant des données Brave | à évaluer | inconnue | Demander à Brave si l'effacement des sauvegardes est exigé. |

## 8. Actions recommandées, dans l'ordre

1. Lancer `docs/sql/brave-inventaire-lecture-seule.sql` sur la Production (ou m'autoriser à le faire avec un accès en lecture seule).
2. Vérifier dans le tableau de bord Vercel la *Production Branch* et les réglages Git de `watchly`.
3. Décider du risque n°1 : retrait temporaire de `BRAVE_API_KEY` en Production, ou déploiement du lot 4 (après vos accords).
4. Décider de `scrubHistory` et de la purge des e-mails en attente.
5. Encadrer qui peut promouvoir en Production (Codex compris).
6. Envoyer le message au support Brave ; ne rien activer avant sa réponse écrite.
