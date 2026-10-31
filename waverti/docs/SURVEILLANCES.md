# Surveillances — catégories, conditions et règles personnalisées

## Architecture (modulaire, moteurs existants réutilisés)

| Brique | Rôle | Fichier |
| --- | --- | --- |
| Types de règles (validation) | 27 conditions élémentaires, groupes, ET/OU, exclusions, options | `packages/types/src/rules.ts` |
| Extracteur | Prix, stock, prix barré, liens, rubriques, documents, éléments de liste, dates, tableaux, formulaires, empreinte « nettoyée » | `packages/monitoring/src/extract/html.ts`, `structure.ts` |
| Documents PDF | Empreinte des octets, texte quand il est lisible (8 Mo max) | `packages/monitoring/src/extract/pdf.ts` |
| Évaluateur de règles | Logique à 3 valeurs, transitions par condition, mémoire, confirmation, délai, pannes | `packages/monitoring/src/compare/rules.ts` |
| Mémoire par surveillance | Éléments déjà vus (empreintes courtes, 800 max par liste), état, panne en cours | colonne `monitoring_tasks.rule_state` |
| Planificateur, file, quotas | Inchangés (une règle = une surveillance, fréquence de la formule) | `packages/monitoring/src/queue.ts`, `@waverti/billing` |
| Recherche Internet (Actualités, Entreprises) | Moteur B existant (Brave, classification officielle / rumeur, déduplication) | `packages/monitoring/src/search` |
| Disponibilité professionnelle | Moteur Business existant (HTTP chaque minute, TLS, scénario) | `packages/monitoring/src/business` |
| Assistant en langage naturel | Déterministe, sans IA ni coût | `packages/types/src/rules-nl.ts` |
| Analyse de page | Suggestions à partir des données détectées + zones sélectionnables | `rules-suggest.ts`, `listBlocks()` |
| Interface | Assistant en 4 étapes, constructeur de règles | `packages/ui/src/app/monitor-wizard.tsx`, `rule-builder.tsx` |

Aucun nouveau worker : les règles passent par le worker et la file existants.

## Les 10 catégories

Chaque catégorie propose des objectifs prêts à l'emploi (modèles de règles), ajustables dans le constructeur.

| Catégorie | Source | Exemples d'objectifs |
| --- | --- | --- |
| Prix | page produit | sous un seuil, valeur cible (≤), toute baisse, réduction ≥ X % (par rapport au prix de départ), variation ≥ X €, hausse, au-dessus d'une valeur, prix barré affiché |
| Produits | produit ou catégorie | retour en stock, rupture, changement de disponibilité, nouveau produit, nouveau modèle/variante (mot contenu), catalogue modifié, caractéristiques (zone) |
| Pages web | page | modification générale, section (zone), titre, paragraphe (phrase contenant un mot), lien ajouté/supprimé, élément identifié présent, nouvelle rubrique, tableau |
| Mots-clés | page | apparition, disparition, phrase exacte, une parmi plusieurs (OU), plusieurs (ET), dans une zone, phrase modifiée ; mots entiers, casse, joker `*` |
| Événements | page officielle | ouverture d'inscriptions / billetterie / réservation, nouvelles dates, places de nouveau disponibles (« complet » disparaît), calendrier publié, nouvelle session |
| Entreprises | page de l'entreprise, ou recherche Internet | offre d'emploi, annonce, produit, catalogue, page officielle, nouveau service ; recherche élargie (quota de recherches) |
| Actualités | recherche Internet (moteur B) | annonce officielle, sortie/nouvelle version, communiqué/réglementation/résultat, offres, toute information |
| Disponibilité | site autorisé | inaccessible ou en erreur (2 échecs consécutifs) + retour à la normale, lenteur confirmée, redirection inattendue, page critique modifiée ; TLS, contrôles chaque minute et scénario navigateur → espace Business |
| Documents | PDF ou page de publications | nouvelle version d'un PDF, texte modifié, nouveau document (titre contenant…), document retiré, lien de téléchargement modifié |
| Personnalisée | page | constructeur complet |

## Fiabilité des alertes

