import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { jsonNoStore } from '@/lib/http';

export const dynamic = 'force-dynamic';

const REASONS = new Set([
  'injuste',
  'harcelement',
  'hors_sujet',
  'erreur',
  'autre',
]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    const { reason, details } = await req.json();
    const reasonKey = String(reason || '').trim();

    if (!REASONS.has(reasonKey)) {
      return NextResponse.json({ error: 'Motif de signalement invalide' }, { status: 400 });
    }

    const detailText = String(details || '').trim().slice(0, 1000);
    if (detailText.length < 10) {
      return NextResponse.json(
        { error: 'Décrivez le problème (10 caractères minimum)' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const reviewRef = db.collection('reviews').doc(params.id);
    const reviewSnap = await reviewRef.get();
    if (!reviewSnap.exists) {
      return NextResponse.json({ error: 'Avis introuvable' }, { status: 404 });
    }

    const review = reviewSnap.data()!;
    const toUserId = String(review.toUserId);

    if (toUserId !== uid) {
      return NextResponse.json(
        { error: 'Seul le destinataire de l\'avis peut le signaler' },
        { status: 403 }
      );
    }

    if (String(review.fromUserId) === uid) {
      return NextResponse.json({ error: 'Vous ne pouvez pas signaler votre propre avis' }, { status: 400 });
    }

    const existing = await db.collection('review_reports').where('reviewId', '==', params.id).limit(30).get();

    if (existing.docs.some((d) => d.data().reporterId === uid)) {
      return NextResponse.json(
        { error: 'Vous avez déjà signalé cet avis. Les modérateurs vont l\'examiner.' },
        { status: 400 }
      );
    }

    const fromSnap = await db.collection('users').doc(String(review.fromUserId)).get();
    const from = fromSnap.data();

    await db.collection('review_reports').add({
      reviewId: params.id,
      reporterId: uid,
      reason: reasonKey,
      details: detailText,
      status: 'pending',
      reviewSnapshot: {
        rating: review.rating,
        comment: review.comment || '',
        missionId: review.missionId || '',
        fromUserId: review.fromUserId,
        toUserId: review.toUserId,
        fromName: from ? `${from.firstname} ${from.lastname}`.trim() : 'Utilisateur',
        autoPenalty: Boolean(review.autoPenalty),
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return jsonNoStore({
      message: 'Signalement envoyé. Un modérateur examinera cet avis.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: err instanceof Error && err.message.includes('Authentification') ? 401 : 400 }
    );
  }
}
