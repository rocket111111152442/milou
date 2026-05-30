import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    const db = getAdminDb();
    const missionSnap = await db.collection('missions').doc(params.id).get();

    if (!missionSnap.exists) {
      return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });
    }
    const data = missionSnap.data()!;
    if (data.clientId !== uid && data.providerId !== uid) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    await db
      .collection('missions')
      .doc(params.id)
      .collection('readReceipts')
      .doc(uid)
      .set({ lastReadAt: FieldValue.serverTimestamp() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
