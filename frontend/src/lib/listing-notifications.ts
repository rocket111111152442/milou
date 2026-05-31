import { Firestore } from 'firebase-admin/firestore';
import { normalizePostalCode } from '@/lib/postal-code';
import { createNotification } from '@/lib/notifications';

type ListingNotifyPayload = {
  listingId: string;
  title: string;
  description: string;
  price: number;
  type: string;
  category: string;
  authorId: string;
  isInPerson?: boolean;
  postalCode?: string;
};

export async function notifyUsersOnNewListing(db: Firestore, payload: ListingNotifyPayload) {
  const snap = await db.collection('users').limit(500).get();
  const listingPostal = payload.isInPerson ? normalizePostalCode(payload.postalCode) : '';
  const typeLabel = payload.type === 'offer' ? 'Offre' : 'Demande';

  await Promise.all(
    snap.docs.map(async (doc) => {
      if (doc.id === payload.authorId) return;
      const data = doc.data();
      const userPostal = normalizePostalCode(data.postalCode);
      const nearYou = listingPostal && userPostal && userPostal === listingPostal;

      let body = `« ${payload.title} » — ${payload.price} M · ${typeLabel}`;
      if (nearYou) body += ` · Près de chez vous (${listingPostal})`;

      await createNotification(db, {
        userId: doc.id,
        type: 'new_listing',
        title: nearYou ? `Nouvelle annonce près de chez vous` : 'Nouvelle annonce',
        body,
        link: '/marketplace',
      });
    })
  );
}
