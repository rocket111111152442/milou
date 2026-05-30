import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';
import { tsToIso } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const snap = await getAdminDb()
      .collection('platform_announcements')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const announcements = snap.docs.map((d) => ({
      _id: d.id,
      title: d.data().title,
      message: d.data().message,
      active: Boolean(d.data().active),
      createdAt: tsToIso(d.data().createdAt),
    }));

    return NextResponse.json({ announcements });
  } catch (err) {
    return adminError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminId = await requireAdmin(req);
    const { title, message, active } = await req.json();
    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Titre et message requis' }, { status: 400 });
    }

    if (active) {
      const existing = await getAdminDb()
        .collection('platform_announcements')
        .where('active', '==', true)
        .get();
      const batch = getAdminDb().batch();
      existing.docs.forEach((d) => batch.update(d.ref, { active: false }));
      await batch.commit();
    }

    const ref = await getAdminDb().collection('platform_announcements').add({
      title: String(title).trim(),
      message: String(message).trim(),
      active: Boolean(active),
      createdBy: adminId,
      createdAt: FieldValue.serverTimestamp(),
    });

    await logAdminAction(adminId, 'announcement_create', { type: 'announcement', id: ref.id });

    return NextResponse.json({
      announcement: { _id: ref.id, title, message, active: Boolean(active), createdAt: new Date().toISOString() },
    });
  } catch (err) {
    return adminError(err);
  }
}
