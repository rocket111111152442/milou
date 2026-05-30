import { Firestore } from 'firebase-admin/firestore';

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
