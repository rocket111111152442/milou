import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError } from '@/lib/firebase/admin-guard';
import { userToJson } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const q = req.nextUrl.searchParams.get('q')?.toLowerCase().trim();
    const role = req.nextUrl.searchParams.get('role');
    const status = req.nextUrl.searchParams.get('status');

    const snap = await getAdminDb().collection('users').orderBy('createdAt', 'desc').get();
    let users = snap.docs.map((d) => userToJson(d.id, d.data()));

    if (q) {
      users = users.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.firstname.toLowerCase().includes(q) ||
          u.lastname.toLowerCase().includes(q) ||
          u.id.includes(q)
      );
    }
    if (role) users = users.filter((u) => u.role === role);
    if (status) users = users.filter((u) => (u.status ?? 'active') === status);

    return NextResponse.json({ users });
  } catch (err) {
    return adminError(err);
  }
}
