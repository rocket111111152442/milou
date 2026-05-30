import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';
import { transferMilou, userToJson } from '@/lib/firebase/wallet';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);

    const { amount, action } = await req.json();
    const num = Math.abs(Number(amount));
    const db = getAdminDb();

    if (action === 'add') {
      await transferMilou(db, {
        fromUserId: null,
        toUserId: params.id,
        amount: num,
        type: 'admin_adjustment',
        description: 'Ajustement admin (+)',
      });
    } else {
      const userSnap = await db.collection('users').doc(params.id).get();
      if ((userSnap.data()?.balance ?? 0) < num) {
        return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });
      }
      await transferMilou(db, {
        fromUserId: params.id,
        toUserId: null,
        amount: num,
        type: 'admin_adjustment',
        description: 'Ajustement admin (-)',
      });
    }

    await logAdminAction(adminId, 'balance_adjust', { type: 'user', id: params.id }, { amount: num, action });

    const updated = await db.collection('users').doc(params.id).get();
    return NextResponse.json({ user: userToJson(updated.id, updated.data()!) });
  } catch (err) {
    return adminError(err);
  }
}
