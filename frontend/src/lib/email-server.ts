type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; channel: 'smtp' | 'resend' }
  | { ok: false; reason: string };

function getFromEmail() {
  return (
    process.env.MILOU_EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    (process.env.SMTP_USER ? `MILOU <${process.env.SMTP_USER}>` : '') ||
    'MILOU <onboarding@resend.dev>'
  );
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
}

async function sendViaSmtp(payload: EmailPayload): Promise<void> {
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT?.trim() || 587),
    secure: process.env.SMTP_SECURE === 'true',
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
}

async function sendViaResend(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY manquante');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromEmail(),
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${raw}`);
  }
}

/** Envoie à n'importe quelle adresse si SMTP Gmail est configuré ; sinon tente Resend. */
export async function sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
  if (hasSmtpConfig()) {
    try {
      await sendViaSmtp(payload);
      return { ok: true, channel: 'smtp' };
    } catch (err) {
      console.error('[email/smtp]', err);
    }
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    try {
      await sendViaResend(payload);
      return { ok: true, channel: 'resend' };
    } catch (err) {
      console.error('[email/resend]', err);
      return { ok: false, reason: 'resend_failed' };
    }
  }

  console.warn('[email] Aucun canal configuré (SMTP_USER/SMTP_PASS ou RESEND_API_KEY)');
  return { ok: false, reason: 'no_provider' };
}

export function isEmailConfigured() {
  return hasSmtpConfig() || Boolean(process.env.RESEND_API_KEY?.trim());
}
