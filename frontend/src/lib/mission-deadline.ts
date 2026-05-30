import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { transferMilou, tsToIso } from '@/lib/firebase/wallet';
import { createNotification } from '@/lib/notifications';

export const DEADLINE_PENALTY_COMMENT = "n'as pas respecté la date de la mission";

const DEFAULT_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

/** Parse "3 jours", "2 heures 30 minutes", "1 semaine", etc. */
export function parseEstimatedDelayMs(text: string): number {
  const raw = String(text || '').toLowerCase().trim();
  if (!raw) return DEFAULT_DELAY_MS;

  const day = 24 * 60 * 60 * 1000;
  const unitMs = (unit: string) => {
    if (unit.startsWith('h') || unit === 'heure' || unit === 'heures') return 60 * 60 * 1000;
    if (unit.startsWith('min')) return 60 * 1000;
    if (unit.startsWith('sem') || unit === 's') return 7 * day;
    if (unit === 'mois' || unit === 'm') return 30 * day;
    return day;
  };

  const matches = Array.from(
    raw.matchAll(/(\d+(?:[.,]\d+)?)\s*(minute|minutes|min|heure|heures|h|jour|jours|j|semaine|semaines|sem|s|mois|m)/g)
  );
  if (matches.length === 0) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n > 0) return n * 24 * 60 * 60 * 1000;
    return DEFAULT_DELAY_MS;
  }

  const total = matches.reduce((sum, match) => {
    const value = parseFloat(match[1].replace(',', '.'));
    return sum + value * unitMs(match[2]);
  }, 0);

  return total > 0 ? total : DEFAULT_DELAY_MS;
}

export function computeDueAt(start: Date, estimatedDelay: string): Date {
  return new Date(start.getTime() + parseEstimatedDelayMs(estimatedDelay));
}

export function getMissionDueAt(data: Record<string, unknown>, listingDelay?: string): Date | null {
  if (data.dueAt) {
    const t = data.dueAt as { toDate?: () => Date };
    if (t.toDate) return t.toDate();
    return new Date(String(data.dueAt));
  }
  const created = (data.createdAt as { toDate?: () => Date })?.toDate?.();
  if (!created) return null;
  const delay = String(data.estimatedDelay || listingDelay || '7 jours');
  return computeDueAt(created, delay);
}

async function hasReviewFromClient(db: Firestore, missionId: string, clientId: string) {
  const snap = await db.collection('reviews').where('missionId', '==', missionId).limit(20).get();
  return snap.docs.some((d) => d.data().fromUserId === clientId);
}

async function applyDeadlinePenalty(db: Firestore, missionId: string, mission: Record<string, unknown>) {
  if (mission.deadlineProcessed) return;

  const clientId = String(mission.clientId);
  const providerId = String(mission.providerId);
  const amount = Number(mission.amount || 0);
  const listingId = String(mission.listingId);

  if (await hasReviewFromClient(db, missionId, clientId)) {
    await db.collection('missions').doc(missionId).update({ deadlineProcessed: true });
    return;
  }

  if (mission.escrowHeld) {
    await transferMilou(db, {
      fromUserId: null,
      toUserId: clientId,
      amount,
      type: 'escrow_release',
      description: 'Remboursement — délai de mission dépassé',
      listingId,
      missionId,
    });
  }

  await db.collection('reviews').add({
    missionId,
    fromUserId: clientId,
    toUserId: providerId,
    rating: 0,
    comment: DEADLINE_PENALTY_COMMENT,
    autoPenalty: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  const providerRef = db.collection('users').doc(providerId);
  const providerSnap = await providerRef.get();
  if (providerSnap.exists) {
    const tData = providerSnap.data()!;
    const prevCount = Number(tData.reviewCount ?? 0);
    const count = prevCount + 1;
    const avg = (Number(tData.averageRating ?? 0) * prevCount) / count;
    await providerRef.update({
      reviewCount: count,
      averageRating: Math.round(avg * 10) / 10,
      reputation: FieldValue.increment(-1),
    });
  }

  const missionRef = db.collection('missions').doc(missionId);
  await missionRef.update({
    status: 'completed',
    escrowHeld: false,
    completedReason: 'deadline_missed',
    deadlineProcessed: true,
    completedAt: FieldValue.serverTimestamp(),
  });

  await db.collection('listings').doc(listingId).update({ status: 'closed' });

  await missionRef.collection('messages').add({
    senderId: 'system',
    senderName: 'MILOU',
    text: `Délai dépassé. Note automatique : 0/5 — ${DEADLINE_PENALTY_COMMENT}. Le client a été remboursé.`,
    createdAt: FieldValue.serverTimestamp(),
  });

  await Promise.all([
    createNotification(db, {
      userId: providerId,
      type: 'system',
      title: 'Délai dépassé',
      body: `Avis 0/5 : ${DEADLINE_PENALTY_COMMENT}`,
      link: '/dashboard',
    }),
    createNotification(db, {
      userId: clientId,
      type: 'system',
      title: 'Mission clôturée',
      body: 'Délai dépassé — vos Milou ont été remboursés',
      link: '/dashboard',
    }),
  ]);
}

export async function processOverdueMissionsForUser(db: Firestore, uid: string) {
  const [asClient, asProvider] = await Promise.all([
    db.collection('missions').where('clientId', '==', uid).where('status', '==', 'in_progress').get(),
    db.collection('missions').where('providerId', '==', uid).where('status', '==', 'in_progress').get(),
  ]);

  const seen = new Set<string>();
  const now = Date.now();

  for (const doc of [...asClient.docs, ...asProvider.docs]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);

    const data = doc.data();
    if (data.deadlineProcessed) continue;

    let due = getMissionDueAt(data);
    if (!due) {
      const listingSnap = await db.collection('listings').doc(String(data.listingId)).get();
      due = getMissionDueAt(data, listingSnap.data()?.estimatedDelay as string);
    }
    if (!due || due.getTime() > now) continue;

    await applyDeadlinePenalty(db, doc.id, data);
  }
}

export function dueAtIso(data: Record<string, unknown>, listingDelay?: string): string | null {
  const d = getMissionDueAt(data, listingDelay);
  return d ? d.toISOString() : null;
}

export function missionDueAtFromDoc(data: Record<string, unknown>): string | null {
  if (data.dueAt) return tsToIso(data.dueAt);
  return null;
}
