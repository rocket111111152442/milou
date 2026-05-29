import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const adminSnap = await getAdminDb().collection('users').doc(uid).get();
    if (adminSnap.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès admin requis' }, { status: 403 });
    }
    const snap = await getAdminDb().collection('listings').orderBy('createdAt', 'desc').limit(100).get();
    const listings = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const userSnap = await getAdminDb().collection('users').doc(data.userId).get();
        const u = userSnap.data();
        return {
          _id: d.id,
          ...data,
          userId: u
            ? { firstname: u.firstname, lastname: u.lastname, email: u.email }
            : { firstname: '', lastname: '', email: '' },
        };
      })
    );
    return NextResponse.json({ listings });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur' }, { status: 401 });
  }
}
