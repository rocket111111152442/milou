import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';

const OPEN_LISTING_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Marque les annonces ouvertes trop anciennes comme expirées. */
export async function expireOldOpenListings(db: Firestore, limit = 50) {
  const cutoff = Timestamp.fromDate(new Date(Date.now() - OPEN_LISTING_MAX_AGE_MS));
  const snap = await db
    .collection('listings')
    .where('status', '==', 'open')
    .where('createdAt', '<', cutoff)
    .limit(limit)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'expired',
      expiredAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  return snap.size;
}
