import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { userToJson } from '@/lib/firebase/wallet';
import { isValidPostalCode, normalizePostalCode } from '@/lib/postal-code';
import { syncPremiumStatus } from '@/lib/premium/sync';

export async function PATCH(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const { postalCode } = await req.json();
    const normalized = normalizePostalCode(postalCode);

    if (!isValidPostalCode(normalized)) {
      return NextResponse.json(
        { error: 'Code postal invalide (5 chiffres, ex. 75001).' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }

    await userRef.update({ postalCode: normalized });
    const synced = await syncPremiumStatus(db, uid);

    return NextResponse.json({ user: userToJson(uid, synced) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: err instanceof Error && err.message.includes('e-mail') ? 403 : 400 }
    );
  }
}
