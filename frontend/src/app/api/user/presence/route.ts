import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';

const ONLINE_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    await getAdminDb().collection('users').doc(uid).update({
      lastSeenAt: FieldValue.serverTimestamp(),
      isOnline: true,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 401 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await verifyRequest(req);
    const targetId = req.nextUrl.searchParams.get('userId');
    if (!targetId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    const snap = await getAdminDb().collection('users').doc(targetId).get();
    if (!snap.exists) {
      return NextResponse.json({ isOnline: false });
    }

    const data = snap.data()!;
    const last = data.lastSeenAt?.toDate?.() as Date | undefined;
    const isOnline =
      Boolean(data.isOnline) && last && Date.now() - last.getTime() < ONLINE_MS;

    return NextResponse.json({
      isOnline: Boolean(isOnline),
      lastSeenAt: last?.toISOString() || null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 401 }
    );
  }
}
