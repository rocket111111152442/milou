import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { redeemPromoCode } from '@/lib/promo-codes';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const { code } = await req.json();
    if (!code?.trim()) {
      return NextResponse.json({ error: 'Entrez un code' }, { status: 400 });
    }

    const db = getAdminDb();
    const result = await redeemPromoCode(db, uid, code);

    return NextResponse.json({
      message: 'Code utilisé avec succès !',
      rewards: result,
      balance: result.newBalance,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
