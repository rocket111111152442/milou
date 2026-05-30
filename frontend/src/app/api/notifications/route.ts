import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { tsToIso } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const snap = await getAdminDb()
      .collection('notifications')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(40)
      .get();

    const notifications = snap.docs.map((d) => {
      const data = d.data();
      return {
        _id: d.id,
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        link: data.link,
        read: Boolean(data.read),
        createdAt: tsToIso(data.createdAt),
      };
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 401 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const { ids, all } = await req.json();
    const db = getAdminDb();

    if (all) {
      const snap = await db.collection('notifications').where('userId', '==', uid).where('read', '==', false).get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(ids)) {
      const batch = db.batch();
      for (const id of ids) {
        batch.update(db.collection('notifications').doc(id), { read: true });
      }
      await batch.commit();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
