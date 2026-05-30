import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { countUnreadMessages } from '@/lib/mission-unread';
import { processOverdueMissionsForUser, missionDueAtFromDoc, dueAtIso } from '@/lib/mission-deadline';
import { jsonNoStore } from '@/lib/http';
import { isListingVisible } from '@/lib/listings';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function mapMissionDoc(
  db: Firestore,
  uid: string,
  d: QueryDocumentSnapshot,
  includeUnread: boolean
) {
  const data = d.data();
  const listingSnap = await db.collection('listings').doc(data.listingId as string).get();
  const clientSnap = await db.collection('users').doc(data.clientId as string).get();
  const providerSnap = await db.collection('users').doc(data.providerId as string).get();
  const unreadCount = includeUnread ? await countUnreadMessages(db, d.id, uid) : 0;
  const listingData = listingSnap.exists ? listingSnap.data() : {};
  const dueAt =
    missionDueAtFromDoc(data) || dueAtIso(data, String(listingData?.estimatedDelay || ''));

  return {
    _id: d.id,
    amount: data.amount,
    status: data.status,
    dueAt,
    estimatedDelay: String(data.estimatedDelay || listingData?.estimatedDelay || ''),
    completedReason: data.completedReason || null,
    unreadCount,
    clientUid: data.clientId,
    providerUid: data.providerId,
    listingId: listingSnap.exists
      ? { _id: listingSnap.id, title: listingSnap.data()?.title, ...listingSnap.data() }
      : null,
    clientId: clientSnap.exists
      ? {
          firstname: clientSnap.data()?.firstname,
          lastname: clientSnap.data()?.lastname,
          email: clientSnap.data()?.email,
        }
      : null,
    providerId: providerSnap.exists
      ? {
          firstname: providerSnap.data()?.firstname,
          lastname: providerSnap.data()?.lastname,
          email: providerSnap.data()?.email,
        }
      : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const db = getAdminDb();

    await processOverdueMissionsForUser(db, uid);

    const [listingsSnap, fromTx, toTx, clientMissions, providerMissions, clientDone, providerDone] =
      await Promise.all([
      db.collection('listings').where('userId', '==', uid).limit(50).get(),
      db.collection('transactions').where('fromUserId', '==', uid).limit(50).get(),
      db.collection('transactions').where('toUserId', '==', uid).limit(50).get(),
      db.collection('missions').where('clientId', '==', uid).where('status', '==', 'in_progress').get(),
      db.collection('missions').where('providerId', '==', uid).where('status', '==', 'in_progress').get(),
      db.collection('missions').where('clientId', '==', uid).where('status', '==', 'completed').limit(10).get(),
      db.collection('missions').where('providerId', '==', uid).where('status', '==', 'completed').limit(10).get(),
    ]);

    const txMap = new Map<string, Record<string, unknown>>();
    for (const d of [...fromTx.docs, ...toTx.docs]) {
      const data = d.data();
      txMap.set(d.id, {
        _id: d.id,
        amount: data.amount,
        type: data.type,
        description: data.description || '',
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || '',
      });
    }
    const transactions = Array.from(txMap.values()).sort(
      (a, b) =>
        new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime()
    );

    const listings = listingsSnap.docs
      .filter((d) => isListingVisible(d.data().status))
      .map((d) => ({
        _id: d.id,
        authorId: String(d.data().userId || ''),
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
      }));

    const missionIds = new Set<string>();
    const missions = [];
    for (const d of [...clientMissions.docs, ...providerMissions.docs]) {
      if (missionIds.has(d.id)) continue;
      missionIds.add(d.id);
      missions.push(await mapMissionDoc(db, uid, d, true));
    }

    const completedIds = new Set<string>();
    const completedMissions = [];
    for (const d of [...clientDone.docs, ...providerDone.docs]) {
      if (completedIds.has(d.id)) continue;
      completedIds.add(d.id);
      completedMissions.push(await mapMissionDoc(db, uid, d, false));
    }

    return jsonNoStore({ transactions, listings, missions, completedMissions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 401 }
    );
  }
}
