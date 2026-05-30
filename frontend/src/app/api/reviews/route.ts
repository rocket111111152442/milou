import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { createNotification } from '@/lib/notifications';
import { tsToIso, userToJson } from '@/lib/firebase/wallet';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const { missionId, rating, comment } = await req.json();
    const r = Number(rating);
    if (!missionId || r < 1 || r > 5) {
      return NextResponse.json({ error: 'Note entre 1 et 5 requise' }, { status: 400 });
    }

    const db = getAdminDb();
    const missionRef = db.collection('missions').doc(missionId);
    const missionSnap = await missionRef.get();
    if (!missionSnap.exists) {
      return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });
    }

    const mission = missionSnap.data()!;
    if (mission.status !== 'completed') {
      return NextResponse.json({ error: 'Mission non terminée' }, { status: 400 });
    }

    let actualTo: string | null = null;
    if (mission.clientId === uid) actualTo = mission.providerId as string;
    else if (mission.providerId === uid) actualTo = mission.clientId as string;

    if (!actualTo) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const existing = await db
      .collection('reviews')
      .where('missionId', '==', missionId)
      .where('fromUserId', '==', uid)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ error: 'Avis déjà envoyé' }, { status: 400 });
    }

    await db.collection('reviews').add({
      missionId,
      fromUserId: uid,
      toUserId: actualTo,
      rating: r,
      comment: String(comment || '').trim().slice(0, 500),
      createdAt: FieldValue.serverTimestamp(),
    });

    const targetRef = db.collection('users').doc(actualTo);
    const targetSnap = await targetRef.get();
    const tData = targetSnap.data()!;
    const count = Number(tData.reviewCount ?? 0) + 1;
    const avg =
      (Number(tData.averageRating ?? 0) * Number(tData.reviewCount ?? 0) + r) / count;

    await targetRef.update({
      reviewCount: count,
      averageRating: Math.round(avg * 10) / 10,
      reputation: FieldValue.increment(1),
    });

    await createNotification(db, {
      userId: actualTo,
      type: 'review_received',
      title: 'Nouvel avis reçu',
      body: `Note ${r}/5 sur votre mission`,
      link: '/profile',
    });

    return NextResponse.json({ message: 'Avis enregistré' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    const snap = await getAdminDb()
      .collection('reviews')
      .where('toUserId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const reviews = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const fromSnap = await getAdminDb().collection('users').doc(data.fromUserId).get();
        const from = fromSnap.exists ? userToJson(fromSnap.id, fromSnap.data()!) : null;
        return {
          _id: d.id,
          rating: data.rating,
          comment: data.comment,
          from,
          createdAt: tsToIso(data.createdAt),
        };
      })
    );

    return NextResponse.json({ reviews });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 }
    );
  }
}
