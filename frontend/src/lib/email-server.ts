import nodemailer from 'nodemailer';

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult = { ok: true } | { ok: false; reason: string };

const DEFAULT_FROM = 'MILOU <onboarding@resend.dev>';

function getResendFrom() {
  return process.env.MILOU_EMAIL_FROM?.trim() || DEFAULT_FROM;
}

async function sendViaSmtp({ to, subject, text }: EmailPayload): Promise<SendEmailResult | null> {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user, pass },
  });

  const from = process.env.EMAIL_FROM?.trim() || `MILOU <${user}>`;

  try {
    await transport.sendMail({ from, to, subject, text });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur SMTP';
    console.error('[email/smtp]', msg);
    return { ok: false, reason: `Envoi e-mail impossible : ${msg}` };
  }
}

async function sendViaResend({ to, subject, text }: EmailPayload): Promise<SendEmailResult | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getResendFrom(),
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let detail = raw;
    try {
      const parsed = JSON.parse(raw) as { message?: string };
      if (parsed.message) detail = parsed.message;
    } catch {
      /* ignore */
    }
    if (res.status === 403 && /only send testing emails/i.test(detail)) {
      return null;
    }
    return { ok: false, reason: `Resend (${res.status}) : ${detail}` };
  }

  return { ok: true };
}

export async function sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
  const smtp = await sendViaSmtp(payload);
  if (smtp?.ok) return smtp;
  if (smtp && !smtp.ok) return smtp;

  const resend = await sendViaResend(payload);
  if (resend?.ok) return resend;
  if (resend && !resend.ok) return resend;

  return {
    ok: false,
    reason:
      'Envoi d’e-mail non configuré. Sur Vercel : SMTP_USER + SMTP_PASS (mot de passe d’application Gmail), puis Redeploy.',
  };
}
