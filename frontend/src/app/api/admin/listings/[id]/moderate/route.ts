import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    const { status } = await req.json();
    await getAdminDb().collection('listings').doc(params.id).update({ status });
    await logAdminAction(adminId, 'listing_moderate', { type: 'listing', id: params.id }, { status });
    const listing = await getAdminDb().collection('listings').doc(params.id).get();
    return NextResponse.json({ listing: { id: listing.id, ...listing.data() } });
  } catch (err) {
    return adminError(err);
  }
}
