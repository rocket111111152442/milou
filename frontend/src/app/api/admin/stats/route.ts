import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError } from '@/lib/firebase/admin-guard';
import { userToJson } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();

    const [usersSnap, listingsSnap, missionsSnap, txSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('listings').get(),
      db.collection('missions').get(),
      db.collection('transactions').limit(5000).get(),
    ]);

    const users = usersSnap.docs.map((d) => userToJson(d.id, d.data()));
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter((u) => (u.status ?? 'active') === 'active').length,
      suspendedUsers: users.filter((u) => u.status === 'suspended').length,
      bannedUsers: users.filter((u) => u.status === 'banned').length,
      totalMilouInCirculation: users.reduce((s, u) => s + u.balance, 0),
      totalListings: listingsSnap.size,
      openListings: listingsSnap.docs.filter((d) => d.data().status === 'open').length,
      totalMissions: missionsSnap.size,
      activeMissions: missionsSnap.docs.filter((d) =>
        ['pending', 'in_progress', 'escrow_held'].includes(String(d.data().status))
      ).length,
      totalTransactions: txSnap.size,
      registrationsLast7Days: users.filter((u) => new Date(u.createdAt).getTime() > weekAgo).length,
      topBalances: [...users]
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 5)
        .map((u) => ({
          id: u.id,
          name: `${u.firstname} ${u.lastname}`.trim(),
          email: u.email,
          balance: u.balance,
        })),
    };

    return NextResponse.json({ stats });
  } catch (err) {
    return adminError(err);
  }
}
