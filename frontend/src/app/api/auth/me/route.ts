import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { userToJson } from '@/lib/firebase/wallet';
import { syncPremiumStatus } from '@/lib/premium/sync';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req, { allowUnverifiedEmail: true });
    const snap = await getAdminDb().collection('users').doc(uid).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Profil non créé — complétez l’inscription' }, { status: 404 });
    }
    const synced = await syncPremiumStatus(getAdminDb(), uid);
    const user = userToJson(snap.id, synced);
    if (user.status === 'banned') {
      return NextResponse.json({ error: 'Compte banni. Contactez un modérateur.' }, { status: 403 });
    }
    if (user.status === 'suspended') {
      return NextResponse.json({ error: 'Compte suspendu temporairement.' }, { status: 403 });
    }
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 401 }
    );
  }
}
