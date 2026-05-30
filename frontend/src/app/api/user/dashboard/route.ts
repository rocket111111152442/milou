import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { countUnreadMessages } from '@/lib/mission-unread';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const db = getAdminDb();

    const [listingsSnap, fromTx, toTx, clientMissions, providerMissions] = await Promise.all([
      db.collection('listings').where('userId', '==', uid).limit(50).get(),
      db.collection('transactions').where('fromUserId', '==', uid).limit(50).get(),
      db.collection('transactions').where('toUserId', '==', uid).limit(50).get(),
      db.collection('missions').where('clientId', '==', uid).where('status', '==', 'in_progress').get(),
      db.collection('missions').where('providerId', '==', uid).where('status', '==', 'in_progress').get(),
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

    const listings = listingsSnap.docs.map((d) => ({
      _id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
    }));

    const missionIds = new Set<string>();
    const missions = [];
    for (const d of [...clientMissions.docs, ...providerMissions.docs]) {
      if (missionIds.has(d.id)) continue;
      missionIds.add(d.id);
      const data = d.data();
      const listingSnap = await db.collection('listings').doc(data.listingId as string).get();
      const clientSnap = await db.collection('users').doc(data.clientId as string).get();
      const providerSnap = await db.collection('users').doc(data.providerId as string).get();
      const unreadCount = await countUnreadMessages(db, d.id, uid);

      missions.push({
        _id: d.id,
        amount: data.amount,
        status: data.status,
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
      });
    }

    return NextResponse.json({ transactions, listings, missions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 401 }
    );
  }
}
