import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { tsToIso } from '@/lib/firebase/wallet';

export async function GET() {
  try {
    const snap = await getAdminDb()
      .collection('platform_announcements')
      .where('active', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ announcement: null });
    }

    const d = snap.docs[0];
    const data = d.data();
    return NextResponse.json({
      announcement: {
        _id: d.id,
        title: data.title,
        message: data.message,
        active: true,
        createdAt: tsToIso(data.createdAt),
      },
    });
  } catch {
    return NextResponse.json({ announcement: null });
  }
}
