# Coûts d'exploitation par formule (quotas utilisés à 100 %)

État au 31 octobre 2026. **Aucune facture réelle n'est encore disponible** : les montants ci-dessous combinent
des mesures (tests de charge, `docs/LOAD-TEST-RESULTS.md`) et des tarifs unitaires configurés dans
`app_settings`, à rapprocher des factures des fournisseurs (saisie dans Administration → Coûts).

## Hypothèses

| Élément | Valeur retenue | Origine |
| --- | --- | --- |
| Brave Search | 5 € / 1 000 requêtes (`cost.brave_search_call_micros` = 5000) | Tarif configuré, **à vérifier** sur le tableau de bord Brave (le crédit mensuel offert par Brave réduit ce coût). |
| E-mail | 0,0004 € / e-mail (`cost.email_micros`) | Resend Pro (≈ 20 $ / 50 000). Gratuit jusqu'à 3 000 / mois **et 100 / jour** sur l'offre gratuite. |
| Contrôle de page (serveur) | ≈ 5 ms de CPU | **Mesuré** : 7,6 s de CPU pour 1 500 contrôles complets. |
| Contrôle HTTP Business | ≈ 2,2 ms de CPU | **Mesuré** : 8,0 s de CPU pour 3 600 contrôles. |
| Scénario navigateur | ≈ 1 s (médiane), CPU de Chromium non mesuré, estimé 2 s | Mesure partielle (durée), estimation (CPU). |
| Serveur du worker + base | ≈ 15 € / mois (VPS 4 vCPU / 8 Go) | Estimation, non souscrit. ≈ 0,0001 € par minute de CPU. |
| Stripe | 1,5 % + 0,25 € par paiement (cartes de l'EEE) | Grille publique standard de Stripe, à confirmer sur le compte. |
| TVA | prix affichés TTC ; HT = TTC / 1,2 si LULLIN WEB facture la TVA | **À confirmer** (franchise en base ou non). |
| IA | 0 € | Aucun appel d'IA n'est effectué par le logiciel actuel. |

Mois de 31 jours (cas le plus coûteux). Aucun partage de cache Brave pris en compte (en pratique, des
recherches identiques entre abonnés ne sont payées qu'une fois par 6 h).

## Volumes au maximum des quotas (31 jours)

| Formule | Contrôles de pages | Recherches Brave | E-mails | Contrôles HTTP Business | Scénarios navigateur |
| --- | --- | --- | --- | --- | --- |
| Plus (20 pages / 6 h, 3 sujets) | 2 480 | 93 | 30 | — | — |
| Pro (100 pages / 2 h, 10 sujets) | 37 200 | 620 | 80 | — | — |
| Max (150 pages / 1 h, 20 sujets) | 111 600 | 1 240 | 150 | — | — |
| Business (Pro + 1 site, 3 points / min, 1 scénario / 2 h) | 37 200 | 620 | 150 + alertes Business (plafond technique 60 / 24 h, soit ≤ 1 860) | 133 920 | 372 |
| Site supplémentaire Business | — | — | inclus dans le plafond du compte | 133 920 | — |

Les contrôles de pages peuvent être faits par l'ordinateur de l'abonné (application desktop) : le coût serveur
ci-dessous est le cas où tout est fait par les serveurs.

## Coût variable maximal par abonné et par mois

| Formule | Prix TTC | Brave | E-mails | CPU serveur | Stripe | **Coût variable max** | Marge brute (HT) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Plus | 5,99 € | 0,47 € | 0,01 € | < 0,01 € | 0,34 € | **≈ 0,83 €** | ≈ 4,16 € |
| Pro | 14,99 € | 3,10 € | 0,03 € | ≈ 0,01 € | 0,47 € | **≈ 3,61 €** | ≈ 8,88 € |
| Max | 29,99 € | 6,20 € | 0,06 € | ≈ 0,02 € | 0,70 € | **≈ 6,98 €** | ≈ 18,01 € |
| Business | 39,99 € | 3,10 € | ≤ 0,80 € | ≈ 0,04 € | 0,85 € | **≈ 4,79 €** | ≈ 28,54 € |
| Site supplémentaire | 14,99 € | — | (plafond du compte) | ≈ 0,01 € | 0,22 € | **≈ 0,23 €** | ≈ 12,26 € |

Marge brute = prix HT (TTC / 1,2) − coût variable maximal, avant coûts fixes. **Aucune formule n'est
déficitaire au maximum de ses quotas** avec ces hypothèses. La formule la plus sensible est Pro : si le prix
réel de Brave était de 15 € / 1 000 requêtes, le coût Brave de Pro passerait à 9,30 € et la marge brute à
≈ 2,70 €.

## Coûts fixes (indépendants du nombre d'abonnés)

| Poste | Estimation | Remarque |
| --- | --- | --- |
| Vercel | 0 € aujourd'hui (Hobby) ; ≈ 20 $ / mois en Pro | **La formule Hobby interdit l'usage commercial** : passage en Pro nécessaire au lancement (décision LULLIN WEB). |
| Serveur worker + PostgreSQL | ≈ 15 € / mois | Non souscrit. |
| Sauvegardes hors site | ≈ 1 € / mois | Quelques Go. |
| Resend | 0 € jusqu'à 3 000 e-mails / mois et 100 / jour, puis ≈ 20 $ / mois | La limite de 100 / jour de l'offre gratuite peut être atteinte par un seul incident Business important. |
| Domaine | déjà acheté | |

Seuil de rentabilité indicatif : ≈ 40 € / mois de coûts fixes, couverts par ≈ 10 abonnés Plus ou 2 abonnés
Business au maximum de leurs quotas.

## Points de vigilance

1. **Brave** : seul coût variable significatif. Plafond global de la plateforme (`budget.monthly_api_eur`, 50 € par
   défaut) : une fois atteint, les recherches de **tous** les abonnés sont suspendues jusqu'au mois suivant. À
   relever avant le lancement en fonction du nombre d'abonnés (sinon des abonnés ne recevraient pas le service
   payé).
2. **E-mails Business** non décomptés du quota : bornés par le regroupement, la détection de site instable et le
   plafond technique de 60 / 24 h par compte.
3. **Bande passante** : jusqu'à ≈ 17 Go / mois pour un abonné Max dont toutes les pages sont contrôlées par les
   serveurs (pages de 150 Ko). Sans conséquence sur un VPS à trafic illimité, à vérifier sinon.
4. Le compteur technique (`provider_requests`) et la saisie des coûts réels permettent de remplacer ces
   estimations par des chiffres réels dès le premier mois d'exploitation.
