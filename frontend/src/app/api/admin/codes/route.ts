import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';
import { normalizePromoCode } from '@/lib/promo-codes';
import { tsToIso } from '@/lib/firebase/wallet';

export const dynamic = 'force-dynamic';

function mapCode(id: string, data: Record<string, unknown>) {
  return {
    _id: id,
    code: data.code || id,
    label: data.label || '',
    milouAmount: Number(data.milouAmount || 0),
    premiumDays: Number(data.premiumDays || 0),
    reputationBonus: Number(data.reputationBonus || 0),
    maxUses: Number(data.maxUses || 0),
    maxUsesPerUser: Number(data.maxUsesPerUser || 1),
    minAccountAgeDays: Number(data.minAccountAgeDays || 0),
    active: Boolean(data.active),
    usedCount: Number(data.usedCount || 0),
    expiresAt: data.expiresAt ? tsToIso(data.expiresAt) : null,
    createdAt: tsToIso(data.createdAt),
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const snap = await getAdminDb().collection('promo_codes').orderBy('createdAt', 'desc').limit(50).get();
    const codes = snap.docs.map((d) => mapCode(d.id, d.data()));
    return NextResponse.json({ codes });
  } catch (err) {
    return adminError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminId = await requireAdmin(req);
    const body = await req.json();
    const codeId = normalizePromoCode(body.code);
    if (!codeId || codeId.length < 3) {
      return NextResponse.json({ error: 'Code invalide (3 caractères min., lettres/chiffres)' }, { status: 400 });
    }

    const db = getAdminDb();
    const existing = await db.collection('promo_codes').doc(codeId).get();
    if (existing.exists) {
      return NextResponse.json({ error: 'Ce code existe déjà' }, { status: 400 });
    }

    const milouAmount = Math.max(0, Number(body.milouAmount || 0));
    const premiumDays = Math.max(0, Number(body.premiumDays || 0));
    const reputationBonus = Math.max(0, Number(body.reputationBonus || 0));
    if (milouAmount === 0 && premiumDays === 0 && reputationBonus === 0) {
      return NextResponse.json({ error: 'Ajoutez au moins une récompense' }, { status: 400 });
    }

    let expiresAt: Timestamp | null = null;
    if (body.expiresAt) {
      const d = new Date(body.expiresAt);
      if (!Number.isNaN(d.getTime())) expiresAt = Timestamp.fromDate(d);
    }

    const data = {
      code: codeId,
      label: String(body.label || '').trim(),
      milouAmount,
      premiumDays,
      reputationBonus,
      maxUses: Math.max(0, Number(body.maxUses || 0)),
      maxUsesPerUser: Math.max(1, Number(body.maxUsesPerUser || 1)),
      minAccountAgeDays: Math.max(0, Number(body.minAccountAgeDays || 0)),
      active: body.active !== false,
      usedCount: 0,
      createdBy: adminId,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    };

    await db.collection('promo_codes').doc(codeId).set(data);
    await logAdminAction(adminId, 'promo_code_create', { type: 'promo_code', id: codeId });

    return NextResponse.json({
      code: {
        _id: codeId,
        ...data,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt?.toDate?.()?.toISOString() || null,
      },
    });
  } catch (err) {
    return adminError(err);
  }
}
