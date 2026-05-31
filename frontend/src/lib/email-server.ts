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
    return {
      ok: false,
      reason:
        'RESEND_API_KEY manquante sur Vercel. Ajoutez votre clé Resend (Production + Preview), puis Redeploy.',
    };
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
    let detail = raw;
    try {
      const parsed = JSON.parse(raw) as { message?: string };
      if (parsed.message) detail = parsed.message;
    } catch {
      /* ignore */
    }
    console.error(`[email/resend] ${res.status} -> ${payload.to}: ${detail}`);

    if (res.status === 403 && /only send testing emails/i.test(detail)) {
      return {
        ok: false,
        reason:
          'Resend (mode test) : ajoutez un domaine sur https://resend.com/domains pour envoyer des codes à tous les e-mails. ' +
          'En attendant, testez avec l’e-mail de votre compte Resend.',
      };
    }

    return {
      ok: false,
      reason: detail ? `Resend : ${detail}` : `Resend a refusé l’envoi (HTTP ${res.status}).`,
    };
  }

  return { ok: true };
}
