import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    const adminSnap = await getAdminDb().collection('users').doc(uid).get();
    if (adminSnap.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès admin requis' }, { status: 403 });
    }

    const { status } = await req.json();
    await getAdminDb().collection('listings').doc(params.id).update({ status });
    const listing = await getAdminDb().collection('listings').doc(params.id).get();
    return NextResponse.json({ listing: { id: listing.id, ...listing.data() } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
