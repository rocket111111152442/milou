import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyRequest } from '@/lib/firebase/auth-server';
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

    if (!isStaff && status !== 'open' && status !== 'closed') {
      return NextResponse.json({ error: 'Cette annonce ne peut pas être supprimée.' }, { status: 400 });
    }

    const activeMission = await db
      .collection('missions')
      .where('listingId', '==', params.id)
      .where('status', 'in', ['pending', 'in_progress', 'escrow_held'])
      .limit(1)
      .get();

    if (!activeMission.empty && !isStaff) {
      return NextResponse.json(
        { error: 'Terminez ou annulez la mission avant de supprimer l\'annonce.' },
        { status: 400 }
      );
    }

    await ref.delete();
    return NextResponse.json({ message: 'Annonce supprimée du site' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 }
    );
  }
}
