type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult = { ok: true } | { ok: false; reason: string };

function getFromEmail() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    (process.env.SMTP_USER ? `MILOU <${process.env.SMTP_USER}>` : 'MILOU <noreply@localhost>')
  );
}

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
}

/** Envoi via Gmail (mot de passe d’application) — fonctionne pour toutes les adresses destinataires. */
export async function sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
  if (!isSmtpConfigured()) {
    console.warn('[email] SMTP_USER / SMTP_PASS manquants');
    return { ok: false, reason: 'smtp_not_configured' };
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT?.trim() || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASS!.trim(),
      },
    });

    await transporter.sendMail({
      from: getFromEmail(),
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });

    return { ok: true };
  } catch (err) {
    console.error('[email/gmail]', err);
    return { ok: false, reason: 'smtp_failed' };
  }
}