- **Transition** : une condition d'état n'alerte qu'en passant de « faux » à « vrai » (condition par condition).
- **Déduplication** : un élément, lien, document, date ou rubrique déjà vu n'est jamais signalé de nouveau, même après
  une disparition temporaire (le retour à la normale n'est pas une nouveauté).
- **Erreurs temporaires** (503, délai dépassé) : aucune modification de l'état ; la comparaison suivante se fait avec
  la dernière observation réussie. Pannes annoncées après 2 échecs consécutifs ; retour à la normale signalé.
- **Confirmation** (option) : alerte au contrôle suivant seulement si le MÊME changement est encore observé.
- **Délai minimal** entre deux alertes (option).
- **Zones volatiles ignorées** : navigation, pied de page, publicités, cookies, recommandations, carrousels ; heures,
  compteurs et identifiants techniques retirés de l'empreinte.
- **Explication** : chaque alerte indique la raison (« prix relevé 189 € (seuil 200 €) ; produit en stock »).
- **Données absentes** : erreur explicite (« aucun prix fiable trouvé »), jamais d'alerte inventée.

## Respect des abonnements

Une règle compte pour **une** surveillance, quel que soit son nombre de conditions (12 max) ; elle est contrôlée à la
fréquence de la formule (jamais plus vite) ; la recherche Internet reste soumise aux quotas de sujets et de recherches ;
les fonctions professionnelles (TLS, contrôles chaque minute, scénarios) restent dans l'offre Business ; les accès bêta
gardent leurs quotas réduits. Les règles sont contrôlées par les serveurs (les anciennes versions de l'application
desktop ne produisent pas les nouvelles données).

## Sécurité

- Aucune exécution de code utilisateur : pas de JavaScript, pas d'expression régulière libre (termes échappés, joker
  borné à 30 caractères), conditions validées par schéma côté serveur.
- Récupération HTTP existante : résolution DNS validée à la connexion (anti-rebinding), adresses privées/internes
  refusées, redirections revalidées (5 max), délais, taille max (HTML 2 Mo, PDF 8 Mo), types de contenu autorisés
  (HTML, texte, JSON, PDF uniquement), robots.txt, espacement par hôte, cache partagé.
- PDF jamais interprétés (pas de rendu, pas de JavaScript PDF) ; décompression plafonnée (8 Mo) ; PDF chiffrés ignorés.
- Données stockées bornées (100 liens, 60 éléments, 30 documents, 40 rubriques, 40 dates, 10 tableaux par contrôle).

## État de chaque fonctionnalité

Légende : **D** développée · **L** testée localement (pages et documents contrôlés) · **CI** testée en intégration
continue · **X** testée avec un service externe réel · **—** non disponible.

| Fonctionnalité | État |
| --- | --- |
| 27 conditions, groupes, ET/OU, exclusions, confirmation, délai, retour à la normale | D · L · CI |
| Extraction enrichie (liens, rubriques, documents, éléments, dates, tableaux, formulaires, prix barré) | D · L · CI |
| PDF : nouvelle version (empreinte), texte des PDF simples | D · L · CI |
| PDF : texte des PDF à polices composites (CID), scannés ou chiffrés | — (texte déclaré indisponible, seule l'empreinte est utilisée) |
| Nouvelle version d'un PDF *listé* sur une page sans changement d'adresse | — (détecté seulement via « lien modifié » ou en surveillant l'adresse du PDF) |
| Disponibilité (panne confirmée, retour, lenteur, redirection) | D · L · CI |
| Assistant en langage naturel (déterministe) | D · L · CI |
| Analyse de page : suggestions, zones sélectionnables (sélecteur unique vérifié) | D · L · CI ; interface testée avec une réponse simulée |
| Sélection visuelle en cliquant dans la page affichée | — : afficher un site tiers dans Waverti exigerait de le relayer (risque de sécurité, sites qui l'interdisent). Remplacée par la liste des zones détectées avec extrait, et le sélecteur CSS |
| Assistant par modèle d'IA | — : non activé (aucune dépense) ; l'assistant déterministe couvre les formulations courantes |
| Interface en 4 étapes, 10 catégories, constructeur, résumé, mobile | D · L · CI (Playwright ordinateur + téléphone) |
| Actualités / Entreprises (recherche Internet) | D (moteur B existant) · L · CI avec moteur simulé ; Brave réel : testé lors des missions précédentes, pas de nouveau test |
| Surveillances existantes (ancien système) | inchangées · L · CI |
| Fonctions sur de vrais sites tiers | non testées (aucun site tiers contacté par les tests) |

## Limites connues (honnêtes)

- Le texte comparé est limité aux 4 000 premiers caractères de la zone surveillée (comme auparavant) : pour une page
  longue, choisissez une zone.
- Les pages entièrement générées en JavaScript nécessitent le navigateur automatisé du worker (repli existant).
- « Places disponibles » repose sur des mentions de la page (« complet »…) : Waverti ne connaît pas le nombre de places.
- Contrôles de disponibilité depuis un seul emplacement.
