import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { holdEscrow } from '@/lib/firebase/wallet';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    const db = getAdminDb();
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

    await missionRef.set({
      listingId: params.id,
      clientId,
      providerId,
      amount: listing.price,
      status: 'in_progress',
      escrowHeld: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    await missionRef.collection('messages').add({
      senderId: 'system',
      senderName: 'MILOU',
      text: 'Mission démarrée. Utilisez ce fil pour vous écrire et coordonner le service.',
      createdAt: FieldValue.serverTimestamp(),
    });

    await listingRef.update({ status: 'in_progress' });

    return NextResponse.json({ missionId: missionRef.id, message: 'Mission démarrée' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
