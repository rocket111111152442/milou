import { Firestore } from 'firebase-admin/firestore';
import { isPremiumActive } from '@/lib/premium';

export { REVIEW_COMMENT_MAX, RATING_LABELS } from '@/lib/review-constants';

/** Impact d'un avis sur la réputation : un mauvais avis ne doit pas faire monter la réputation. */
export function reputationDeltaForRating(rating: number): number {
  if (rating >= 4) return 1;
  if (rating <= 2) return -1;
  return 0;
}

/** Champs publics de l'auteur d'un avis (jamais d'email, solde, notes modérateur…). */
export function publicReviewer(id: string, data: Record<string, unknown> | undefined) {
  if (!data) return null;
  return {
    id,
    firstname: String(data.firstname ?? ''),
    lastname: String(data.lastname ?? ''),
    avatarUrl: String(data.avatarUrl ?? ''),
    isPremium: isPremiumActive(data),
  };
}

/** Recalcule note moyenne et nombre d'avis après suppression. */
export async function recalculateUserReviewStats(db: Firestore, userId: string) {
  const snap = await db.collection('reviews').where('toUserId', '==', userId).limit(500).get();
  const ratings = snap.docs.map((d) => Number(d.data().rating ?? 0));
  const count = ratings.length;
  const averageRating =
    count === 0 ? 0 : Math.round((ratings.reduce((a, b) => a + b, 0) / count) * 10) / 10;

  await db.collection('users').doc(userId).update({
    reviewCount: count,
    averageRating,
  });

  return { count, averageRating };
}
