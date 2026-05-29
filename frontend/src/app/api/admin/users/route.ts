import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { userToJson } from '@/lib/firebase/wallet';

async function requireAdmin(req: NextRequest) {
  const { uid } = await verifyRequest(req);
  const snap = await getAdminDb().collection('users').doc(uid).get();
  if (snap.data()?.role !== 'admin') throw new Error('Accès admin requis');
  return uid;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const snap = await getAdminDb().collection('users').orderBy('createdAt', 'desc').get();
    const users = snap.docs.map((d) => userToJson(d.id, d.data()));
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: err instanceof Error && err.message.includes('admin') ? 403 : 401 }
    );
  }
}
