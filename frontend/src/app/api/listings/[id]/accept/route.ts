import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { holdEscrow } from '@/lib/firebase/wallet';
import { createNotification } from '@/lib/notifications';
import { assertCanAcceptMission } from '@/lib/premium/usage';
import { syncPremiumStatus } from '@/lib/premium/sync';
import { computeDueAt } from '@/lib/mission-deadline';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    const db = getAdminDb();
    const userData = await syncPremiumStatus(db, uid);
    await assertCanAcceptMission(db, uid, userData);

    const listingRef = db.collection('listings').doc(params.id);
    const listingSnap = await listingRef.get();

    if (!listingSnap.exists) {
      return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 });
    }
    const listing = listingSnap.data()!;

    if (listing.status !== 'open') {
      return NextResponse.json({ error: 'Annonce non disponible' }, { status: 400 });
    }
    if (listing.userId === uid) {
      return NextResponse.json({ error: 'Vous ne pouvez pas accepter votre propre annonce' }, { status: 400 });
    }

    let clientId: string;
    let providerId: string;
    if (listing.type === 'offer') {
      clientId = uid;
      providerId = listing.userId;
    } else {
      clientId = listing.userId;
      providerId = uid;
    }

    const clientSnap = await db.collection('users').doc(clientId).get();
    if ((clientSnap.data()?.balance ?? 0) < listing.price) {
      return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });
    }

    const missionRef = db.collection('missions').doc();
    await holdEscrow(db, clientId, listing.price, params.id, missionRef.id);

    const startedAt = new Date();
    const estimatedDelay = String(listing.estimatedDelay || '7 jours');
    const dueAt = computeDueAt(startedAt, estimatedDelay);

    await missionRef.set({
      listingId: params.id,
      clientId,
      providerId,
      amount: listing.price,
      status: 'in_progress',
      escrowHeld: true,
      estimatedDelay,
      dueAt: Timestamp.fromDate(dueAt),
      createdAt: FieldValue.serverTimestamp(),
    });

    await missionRef.collection('messages').add({
      senderId: 'system',
      senderName: 'MILOU',
      text: `Mission démarrée. Date limite : ${dueAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (${estimatedDelay}). Le client doit valider la mission une fois le travail terminé.`,
      createdAt: FieldValue.serverTimestamp(),
    });

    await listingRef.update({ status: 'in_progress' });

    await Promise.all([
      createNotification(db, {
        userId: clientId,
        type: 'mission_started',
        title: 'Mission démarrée',
        body: `Escrow de ${listing.price} M — en attente de validation`,
        link: '/dashboard',
      }),
      createNotification(db, {
        userId: providerId,
        type: 'mission_started',
        title: 'Nouvelle mission',
        body: `Un client a accepté votre annonce « ${listing.title} »`,
        link: '/dashboard',
      }),
    ]);

    return NextResponse.json({ missionId: missionRef.id, message: 'Mission démarrée' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
