import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUserUsage } from '@/lib/premium/usage';
import { syncPremiumStatus } from '@/lib/premium/sync';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const db = getAdminDb();
    const data = await syncPremiumStatus(db, uid);
    const usage = await getUserUsage(db, uid, data);
    return NextResponse.json(usage);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 401 }
    );
  }
}
