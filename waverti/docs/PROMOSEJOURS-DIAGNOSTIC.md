# Diagnostic Promoséjours — référence 640588

## Observations confirmées

- La requête publique de la fiche est accessible par un lecteur indexant la page et conserve les paramètres `dd=10`, `dmy=12/2026`, `aj=0`, `dpci=GVA` et `minMan=8-7`.
- Une requête HTTP directe depuis l’environnement Waverti reçoit `403 Forbidden`, avec `Server: cloudflare` et `Cf-Mitigated: challenge`. Le corps demande d’activer JavaScript et les cookies. Il s’agit donc d’une protection anti-robot, pas d’une URL invalide.
- `robots.txt` répond `200` et n’interdit pas `/products/`; il interdit seulement certains chemins techniques et quelques motifs de requête. Le blocage observé n’est pas une interdiction robots.
- La copie HTML lisible contient la référence `640588`, le départ de Genève le 10/12/2026 et le prix principal `1 010 €`, mais aussi la remise `250 €`, l’ancien prix `1 260 €` et des prix d’excursions (80 €, 135 €, etc.). Elle affiche également des zones `Erreur`/`Patientez`, ce qui indique que le devis/calendrier dépend d’un traitement dynamique séparé.

## Cause de non-lecture

Il y a deux causes indépendantes :

1. **Accès** : la lecture HTTP sans navigateur est stoppée par Cloudflare avant de fournir une réponse exploitable.
2. **Extraction** : lorsqu’une copie HTML est disponible, l’ancien fallback texte choisit le premier prix monétaire rencontré (`250 €`, la remise) au lieu du prix du séjour (`1 010 €`). Les prix du descriptif et des excursions polluent également le même flux de texte.

Les paramètres ne disparaissent pas pendant la lecture : ils sont conservés dans `finalUrl` et dans le challenge Cloudflare. L’échec principal est donc l’accès protégé, puis une faiblesse d’extraction sur les pages de voyage riches en prix.

## Correctif générique retenu

Le lecteur sélectionne désormais le candidat situé dans le bloc `prix à partir de`, `par personne` ou `prix du séjour`, tout en conservant tous les candidats et leur provenance pour le diagnostic. Les blocs d’excursions/options sont exclus de la sélection primaire. La référence visible `Ref : …` est également reconnue lorsque le microdata n’est pas présent.

Le correctif ne contourne aucun challenge, ne simule pas de navigateur et ne modifie aucune règle HTTP/SSRF. Si Cloudflare répond encore 403, l’observation doit rester une erreur d’accès et ne doit pas être interprétée comme une page vide ou une rupture de stock.

## Non-régression

La fixture de voyage est dans `packages/monitoring/test/reliability-lot2.unit.test.ts`. Elle vérifie la référence, la conservation des paramètres, le choix de `1 010 €` et la conservation séparée des prix de remise/ancien tarif/excursions.

## Limites

Nous n’avons pas exécuté de navigateur réel ni appelé les endpoints de devis du site : cela nécessiterait une session et pourrait contourner des protections. La cause Cloudflare est confirmée ; la mécanique exacte du devis dynamique reste à confirmer avec des traces autorisées côté navigateur ou avec une documentation publique du site.
