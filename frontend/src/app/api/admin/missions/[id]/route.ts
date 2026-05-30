import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    const { status } = await req.json();
    if (!['cancelled', 'completed', 'in_progress', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const ref = getAdminDb().collection('missions').doc(params.id);
    await ref.update({ status, adminOverrideAt: FieldValue.serverTimestamp() });
    await logAdminAction(adminId, 'mission_status', { type: 'mission', id: params.id }, { status });

    return NextResponse.json({ message: 'Mission mise à jour', status });
  } catch (err) {
    return adminError(err);
  }
}
