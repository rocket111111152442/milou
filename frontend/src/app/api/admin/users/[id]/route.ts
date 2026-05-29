import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    if (uid === params.id) {
      return NextResponse.json({ error: 'Impossible de supprimer votre compte admin' }, { status: 400 });
    }
    const adminSnap = await getAdminDb().collection('users').doc(uid).get();
    if (adminSnap.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès admin requis' }, { status: 403 });
    }

    const db = getAdminDb();
    const listings = await db.collection('listings').where('userId', '==', params.id).get();
    const batch = db.batch();
    listings.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection('users').doc(params.id));
    await batch.commit();
    await getAdminAuth().deleteUser(params.id);

    return NextResponse.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
