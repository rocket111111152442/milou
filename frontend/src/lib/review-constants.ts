/** Constantes partagées client/serveur pour le système d'avis. */

export const REVIEW_COMMENT_MAX = 500;

/** Libellés affichés à côté des étoiles (index = note). */
export const RATING_LABELS: Record<number, string> = {
  0: 'Pénalité automatique',
  1: 'Très décevant',
  2: 'Décevant',
  3: 'Correct',
  4: 'Très bien',
  5: 'Excellent',
};
