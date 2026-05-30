import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError } from '@/lib/firebase/admin-guard';
import { tsToIso } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();
    const snap = await db.collection('missions').orderBy('createdAt', 'desc').limit(100).get();

    const missions = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const [clientSnap, providerSnap] = await Promise.all([
          db.collection('users').doc(data.clientId).get(),
          db.collection('users').doc(data.providerId).get(),
        ]);
        const c = clientSnap.data();
        const p = providerSnap.data();
        return {
          _id: d.id,
          ...data,
          clientId: c
            ? { firstname: c.firstname, lastname: c.lastname, email: c.email }
            : { firstname: '?', lastname: '', email: '' },
          providerId: p
            ? { firstname: p.firstname, lastname: p.lastname, email: p.email }
            : { firstname: '?', lastname: '', email: '' },
          createdAt: tsToIso(data.createdAt),
        };
      })
    );

    return NextResponse.json({ missions });
  } catch (err) {
    return adminError(err);
  }
}
