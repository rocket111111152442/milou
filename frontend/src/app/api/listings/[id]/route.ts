import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { jsonNoStore } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getAdminDb();
    const ref = db.collection('listings').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 });
    }

    const data = snap.data()!;
    const status = String(data.status || '');

    let uid: string;
    try {
      const auth = await verifyRequest(req);
      uid = auth.uid;
    } catch {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const userSnap = await db.collection('users').doc(uid).get();
    const role = String(userSnap.data()?.role || 'user');
    const isStaff = role === 'admin' || role === 'moderator';
    const isOwner = String(data.userId) === uid;

    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    if (!isStaff && status === 'in_progress') {
      return NextResponse.json(
        { error: 'Impossible de supprimer : une mission est en cours sur cette annonce.' },
        { status: 400 }
      );
    }

    if (!isStaff && !['open', 'closed', 'in_progress'].includes(status)) {
      return NextResponse.json({ error: 'Cette annonce ne peut pas être supprimée.' }, { status: 400 });
    }

    const missionSnap = await db.collection('missions').where('listingId', '==', params.id).get();
    const hasActiveMission = missionSnap.docs.some((d) =>
      ['pending', 'in_progress', 'escrow_held'].includes(String(d.data().status))
    );

    if (hasActiveMission && !isStaff) {
      return NextResponse.json(
        { error: 'Terminez ou annulez la mission avant de supprimer l\'annonce.' },
        { status: 400 }
      );
    }

    if (isStaff) {
      await ref.delete();
    } else {
      await ref.update({
        status: 'deleted',
        deletedAt: FieldValue.serverTimestamp(),
        deletedBy: uid,
      });
    }

    return jsonNoStore({ message: 'Annonce supprimée du site', id: params.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 }
    );
  }
}
