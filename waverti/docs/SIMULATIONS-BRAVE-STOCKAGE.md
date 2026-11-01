# Simulations de rentabilité — Brave avec droits de stockage (26 $ et 45 $ / 1 000 requêtes)

> **Ces deux tarifs ne sont PAS confirmés.** Ils n'ont pas pu être vérifiés sur la page officielle de Brave (hôte inaccessible
> depuis l'environnement de développement). Ce sont des hypothèses de travail, à remplacer par la réponse écrite de Brave
> (message prêt dans `docs/BRAVE-CONFORMITE.md`). Rien n'est activé : `WAVERTI_BRAVE_STORAGE_RIGHTS` reste absent.

## Hypothèses (identiques à `docs/COUTS.md`, sauf mention)

* Volumes : recherches Brave au **maximum des quotas** (Plus 93, Pro 620, Max 1 240, Business 620 par mois).
* Prix TTC → HT : ÷ 1,2 (TVA à confirmer). E-mails, CPU et Stripe repris de `docs/COUTS.md`.
* **Change : 1 $ = 0,92 €** (hypothèse non vérifiée ; le taux réel déplace tous les chiffres en proportion).
* Le tarif s'applique à **chaque** requête (le tarif avec stockage remplace le tarif sans stockage ; non confirmé).
* « Partage de cache 50 % » : la moitié des recherches est servie par le cache partagé, ce qui **suppose** que le contrat autorise
  le cache (question 2 du message à Brave). Sans cela, le cas pertinent est « sans partage ».
* La référence « 5 $ / 1 000 » est la valeur actuellement configurée (`cost.brave_request_usd_micros` = 5 000), elle-même non vérifiée.
* Marges **avant** coûts fixes (serveur, Vercel Pro, impôts, frais généraux).

## Coût variable maximal et marge brute HT par abonné et par mois — sans partage de cache

| Formule (TTC) | Brave 5 $ | Brave 26 $ | Brave 45 $ | Marge à 5 $ | **Marge à 26 $** | **Marge à 45 $** |
| --- | --- | --- | --- | --- | --- | --- |
| Plus 5,99 € | 0,43 € | 2,22 € | 3,85 € | 4,20 € (84 %) | **2,41 € (48 %)** | **0,78 € (16 %)** |
| Pro 14,99 € | 2,85 € | 14,83 € | 25,67 € | 9,13 € (73 %) | **−2,85 € (−23 %)** | **−13,69 € (−110 %)** |
| Max 29,99 € | 5,70 € | 29,66 € | 51,34 € | 18,51 € (74 %) | **−5,45 € (−22 %)** | **−27,12 € (−109 %)** |
| Business 39,99 € | 2,85 € | 14,83 € | 25,67 € | 28,78 € (86 %) | **16,80 € (50 %)** | **5,97 € (18 %)** |

## Avec 50 % de requêtes servies par un cache partagé (si le contrat l'autorise)

| Formule | Marge à 26 $ | Marge à 45 $ |
| --- | --- | --- |
| Plus | 3,52 € (71 %) | 2,71 € (54 %) |
| Pro | 4,57 € (37 %) | **−0,85 € (−7 %)** |
| Max | 9,38 € (38 %) | **−1,46 € (−6 %)** |
| Business | 24,22 € (73 %) | 18,80 € (56 %) |

## Nombre de recherches par mois à partir duquel un abonné devient déficitaire (marge brute = 0)

| Formule | à 5 $ | à 26 $ | à 45 $ | Quota actuel |
| --- | --- | --- | --- | --- |
| Plus | ≈ 1 007 | ≈ 194 | ≈ 112 | 93 |
| Pro | ≈ 2 605 | ≈ 501 | ≈ 289 | 620 |
| Max | ≈ 5 263 | ≈ 1 012 | ≈ 585 | 1 240 |
| Business | ≈ 6 877 | ≈ 1 323 | ≈ 764 | 620 |

## Enseignements (non flatteurs, mais exacts)

1. **À 26 $ : Pro et Max sont déficitaires au maximum de leurs quotas** (−2,85 € et −5,45 € par abonné et par mois) ; à 45 $ la perte
   dépasse 100 % du prix HT de ces deux formules. Seules Plus et Business restent positives.
2. Ce sont des **cas extrêmes** (quota consommé à 100 %). L'usage réel est inconnu : aucune facture ni mesure d'usage en production
   n'a été analysée. Le seuil de déficit (tableau 3) est plus parlant que le pire cas : Pro atteint le seuil à ≈ 500 recherches
   (81 % du quota) à 26 $.
3. **Plafond global actuel (50 $ / mois)** : à 5 $ il autorise 10 000 requêtes ; à 26 $ seulement ≈ 1 923 ; à 45 $ ≈ 1 111, soit
   moins que le quota d'**un seul** abonné Max (1 240). Si un plan avec stockage était souscrit, il faudrait **mettre à jour**
   `cost.brave_request_usd_micros` (26 000 ou 45 000) **et** le plafond mensuel, sinon le garde-fou sous-estime le coût réel.
4. À 1 000 abonnés Max au maximum, la facture Brave serait ≈ 6 200 $ (5 $), ≈ 32 240 $ (26 $) ou ≈ 55 800 $ (45 $) par mois.
5. Leviers possibles (aucun appliqué) : réduire les quotas de recherches de Pro/Max, relever les prix, ne payer le tarif de
   stockage que si le droit est réellement nécessaire (par ex. rester sans stockage et ne conserver que des empreintes — option
   actuelle, sans surcoût), cache partagé si autorisé.
6. **Option actuelle sans stockage** : aucune dépense supplémentaire ; le produit fonctionne (alertes par empreinte) mais l'historique
   affiche « détail non conservé » pour les recherches de sujets.

Calcul reproductible : marge = prix TTC / 1,2 − (recherches × (1 − partage) × tarif / 1 000 × 0,92 + e-mails + CPU + Stripe).
