import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { userToJson } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const snap = await getAdminDb().collection('users').doc(uid).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }
    return NextResponse.json({ user: userToJson(snap.id, snap.data()!) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 401 }
    );
  }
}
