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
    const snap = await getAdminDb().collection('transactions').orderBy('createdAt', 'desc').limit(200).get();
    const transactions = snap.docs.map((d) => ({ _id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() }));
    return NextResponse.json({ transactions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur' }, { status: 401 });
  }
}
