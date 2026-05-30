import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError } from '@/lib/firebase/admin-guard';
import { tsToIso, userToJson } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const snap = await getAdminDb()
      .collection('admin_audit')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const db = getAdminDb();
    const entries = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        let adminName = data.adminId;
        const adminSnap = await db.collection('users').doc(data.adminId).get();
        if (adminSnap.exists) {
          const u = userToJson(adminSnap.id, adminSnap.data()!);
          adminName = `${u.firstname} ${u.lastname}`.trim() || u.email;
        }
        return {
          _id: d.id,
          adminId: data.adminId,
          adminName,
          action: data.action,
          targetType: data.targetType,
          targetId: data.targetId,
          details: data.details ?? {},
          createdAt: tsToIso(data.createdAt),
        };
      })
    );

    return NextResponse.json({ entries });
  } catch (err) {
    return adminError(err);
  }
}
