import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';
import { releaseEscrow, refundEscrowToClient } from '@/lib/firebase/wallet';
import { createNotification } from '@/lib/notifications';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    const { decision, adminNote } = await req.json();

    if (!['release', 'refund'].includes(decision)) {
      return NextResponse.json({ error: 'Décision invalide (release ou refund)' }, { status: 400 });
    }

    const db = getAdminDb();
    const missionRef = db.collection('missions').doc(params.id);
    const missionSnap = await missionRef.get();

    if (!missionSnap.exists) {
      return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });
    }
    const mission = missionSnap.data()!;

    if (mission.status !== 'disputed') {
      return NextResponse.json({ error: 'Cette mission n’est pas en litige' }, { status: 400 });
    }

    const listingId = String(mission.listingId);
    const clientId = String(mission.clientId);
    const providerId = String(mission.providerId);
    const amount = Number(mission.amount || 0);

    if (decision === 'release') {
      if (mission.escrowHeld) {
        await releaseEscrow(db, providerId, amount, listingId, params.id);
      }
      await missionRef.update({
        status: 'completed',
        escrowHeld: false,
        disputeResolvedAt: FieldValue.serverTimestamp(),
        disputeResolvedBy: adminId,
        disputeAdminDecision: 'release',
        disputeAdminNote: String(adminNote || '').trim() || null,
      });
      await db.collection('listings').doc(listingId).update({ status: 'closed' });

      await Promise.all([
        createNotification(db, {
          userId: providerId,
          type: 'mission_completed',
          title: 'Litige tranché — paiement libéré',
          body: `${amount} M ont été crédités après examen admin`,
          link: '/dashboard',
        }),
        createNotification(db, {
          userId: clientId,
          type: 'system',
          title: 'Litige clos',
          body: 'L’administrateur a validé le paiement au prestataire',
          link: '/dashboard',
        }),
      ]);
    } else {
      if (mission.escrowHeld) {
        await refundEscrowToClient(
          db,
          clientId,
          amount,
          listingId,
          params.id,
          'Remboursement — litige tranché en faveur du client'
        );
      }
      await missionRef.update({
        status: 'cancelled',
        escrowHeld: false,
        disputeResolvedAt: FieldValue.serverTimestamp(),
        disputeResolvedBy: adminId,
        disputeAdminDecision: 'refund',
        disputeAdminNote: String(adminNote || '').trim() || null,
      });
      await db.collection('listings').doc(listingId).update({ status: 'closed' });

      await Promise.all([
        createNotification(db, {
          userId: clientId,
          type: 'system',
          title: 'Litige clos — remboursement',
          body: `${amount} M vous ont été remboursés`,
          link: '/dashboard',
        }),
        createNotification(db, {
          userId: providerId,
          type: 'system',
          title: 'Litige clos',
          body: 'L’administrateur a remboursé le client',
          link: '/dashboard',
        }),
      ]);
    }

    await logAdminAction(
      adminId,
      'dispute_resolve',
      { type: 'mission', id: params.id },
      { decision, adminNote: adminNote || '' }
    );

    return NextResponse.json({
      message:
        decision === 'release'
          ? 'Paiement libéré au prestataire'
          : 'Client remboursé, mission annulée',
    });
  } catch (err) {
    return adminError(err);
  }
}
