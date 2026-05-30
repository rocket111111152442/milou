import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError } from '@/lib/firebase/admin-guard';
import { userToJson } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const snap = await getAdminDb().collection('users').get();
    const users = snap.docs.map((d) => userToJson(d.id, d.data()));

    const header = 'id,firstname,lastname,email,balance,role,status,reputation,totalEarned,totalSpent,transactionCount,createdAt';
    const rows = users.map((u) =>
      [
        u.id,
        u.firstname,
        u.lastname,
        u.email,
        u.balance,
        u.role,
        u.status ?? 'active',
        u.reputation,
        u.totalEarned,
        u.totalSpent,
        u.transactionCount,
        u.createdAt,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = [header, ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="milou-users.csv"',
      },
    });
  } catch (err) {
    return adminError(err);
  }
}
