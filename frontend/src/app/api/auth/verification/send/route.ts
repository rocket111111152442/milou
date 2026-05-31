import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { issueVerificationCode } from '@/lib/verification-code';

export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await verifyRequest(req, { allowUnverifiedEmail: true });
    if (!email) {
      return NextResponse.json({ error: 'E-mail introuvable sur le compte' }, { status: 400 });
    }

    const db = getAdminDb();
    const userSnap = await db.collection('users').doc(uid).get();
    const toEmail = String(userSnap.data()?.email || email).toLowerCase();

    const result = await issueVerificationCode(db, uid, toEmail);

    return NextResponse.json({
      message: 'E-mail de vérification envoyé',
      expiresInMinutes: result.expiresInMinutes,
      resendCodeDelivered: result.emailSent,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
