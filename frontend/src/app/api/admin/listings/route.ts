import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError } from '@/lib/firebase/admin-guard';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const snap = await getAdminDb().collection('listings').orderBy('createdAt', 'desc').limit(100).get();
    const listings = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const userSnap = await getAdminDb().collection('users').doc(data.userId).get();
        const u = userSnap.data();
        return {
          _id: d.id,
          ...data,
          userId: u
            ? { firstname: u.firstname, lastname: u.lastname, email: u.email }
            : { firstname: '', lastname: '', email: '' },
        };
      })
    );
    return NextResponse.json({ listings });
  } catch (err) {
    return adminError(err);
  }
}
