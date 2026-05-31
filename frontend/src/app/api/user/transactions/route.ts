import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { tsToIso } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Number(searchParams.get('limit') || 50));
    const typeFilter = searchParams.get('type');

    const db = getAdminDb();
    const [fromSnap, toSnap] = await Promise.all([
      db.collection('transactions').where('fromUserId', '==', uid).limit(limit).get(),
      db.collection('transactions').where('toUserId', '==', uid).limit(limit).get(),
    ]);

    const map = new Map<string, Record<string, unknown>>();
    const enrichUser = async (id: string | null) => {
      if (!id) return null;
      const u = await db.collection('users').doc(id).get();
      if (!u.exists) return null;
      const d = u.data()!;
      return { firstname: d.firstname, lastname: d.lastname, email: d.email };
    };

    for (const doc of [...fromSnap.docs, ...toSnap.docs]) {
      if (map.has(doc.id)) continue;
      const data = doc.data();
      if (typeFilter && data.type !== typeFilter) continue;
      map.set(doc.id, {
        _id: doc.id,
        ...data,
        createdAt: tsToIso(data.createdAt),
      });
    }

    const transactions = await Promise.all(
      Array.from(map.values())
        .sort(
          (a, b) =>
            new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime()
        )
        .slice(0, limit)
        .map(async (tx) => {
          const fromId = tx.fromUserId as string | null;
          const toId = tx.toUserId as string | null;
          return {
            ...tx,
            fromUserId: fromId ? await enrichUser(fromId) : null,
            toUserId: toId ? await enrichUser(toId) : null,
          };
        })
    );

    return NextResponse.json({ transactions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 401 }
    );
  }
}
