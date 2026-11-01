import type { ProductIdentity } from "./types";

/**
 * Identité minimale d'un résultat de recherche : seul le titre est connu (ni GTIN ni référence fiable) ;
 * l'identité complète vient de la fiche vérifiée.
 */
export function identityFromCandidateTitle(title: string): ProductIdentity {
  return { name: title };
}
