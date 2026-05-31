import { NextRequest, NextResponse } from 'next/server';
import { sendAuthVerificationLinkEmail } from '@/lib/auth-verification-email';
import { isEmailConfigured } from '@/lib/email-server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { issueVerificationCode } from '@/lib/verification-code';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error:
            'Envoi d’e-mails non configuré sur le serveur. Ajoutez SMTP (Gmail MILOU) ou Resend dans Vercel, puis redéployez.',
        },
        { status: 503 }
      );
    }

    const { uid, email } = await verifyRequest(req, { allowUnverifiedEmail: true });
    if (!email) {
      return NextResponse.json({ error: 'E-mail introuvable sur le compte' }, { status: 400 });
    }

    const db = getAdminDb();
    const userSnap = await db.collection('users').doc(uid).get();
    const toEmail = String(userSnap.data()?.email || email).toLowerCase();

    const [codeResult, linkResult] = await Promise.all([
      issueVerificationCode(db, uid, toEmail),
      sendAuthVerificationLinkEmail(toEmail),
    ]);

    if (!codeResult.emailSent && !linkResult.ok) {
      return NextResponse.json(
        {
          error:
            'Impossible d’envoyer l’e-mail. Vérifiez SMTP_USER/SMTP_PASS (mot de passe d’application Gmail) sur Vercel.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      message: 'E-mail de vérification envoyé',
      expiresInMinutes: codeResult.expiresInMinutes,
      resendCodeDelivered: codeResult.emailSent,
      linkDelivered: linkResult.ok,
      linkChannel: linkResult.ok ? linkResult.channel : undefined,
      codeChannel: codeResult.emailSent ? codeResult.channel : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
