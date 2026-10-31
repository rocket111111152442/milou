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

Les contrôles de pages peuvent être faits par l'ordinateur de l'abonné (application desktop) : le coût serveur
ci-dessous est le cas où tout est fait par les serveurs.

## Coût variable maximal par abonné et par mois

| Formule | Prix TTC | Brave | E-mails | CPU serveur | Stripe | **Coût variable max** | Marge brute (HT) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Plus | 5,99 € | 0,47 € | 0,01 € | < 0,01 € | 0,34 € | **≈ 0,83 €** | ≈ 4,16 € |
| Pro | 14,99 € | 3,10 € | 0,03 € | ≈ 0,01 € | 0,47 € | **≈ 3,61 €** | ≈ 8,88 € |
| Max | 29,99 € | 6,20 € | 0,06 € | ≈ 0,02 € | 0,70 € | **≈ 6,98 €** | ≈ 18,01 € |
| Business | 39,99 € | 3,10 € | ≤ 0,80 € | ≈ 0,04 € | 0,85 € | **≈ 4,79 €** | ≈ 28,54 € |

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

## Règles personnalisées (mesure du 01/11/2026)

- **Aucun appel payant supplémentaire** : les règles réutilisent le même téléchargement de page que l'ancien système
  (une règle = un contrôle à la fréquence de la formule, quel que soit le nombre de conditions). L'assistant en
  langage naturel est déterministe (aucune IA). Les PDF sont téléchargés uniquement quand l'adresse surveillée est un
  PDF (8 Mo max), jamais en masse.
- **Stockage mesuré** (pire cas : page catalogue de 80 produits et 150 liens) : observation enrichie 28 Ko contre
  4,4 Ko auparavant ; 0,6 Ko une fois compactée. Les listes détaillées ne sont conservées que sur le **dernier**
  résultat réussi de chaque surveillance (supprimées des précédents dès le contrôle suivant) et l'extrait de texte est
  compacté après 24 h. Coût par surveillance : ≤ 28 Ko pour le dernier résultat + 0,6 à 4,4 Ko par contrôle conservé.
- Mémoire de déduplication : empreintes de 16 caractères, 800 au plus par type de liste (≈ 70 Ko maximum par
  surveillance dans le pire cas, quelques Ko en pratique).
- CPU (mesuré, pire cas ci-dessus) : 23 ms par extraction enrichie contre 2,4 ms pour l'extraction historique, soit
  ≈ 1 vCPU pour 150 000 contrôles par heure (1 000 abonnés Max au maximum). Aucun navigateur supplémentaire. Piste
  d'optimisation si nécessaire : n'extraire que les listes utilisées par la règle de la surveillance.

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

## Projection de 1 à 1 000 clients (tous au maximum de leurs quotas)

Coût technique total mensuel (variable + serveurs) / **marge technique** (prix HT − coût technique).
La marge technique n'est **pas** un bénéfice : elle ne déduit ni impôts, ni cotisations, ni frais généraux,
ni Vercel Pro, ni temps de travail.

| Formule (N clients identiques) | 1 | 20 | 100 | 500 | 1 000 |
| --- | --- | --- | --- | --- | --- |
| Plus | 17 € / −12 € | 32 € / 67 € | 112 € / 387 € | 518 € / 1 977 € | 1 037 € / 3 955 € |
| Pro | 20 € / −7 € | 88 € / 162 € | 391 € / 858 € | 1 913 € / 4 332 € | 3 827 € / 8 665 € |
| Max | 23 € / 2 € | 155 € / 345 € | 726 € / 1 773 € | 3 590 € / 8 906 € | 7 180 € / 17 812 € |
| Business | 21 € / 13 € | 111 € / 555 € | 505 € / 2 827 € | 2 487 € / 14 176 € | 4 974 € / 28 351 € |

Hypothèse serveurs (worker + PostgreSQL + sauvegardes hors site, **non souscrits**, à confirmer par devis) :
≈ 16 € / mois jusqu'à 20 clients, ≈ 30 € à 100, ≈ 110 € à 500, ≈ 220 € à 1 000 (base dédiée avec ≈ 1 To de disque + 2 à 3 workers). Le poste stockage est le plus incertain : à faire chiffrer en priorité.
Avec un seul client, les coûts fixes du serveur ne sont pas couverts (marge négative) : c'est attendu.
Business : hypothèse prudente de 60 alertes de panne par jour (plafond technique) en plus des 150 e-mails.

### Capacité nécessaire pour 1 000 clients Max dont tout passe par les serveurs

| Ressource | Volume | Origine |
| --- | --- | --- |
| Contrôles de pages | 111,6 millions / mois ≈ 42 / s | quotas |
| CPU de ces contrôles | ≈ 0,2 cœur en continu (5 ms / contrôle) | **mesuré** (test de charge) |
| Bande passante | ≈ 16,7 To / mois ≈ 51 Mbit/s (pages de 150 Ko) | hypothèse de taille de page |
| Recherches Brave | 1,24 million / mois ≈ 0,5 / s, ≈ 6 200 € | tarif configuré, à vérifier |
| Stockage de l'historique | ≈ 1,3 million de lignes / client / an ; ≈ 0,9 To / an pour 1 000 clients après compaction des extraits (≈ 2 à 3,7 To sans compaction) | **mesuré** : observation compactée 582 octets (≈ 0,7 Ko avec l'en-tête de ligne et l'index), extrait ≈ 1,3 Ko compressé |
| Contrôles HTTP Business (1 000 clients Business) | 134 millions / mois ≈ 51 / s, ≈ 0,1 cœur | **mesuré** (2,2 ms / contrôle) |
| Scénarios navigateur (1 000 clients Business) | 372 000 / mois ; ≈ 0,3 cœur en moyenne ; 2 navigateurs simultanés ≈ 0,6 Go de mémoire par worker | durée mesurée, CPU de Chromium estimé |

Le contrôle par l'application de bureau des abonnés et le cache partagé des pages et des recherches réduisent
ces volumes ; ils ne sont pas pris en compte ici (cas le plus défavorable).

### Essais gratuits

Un essai de 72 h au maximum : 6 recherches (0,03 €), au plus 10 e-mails (0,004 €), 3 surveillances. Coût négligeable ;
les abus (plusieurs essais) sont limités par l'empreinte de la carte bancaire et de l'adresse e-mail.
