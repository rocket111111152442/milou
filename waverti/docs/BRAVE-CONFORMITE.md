# Brave Search API — conformité et conservation des résultats

> État au 2026-11-01. Les conditions de Brave ont été relues telles que citées dans le code ; la page officielle de tarification
> des droits de stockage n'a pas pu être consultée depuis l'environnement de développement (hôte non autorisé) : les
> **tarifs de stockage ($26 / $45 pour 1 000 requêtes) ne sont pas vérifiés**. Ce document n'est pas un avis juridique.

## Règle appliquée dans le code

Tant que Brave n'a pas confirmé par écrit un plan ou un contrat autorisant le stockage, **aucun résultat Brave (titre, extrait,
adresse) n'est conservé** — ni en base, ni en cache, ni dans l'historique, ni dans les alertes. Le réglage est unique :
`WAVERTI_BRAVE_STORAGE_RIGHTS` (exactement `granted` pour activer ; toute autre valeur ou l'absence = aucun droit).

| Fonction | Sans droits (défaut) | Avec droits confirmés |
| --- | --- | --- |
| Cache partagé `search_cache` (recherche par sujet et produits) | désactivé, écriture et lecture | actif (TTL borné) |
| Observations / résultats d'une surveillance Internet | éléments `redacted` : adresse `null`, titre et extrait vides ; empreinte seule (déduplication) | contenu complet |
| `monitoring_seen_items` | empreinte seule | idem + libellé |
| Alertes et e-mails issus d'une recherche Brave | texte générique « information détectée » | texte complet |
| Compteurs, coûts, statut HTTP, latence (`provider_requests`) | conservés (métadonnées techniques) | conservés |
| Découverte de produits | requêtes dédupliquées en mémoire pendant la requête uniquement | cache PostgreSQL partagé |

Neutralisation de l'existant : `enforceBraveStoragePolicy` (maintenance horaire du worker) supprime `search_cache`, vide les
titres/adresses/extraits des tables concernées et remplace les e-mails en attente par un contenu neutre. Idempotente, testée
(`brave-policy.int.test.ts`). Les surveillances existantes continuent de fonctionner (détection de nouveauté par empreinte).

## Données Brave et données indépendantes

* **Brave** : titre, extrait, adresse renvoyés par l'API → soumis à la règle ci-dessus.
* **Fiche marchande** : prix, devise, disponibilité lus par Waverti directement sur la page publique du marchand
  (`HttpOfferVerifier`). Ces données ne viennent pas de Brave, mais leur conservation reste à valider (conditions des sites,
  droit des bases de données) : dans le catalogue préparé, la source `merchant_page` est **refusée par défaut**.
* **Origine tracée** : `discovery_origin` (brave / merchant_crawl / user_supplied / import) sur chaque offre. Une offre dont
  l'adresse vient de Brave ne conserve **que l'empreinte** (`url_hash`) tant que la source `brave` n'est pas autorisée ; la
  fonction `catalog_revoke_source('brave', …)` efface ces adresses si les droits sont retirés (§13(c)).

## Points à confirmer juridiquement / contractuellement

1. Plan ou Order Form de Brave autorisant explicitement le stockage et le cache des résultats **pour Waverti** (durée, périmètre,
   conservation des empreintes, historique de variations dérivé).
2. Le prix, la devise et la disponibilité extraits d'une fiche marchande **trouvée via Brave** constituent-ils un « résultat
   de recherche » (§3(b)) ou une donnée indépendante ?
3. Usage d'une adresse issue de Brave comme clé de surveillance conservée ; affichage dans l'interface ; envoi dans des alertes.
4. Alertes/e-mails déjà envoyés : faut-il purger l'historique existant (`scrubHistory`) ? Décision du propriétaire.
5. Conditions des sites marchands et droit sur les bases de données pour la conservation des prix vérifiés.
6. Tarif exact des droits de stockage et inclusion éventuelle dans un plan existant.
7. Obligations en fin de contrat (§13(c)) : délai d'effacement, preuve de suppression.

## Message à envoyer au support commercial de Brave

**EN** — *Subject: Storage / caching rights for Brave Search API results (Waverti)*

> Hello,
> We are building Waverti, a web-monitoring product (price and availability alerts, news monitoring) that uses the Brave Search
> API (web search endpoint) from our servers only. We have read Section 3(b) of the API Terms and understand that storing or
> caching results is not permitted unless our plan or Order Form says so. Until we hear from you, we do not store any result
> (title, snippet or URL), not even in caches.
> Could you please confirm in writing: (1) which plan includes storage rights and its price per 1,000 requests; (2) whether we may
> keep results in a shared cache for a bounded time (e.g. 6 hours) and, if so, the maximum duration; (3) whether we may keep
> only a hash of the URL and the derived, independently verified price/availability observed on the merchant's own page;
> (4) whether we may display results and send them in alerts to our end users; (5) what deletion obligations apply when the
> agreement ends. Expected volume: a few thousand requests per month at launch.
> Thank you, [name], [company], [contact]

**FR** — *Objet : droits de stockage / cache des résultats de l'API Brave Search (Waverti)*

> Bonjour, nous développons Waverti (alertes de prix, de disponibilité et d'actualités) qui utilise l'API Brave Search depuis nos
> serveurs uniquement. Nous avons lu la section 3(b) des conditions : le stockage et la mise en cache des résultats ne sont
> permis que si le plan ou le bon de commande le prévoit. En attendant votre réponse, nous ne conservons aucun résultat (titre,
> extrait, adresse). Pouvez-vous nous confirmer par écrit : (1) le plan incluant les droits de stockage et son prix pour
> 1 000 requêtes ; (2) si un cache partagé de durée limitée est permis et sa durée maximale ; (3) si nous pouvons conserver
> uniquement l'empreinte de l'adresse et le prix/la disponibilité vérifiés indépendamment sur la page du marchand ;
> (4) si nous pouvons afficher les résultats et les envoyer dans des alertes ; (5) les obligations de suppression à la fin du
> contrat. Volume prévu : quelques milliers de requêtes par mois au lancement. Cordialement, [nom], [société], [contact]

## Test réel unique (non exécuté)

`packages/monitoring/scripts/brave-live-probe.ts` : au plus **une** requête, coût supposé $0.005 (plafond dur du budget),
aucun retry, aucune base, aucun fichier. S'arrête avant tout appel sans `WAVERTI_LIVE_BRAVE_TEST=AUTHORIZED_ONE_REQUEST` et
sans clé. Une seconde requête est bloquée avant le réseau (`singleShotFetch`). **Aucune requête réelle n'a été émise** ;
l'exécution attend l'accord explicite du propriétaire.
