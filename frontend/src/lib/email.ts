type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

const FROM_EMAIL = process.env.MILOU_EMAIL_FROM || 'MILOU <notifications@milou.app>';

export async function sendEmail({ to, subject, text }: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[email disabled] ${subject} -> ${to}`);
    return false;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const message = await res.text().catch(() => '');
    console.error(`Email failed for ${to}: ${message}`);
    return false;
  }

  return true;
}

export function normalizePostalCode(value: unknown) {
  return String(value || '').replace(/\s+/g, '').trim().toUpperCase();
}
