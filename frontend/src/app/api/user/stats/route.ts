import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { syncPremiumStatus } from '@/lib/premium/sync';
import { tsToIso } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const db = getAdminDb();
    const user = await syncPremiumStatus(db, uid);

    const [listingsSnap, missionsSnap, txFrom, txTo] = await Promise.all([
      db.collection('listings').where('userId', '==', uid).get(),
      db
        .collection('missions')
        .where('status', 'in', ['in_progress', 'completed', 'disputed'])
        .get(),
      db.collection('transactions').where('fromUserId', '==', uid).limit(200).get(),
      db.collection('transactions').where('toUserId', '==', uid).limit(200).get(),
    ]);

    const myListings = listingsSnap.docs.filter((d) => d.data().userId === uid);
    const openListings = myListings.filter((d) => d.data().status === 'open').length;

    const activeMissions = missionsSnap.docs.filter(
      (d) =>
        d.data().status === 'in_progress' &&
        (d.data().clientId === uid || d.data().providerId === uid)
    ).length;

    const completedMissions = missionsSnap.docs.filter(
      (d) =>
        d.data().status === 'completed' &&
        (d.data().clientId === uid || d.data().providerId === uid)
    ).length;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthMs = monthStart.getTime();

    let milouEarnedThisMonth = 0;
    let milouSpentThisMonth = 0;
    const txIds = new Set<string>();

    for (const doc of [...txFrom.docs, ...txTo.docs]) {
      if (txIds.has(doc.id)) continue;
      txIds.add(doc.id);
      const t = doc.data();
      const created = t.createdAt?.toDate?.()?.getTime?.() ?? 0;
      if (created < monthMs) continue;
      const amount = Number(t.amount || 0);
      if (t.toUserId === uid) milouEarnedThisMonth += amount;
      if (t.fromUserId === uid) milouSpentThisMonth += amount;
    }

    return NextResponse.json({
      stats: {
        balance: Number(user.balance || 0),
        totalEarned: Number(user.totalEarned || 0),
        totalSpent: Number(user.totalSpent || 0),
        openListings,
        activeMissions,
        completedMissions,
        reviewsReceived: Number(user.reviewCount || 0),
        averageRating: Number(user.averageRating || 0),
        milouEarnedThisMonth,
        milouSpentThisMonth,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 401 }
    );
  }
}
