import { getAdminAuth } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email-server';

function getContinueUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://milou-delta.vercel.app';
  return `${base.replace(/\/$/, '')}/login?verified=1`;
}

/** Lien Firebase envoyé par MILOU (SMTP/Resend) — fonctionne pour toutes les adresses si SMTP est configuré. */
export async function sendAuthVerificationLinkEmail(email: string) {
  const link = await getAdminAuth().generateEmailVerificationLink(email, {
    url: getContinueUrl(),
    handleCodeInApp: false,
  });

  return sendEmail({
    to: email,
    subject: 'Confirmez votre e-mail — MILOU',
    text: [
      'Bonjour,',
      '',
      'Bienvenue sur MILOU. Pour activer votre compte, ouvrez ce lien dans votre navigateur :',
      '',
      link,
      '',
      'Vous pouvez aussi saisir le code à 6 chiffres si vous en avez reçu un dans un autre message.',
      '',
      'Si vous n’avez pas créé de compte MILOU, ignorez cet e-mail.',
    ].join('\n'),
  });
}
