import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    const body = await req.json();
    const ref = getAdminDb().collection('promo_codes').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Code introuvable' }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (body.label !== undefined) update.label = String(body.label).trim();
    if (body.milouAmount !== undefined) update.milouAmount = Math.max(0, Number(body.milouAmount));
    if (body.premiumDays !== undefined) update.premiumDays = Math.max(0, Number(body.premiumDays));
    if (body.reputationBonus !== undefined) update.reputationBonus = Math.max(0, Number(body.reputationBonus));
    if (body.maxUses !== undefined) update.maxUses = Math.max(0, Number(body.maxUses));
    if (body.maxUsesPerUser !== undefined) update.maxUsesPerUser = Math.max(1, Number(body.maxUsesPerUser));
    if (body.minAccountAgeDays !== undefined) update.minAccountAgeDays = Math.max(0, Number(body.minAccountAgeDays));
    if (body.active !== undefined) update.active = Boolean(body.active);
    if (body.expiresAt !== undefined) {
      update.expiresAt = body.expiresAt ? Timestamp.fromDate(new Date(body.expiresAt)) : null;
    }

    await ref.update(update);
    await logAdminAction(adminId, 'promo_code_update', { type: 'promo_code', id: params.id });

    return NextResponse.json({ message: 'Code mis à jour' });
  } catch (err) {
    return adminError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    const db = getAdminDb();
    const ref = db.collection('promo_codes').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Code introuvable' }, { status: 404 });
    }

    const redemptions = await ref.collection('redemptions').limit(500).get();
    const batch = db.batch();
    redemptions.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(ref);
    await batch.commit();

    await logAdminAction(adminId, 'promo_code_delete', { type: 'promo_code', id: params.id });
    return NextResponse.json({ message: 'Code supprimé' });
  } catch (err) {
    return adminError(err);
  }
}
