import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    const { reason } = await req.json();
    const trimmed = String(reason || '').trim();

    if (trimmed.length < 10) {
      return NextResponse.json(
        { error: 'Expliquez en au moins 10 caractères pourquoi vous ne validez pas.' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const missionRef = db.collection('missions').doc(params.id);
    const missionSnap = await missionRef.get();

    if (!missionSnap.exists) {
      return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });
    }
    const mission = missionSnap.data()!;

    if (mission.status !== 'in_progress') {
      return NextResponse.json({ error: 'Cette mission ne peut plus être contestée' }, { status: 400 });
    }
    if (mission.clientId !== uid) {
      return NextResponse.json({ error: 'Seul le client peut refuser la validation' }, { status: 403 });
    }

    await missionRef.update({
      status: 'disputed',
      disputeReason: trimmed,
      disputedAt: FieldValue.serverTimestamp(),
      disputedBy: uid,
    });

    const listingSnap = await db.collection('listings').doc(mission.listingId as string).get();
    const listingTitle = String(listingSnap.data()?.title || 'Mission');

    await createNotification(db, {
      userId: mission.providerId as string,
      type: 'mission_disputed',
      title: 'Validation contestée',
      body: 'Le client a signalé un problème. Un administrateur va trancher.',
      link: '/dashboard',
    });

    const adminsSnap = await db
      .collection('users')
      .where('role', 'in', ['admin', 'moderator'])
      .limit(20)
      .get();

    await Promise.all(
      adminsSnap.docs.map(async (adminDoc) => {
        const admin = adminDoc.data();
        const email = String(admin.email || '').trim();
        if (email) {
          await sendEmail({
            to: email,
            subject: `[MILOU] Litige mission — ${listingTitle}`,
            text: [
              `Un client refuse de valider la mission « ${listingTitle} ».`,
              '',
              `Montant escrow : ${mission.amount} M`,
              `Mission : ${params.id}`,
              '',
              `Motif du client :`,
              trimmed,
              '',
              `Traitez le litige dans l’espace admin : ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin`,
            ].join('\n'),
          });
        }
        await createNotification(db, {
          userId: adminDoc.id,
          type: 'admin_dispute',
          title: 'Litige à traiter',
          body: `${listingTitle} — le client refuse de valider`,
          link: '/admin',
        });
      })
    );

    return NextResponse.json({ message: 'Votre signalement a été envoyé à un administrateur.' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
