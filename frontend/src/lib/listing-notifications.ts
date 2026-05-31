import { Firestore } from 'firebase-admin/firestore';
import { sendEmail, normalizePostalCode } from '@/lib/email';
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

/** Notifications in-app (toujours disponibles, sans domaine Resend). */
async function notifyUsersInApp(db: Firestore, payload: ListingNotifyPayload) {
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

/** E-mails Resend si configuré (nécessite un domaine vérifié pour tous les destinataires). */
async function notifyUsersByEmail(db: Firestore, payload: ListingNotifyPayload) {
  const snap = await db.collection('users').limit(500).get();
  const listingPostal = payload.isInPerson ? normalizePostalCode(payload.postalCode) : '';
  const summary = listingSummary(payload);
  const broadcastSubject = `Nouvelle annonce : ${payload.title}`;
  const localSubject = `Mission près de chez vous (${listingPostal}) : ${payload.title}`;

  await Promise.all(
    snap.docs.map(async (doc) => {
      if (doc.id === payload.authorId) return;
      const data = doc.data();
      const email = String(data.email || '').trim();
      if (!email) return;

      const broadcast = await sendEmail({
        to: email,
        subject: broadcastSubject,
        text: `Bonjour ${data.firstname || ''},\n\n${summary}`,
      });
      if (!broadcast.ok) return;

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

export async function notifyUsersOnNewListing(db: Firestore, payload: ListingNotifyPayload) {
  await notifyUsersInApp(db, payload);
  await notifyUsersByEmail(db, payload).catch((err) =>
    console.error('[listing-notify-email]', err)
  );
}
