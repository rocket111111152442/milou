import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { createNotification } from '@/lib/notifications';
import { tsToIso } from '@/lib/firebase/wallet';
import { jsonNoStore } from '@/lib/http';
import { publicReviewer, reputationDeltaForRating, REVIEW_COMMENT_MAX } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

class ReviewError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const { missionId, rating, comment } = await req.json();
    const r = Number(rating);
    if (!missionId || typeof missionId !== 'string' || !Number.isInteger(r) || r < 1 || r > 5) {
      return NextResponse.json({ error: 'Choisissez une note entre 1 et 5 étoiles' }, { status: 400 });
    }
    const text = String(comment || '').trim().slice(0, REVIEW_COMMENT_MAX);

    const db = getAdminDb();
    const missionRef = db.collection('missions').doc(missionId);
    // ID déterministe : empêche physiquement deux avis du même auteur sur la même mission (double clic, onglets).
    const reviewRef = db.collection('reviews').doc(`${missionId}_${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const missionSnap = await tx.get(missionRef);
      if (!missionSnap.exists) throw new ReviewError('Mission introuvable', 404);

      const mission = missionSnap.data()!;
      if (mission.status !== 'completed') throw new ReviewError('Mission non terminée');
      if (mission.completedReason === 'deadline_missed') {
        throw new ReviewError('Mission clôturée automatiquement (délai dépassé) : avis non disponible');
      }

      let toUserId: string | null = null;
      if (mission.clientId === uid) toUserId = String(mission.providerId);
      else if (mission.providerId === uid) toUserId = String(mission.clientId);
      if (!toUserId) throw new ReviewError('Non autorisé', 403);

      const [existingSnap, legacySnap, targetSnap, listingSnap] = await Promise.all([
        tx.get(reviewRef),
        // Avis créés avant l'ID déterministe
        tx.get(
          db.collection('reviews').where('missionId', '==', missionId).where('fromUserId', '==', uid).limit(1)
        ),
        tx.get(db.collection('users').doc(toUserId)),
        tx.get(db.collection('listings').doc(String(mission.listingId))),
      ]);
      if (existingSnap.exists || !legacySnap.empty) throw new ReviewError('Avis déjà envoyé');
      if (!targetSnap.exists) throw new ReviewError('Utilisateur introuvable', 404);

      const t = targetSnap.data()!;
      const prevCount = Number(t.reviewCount ?? 0);
      const count = prevCount + 1;
      const avg = (Number(t.averageRating ?? 0) * prevCount + r) / count;

      tx.create(reviewRef, {
        missionId,
        listingTitle: String(listingSnap.data()?.title || '').slice(0, 120),
        fromUserId: uid,
        toUserId,
        rating: r,
        comment: text,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(targetSnap.ref, {
        reviewCount: count,
        averageRating: Math.round(avg * 10) / 10,
        reputation: FieldValue.increment(reputationDeltaForRating(r)),
      });
      tx.update(missionRef, mission.clientId === uid ? { clientReviewed: true } : { providerReviewed: true });

      return { toUserId };
    });

    await createNotification(db, {
      userId: result.toUserId,
      type: 'review_received',
      title: 'Nouvel avis reçu',
      body: `${'★'.repeat(r)}${'☆'.repeat(5 - r)} — ${r}/5 sur votre mission`,
      link: '/profile',
    });

    return jsonNoStore({ message: 'Avis enregistré' });
  } catch (err) {
    const status =
      err instanceof ReviewError
        ? err.status
        : err instanceof Error && err.message.includes('Authentification')
          ? 401
          : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur' }, { status });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    const db = getAdminDb();
    const snap = await db.collection('reviews').where('toUserId', '==', userId).limit(100).get();

    const sorted = [...snap.docs].sort(
      (a, b) =>
        (b.data().createdAt?.toDate?.()?.getTime?.() ?? 0) -
        (a.data().createdAt?.toDate?.()?.getTime?.() ?? 0)
    );

    const distribution = [0, 0, 0, 0, 0, 0];
    for (const d of snap.docs) {
      const rating = Math.min(5, Math.max(0, Math.round(Number(d.data().rating ?? 0))));
      distribution[rating] += 1;
    }

    const latest = sorted.slice(0, 30);
    const authorIds = Array.from(new Set(latest.map((d) => String(d.data().fromUserId))));
    const authorSnaps = authorIds.length
      ? await db.getAll(...authorIds.map((id) => db.collection('users').doc(id)))
      : [];
    const authors = new Map(authorSnaps.map((s) => [s.id, publicReviewer(s.id, s.data())]));

    const reviews = latest.map((d) => {
      const data = d.data();
      return {
        _id: d.id,
        rating: Number(data.rating ?? 0),
        comment: String(data.comment || ''),
        listingTitle: String(data.listingTitle || ''),
        autoPenalty: Boolean(data.autoPenalty),
        from: authors.get(String(data.fromUserId)) ?? null,
        createdAt: tsToIso(data.createdAt),
      };
    });

    return jsonNoStore({ reviews, total: snap.size, distribution });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 }
    );
  }
}
