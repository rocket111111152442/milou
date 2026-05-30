import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError } from '@/lib/firebase/admin-guard';
import { mapMessageDoc } from '@/lib/mission-messages';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);
    const snap = await getAdminDb()
      .collection('missions')
      .doc(params.id)
      .collection('messages')
      .limit(250)
      .get();

    const messages = snap.docs
      .map((d) => mapMessageDoc(d.id, d.data()))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return NextResponse.json({ messages });
  } catch (err) {
    return adminError(err);
  }
}
