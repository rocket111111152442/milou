import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { createNotification } from '@/lib/notifications';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    const { reason, details } = await req.json();
    const trimmedReason = String(reason || '').trim();
    const trimmedDetails = String(details || '').trim();

    if (trimmedReason.length < 3) {
      return NextResponse.json({ error: 'Indiquez un motif' }, { status: 400 });
    }

    const db = getAdminDb();
    const listingSnap = await db.collection('listings').doc(params.id).get();
    if (!listingSnap.exists) {
      return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 });
    }

    await db.collection('listing_reports').add({
      listingId: params.id,
      reporterId: uid,
      reason: trimmedReason,
      details: trimmedDetails.slice(0, 500),
      status: 'pending',
      listingTitle: String(listingSnap.data()?.title || ''),
      createdAt: FieldValue.serverTimestamp(),
    });

    const mods = await db.collection('users').where('role', 'in', ['admin', 'moderator']).limit(10).get();
    await Promise.all(
      mods.docs.map((m) =>
        createNotification(db, {
          userId: m.id,
          type: 'system',
          title: 'Annonce signalée',
          body: String(listingSnap.data()?.title || 'Annonce'),
          link: '/admin',
        })
      )
    );

    return NextResponse.json({ message: 'Signalement envoyé' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
