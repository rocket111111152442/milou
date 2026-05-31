import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { confirmVerificationCode } from '@/lib/verification-code';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req, { allowUnverifiedEmail: true });
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

    const db = getAdminDb();
    await confirmVerificationCode(db, uid, String(code));

    await getAdminAuth().updateUser(uid, { emailVerified: true });

    return NextResponse.json({ message: 'E-mail vérifié' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
