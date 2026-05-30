import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';
import { recalculateUserReviewStats } from '@/lib/reviews';
import { createNotification } from '@/lib/notifications';
import { jsonNoStore } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    const db = getAdminDb();
    const reviewRef = db.collection('reviews').doc(params.id);
    const snap = await reviewRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Avis introuvable' }, { status: 404 });
    }

    const data = snap.data()!;
    const toUserId = String(data.toUserId);
    const fromUserId = String(data.fromUserId);

    await reviewRef.delete();

    const reports = await db.collection('review_reports').where('reviewId', '==', params.id).get();
    const batch = db.batch();
    reports.docs.forEach((d) =>
      batch.update(d.ref, { status: 'resolved', resolvedAt: FieldValue.serverTimestamp() })
    );
    if (!reports.empty) await batch.commit();

    await recalculateUserReviewStats(db, toUserId);

    await logAdminAction(adminId, 'review_delete', { type: 'review', id: params.id }, {
      toUserId,
      fromUserId,
      rating: data.rating,
    });

    await Promise.all([
      createNotification(db, {
        userId: toUserId,
        type: 'system',
        title: 'Avis supprimé',
        body: 'Un modérateur a retiré un avis signalé sur votre profil.',
        link: '/profile',
      }),
      createNotification(db, {
        userId: fromUserId,
        type: 'system',
        title: 'Avis retiré',
        body: 'Un avis que vous aviez laissé a été retiré par la modération.',
        link: '/profile',
      }),
    ]);

    return jsonNoStore({ message: 'Avis supprimé' });
  } catch (err) {
    return adminError(err);
  }
}
