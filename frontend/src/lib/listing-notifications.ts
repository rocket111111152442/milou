import { DocumentData, FieldPath, Firestore } from 'firebase-admin/firestore';
import { sendEmail, isSmtpConfigured } from '@/lib/email-server';
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

const USERS_PAGE_SIZE = 200;

function listingEmailBody(payload: ListingNotifyPayload, firstname: string) {
  const typeLabel = payload.type === 'offer' ? 'Offre de service' : 'Demande d\'aide';
  const location =
    payload.isInPerson && payload.postalCode
      ? `\nLieu : en présentiel — code postal ${payload.postalCode}`
      : payload.isInPerson
        ? '\nLieu : en présentiel'
        : '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://milou-delta.vercel.app';

  return [
    `Bonjour ${firstname || ''},`.trim(),
    '',
    'Une nouvelle annonce est disponible sur le marketplace MILOU.',
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
    `Voir le marketplace : ${appUrl}/marketplace`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function forEachUser(
  db: Firestore,
  callback: (userId: string, data: DocumentData) => Promise<void>
) {
  let lastId: string | undefined;

  for (;;) {
    let query = db.collection('users').orderBy(FieldPath.documentId()).limit(USERS_PAGE_SIZE);
    if (lastId) query = query.startAfter(lastId);
    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      await callback(doc.id, doc.data());
    }

    lastId = snap.docs[snap.docs.length - 1].id;
    if (snap.size < USERS_PAGE_SIZE) break;
  }
}

export type ListingNotifyResult = {
  inApp: number;
  emailsSent: number;
  emailsFailed: number;
  skippedAuthor: number;
  smtpConfigured: boolean;
};

export async function notifyUsersOnNewListing(
  db: Firestore,
  payload: ListingNotifyPayload
): Promise<ListingNotifyResult> {
  const listingPostal = payload.isInPerson ? normalizePostalCode(payload.postalCode) : '';
  const typeLabel = payload.type === 'offer' ? 'Offre' : 'Demande';
  const subject = `Nouvelle annonce : ${payload.title}`;
  const localSubject = listingPostal
    ? `Mission près de chez vous (${listingPostal}) : ${payload.title}`
    : subject;

  const result: ListingNotifyResult = {
    inApp: 0,
    emailsSent: 0,
    emailsFailed: 0,
    skippedAuthor: 0,
    smtpConfigured: isSmtpConfigured(),
  };

  if (!result.smtpConfigured) {
    console.warn('[listing-notify] SMTP non configuré sur ce serveur (SMTP_USER / SMTP_PASS)');
  }

  await forEachUser(db, async (userId, data) => {
    if (userId === payload.authorId) {
      result.skippedAuthor += 1;
      return;
    }

    const email = String(data.email || '').trim();
    const userPostal = normalizePostalCode(data.postalCode);
    const nearYou = Boolean(listingPostal && userPostal && userPostal === listingPostal);

    let body = `« ${payload.title} » — ${payload.price} M · ${typeLabel}`;
    if (nearYou) body += ` · Près de chez vous (${listingPostal})`;

    await createNotification(db, {
      userId,
      type: 'new_listing',
      title: nearYou ? 'Nouvelle annonce près de chez vous' : 'Nouvelle annonce',
      body,
      link: '/marketplace',
    });
    result.inApp += 1;

    if (!email) return;

    const sent = await sendEmail({
      to: email,
      subject: nearYou ? localSubject : subject,
      text: listingEmailBody(payload, String(data.firstname || '')),
    });

    if (sent.ok) result.emailsSent += 1;
    else result.emailsFailed += 1;
  });

  console.log('[listing-notify] done', result);
  return result;
}
