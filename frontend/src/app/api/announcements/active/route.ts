import { getAdminDb } from '@/lib/firebase/admin';
import { tsToIso } from '@/lib/firebase/wallet';
import { jsonNoStore } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const snap = await getAdminDb()
      .collection('platform_announcements')
      .where('active', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      return jsonNoStore({ announcement: null });
    }

    const d = snap.docs[0];
    const data = d.data();
    return jsonNoStore({
      announcement: {
        _id: d.id,
        title: data.title,
        message: data.message,
        active: true,
        createdAt: tsToIso(data.createdAt),
      },
    });
  } catch {
    return jsonNoStore({ announcement: null });
  }
}
