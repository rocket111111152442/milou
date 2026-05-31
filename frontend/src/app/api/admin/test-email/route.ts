import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminError } from '@/lib/firebase/admin-guard';
import { isSmtpConfigured, sendEmail } from '@/lib/email-server';

export const runtime = 'nodejs';

/** Test Gmail SMTP (admin). POST { "to": "email@example.com" } */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { to } = await req.json();
    const target = String(to || '').trim();
    if (!target) {
      return NextResponse.json({ error: 'Champ "to" requis' }, { status: 400 });
    }

    if (!isSmtpConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'SMTP non configuré (SMTP_USER / SMTP_PASS manquants sur ce serveur).',
        },
        { status: 503 }
      );
    }

    const result = await sendEmail({
      to: target,
      subject: 'Test MILOU — notifications marketplace',
      text: 'Si vous lisez ce message, Gmail SMTP fonctionne pour MILOU.',
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: 'Échec envoi SMTP', reason: result.reason }, { status: 502 });
    }

    return NextResponse.json({ ok: true, message: `E-mail de test envoyé à ${target}` });
  } catch (err) {
    return adminError(err);
  }
}
