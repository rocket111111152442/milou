import { Firestore } from 'firebase-admin/firestore';
import { sendEmail, normalizePostalCode } from '@/lib/email';

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

function listingSummary(payload: ListingNotifyPayload) {
  const typeLabel = payload.type === 'offer' ? 'Offre de service' : 'Demande d\'aide';
  const location =
    payload.isInPerson && payload.postalCode
      ? `\nLieu : mission en présentiel — code postal ${payload.postalCode}`
      : payload.isInPerson
        ? '\nLieu : mission en présentiel'
        : '';
  return [
    `Une nouvelle annonce est disponible sur le marketplace MILOU.`,
    '',
    `Titre : ${payload.title}`,
    `Type : ${typeLabel}`,
    `Catégorie : ${payload.category}`,
    `Prix : ${payload.price} M`,
    location,
    '',
    `Description :`,
    payload.description.slice(0, 800),
    '',
    `Voir le marketplace : ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/marketplace`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function notifyUsersOnNewListing(db: Firestore, payload: ListingNotifyPayload) {
  const snap = await db.collection('users').limit(500).get();
  const authorId = payload.authorId;
  const listingPostal = payload.isInPerson ? normalizePostalCode(payload.postalCode) : '';
  const summary = listingSummary(payload);

  const broadcastSubject = `Nouvelle annonce : ${payload.title}`;
  const localSubject = `Mission près de chez vous (${listingPostal}) : ${payload.title}`;

  await Promise.all(
    snap.docs.map(async (doc) => {
      if (doc.id === authorId) return;
      const data = doc.data();
      const email = String(data.email || '').trim();
      if (!email) return;

      await sendEmail({
        to: email,
        subject: broadcastSubject,
        text: `Bonjour ${data.firstname || ''},\n\n${summary}`,
      });

      if (listingPostal) {
        const userPostal = normalizePostalCode(data.postalCode);
        if (userPostal && userPostal === listingPostal) {
          await sendEmail({
            to: email,
            subject: localSubject,
            text: [
              `Bonjour ${data.firstname || ''},`,
              '',
              `Une annonce correspond à votre code postal (${listingPostal}).`,
              '',
              summary,
            ].join('\n'),
          });
        }
      }
    })
  );
}
