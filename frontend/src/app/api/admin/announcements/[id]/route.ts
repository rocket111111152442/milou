import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    const ref = getAdminDb().collection('platform_announcements').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 });
    }
    await ref.delete();
    await logAdminAction(adminId, 'announcement_delete', { type: 'announcement', id: params.id });
    return NextResponse.json({ message: 'Annonce supprimée' });
  } catch (err) {
    return adminError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    const { active } = await req.json();
    const db = getAdminDb();
    const ref = db.collection('platform_announcements').doc(params.id);

    if (active) {
      const existing = await db.collection('platform_announcements').where('active', '==', true).get();
      const batch = db.batch();
      existing.docs.forEach((d) => {
        if (d.id !== params.id) batch.update(d.ref, { active: false });
      });
      await batch.commit();
    }

    await ref.update({ active: Boolean(active) });
    await logAdminAction(adminId, 'announcement_update', { type: 'announcement', id: params.id });
    return NextResponse.json({ message: 'Annonce mise à jour' });
  } catch (err) {
    return adminError(err);
  }
}
