import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError } from '@/lib/firebase/admin-guard';
import { tsToIso } from '@/lib/firebase/wallet';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);
    const snap = await getAdminDb()
      .collection('missions')
      .doc(params.id)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(200)
      .get();

    const messages = snap.docs.map((d) => ({
      _id: d.id,
      ...d.data(),
      createdAt: tsToIso(d.data().createdAt),
    }));

    return NextResponse.json({ messages });
  } catch (err) {
    return adminError(err);
  }
}
