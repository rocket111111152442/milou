import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError } from '@/lib/firebase/admin-guard';
import { tsToIso } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const type = req.nextUrl.searchParams.get('type');
    const minAmount = Number(req.nextUrl.searchParams.get('minAmount') || 0);
    const userId = req.nextUrl.searchParams.get('userId');

    const snap = await getAdminDb().collection('transactions').orderBy('createdAt', 'desc').limit(300).get();
    let transactions = snap.docs.map((d) => {
      const data = d.data();
      return {
        _id: d.id,
        ...data,
        createdAt: tsToIso(data.createdAt),
      } as Record<string, unknown> & { _id: string; createdAt: string };
    });

    if (type) transactions = transactions.filter((t) => t.type === type);
    if (minAmount > 0) transactions = transactions.filter((t) => Number(t.amount) >= minAmount);
    if (userId) {
      transactions = transactions.filter(
        (t) => t.fromUserId === userId || t.toUserId === userId
      );
    }

    return NextResponse.json({ transactions });
  } catch (err) {
    return adminError(err);
  }
}
