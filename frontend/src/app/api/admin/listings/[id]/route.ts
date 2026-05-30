import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    await getAdminDb().collection('listings').doc(params.id).delete();
    await logAdminAction(adminId, 'listing_delete', { type: 'listing', id: params.id });
    return NextResponse.json({ message: 'Annonce supprimée' });
  } catch (err) {
    return adminError(err);
  }
}
