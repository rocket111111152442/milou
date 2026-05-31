type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult = { ok: true } | { ok: false; reason: string };

const DEFAULT_FROM = 'MILOU <onboarding@resend.dev>';

function getFromEmail() {
  return process.env.MILOU_EMAIL_FROM?.trim() || DEFAULT_FROM;
}

export async function sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY absente');
    return { ok: false, reason: 'RESEND_API_KEY manquante' };
  }

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
    console.error(`[email/resend] ${res.status} -> ${payload.to}: ${raw}`);
    return { ok: false, reason: 'resend_failed' };
  }

  return { ok: true };
}
