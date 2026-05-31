type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult = { ok: true } | { ok: false; reason: string };

/** Expéditeur par défaut Resend (domaine de test, fonctionne sans domaine perso). */
const DEFAULT_FROM = 'MILOU <onboarding@resend.dev>';

function getFromEmail() {
  const raw = process.env.MILOU_EMAIL_FROM?.trim();
  return raw || DEFAULT_FROM;
}

export async function sendEmail({ to, subject, text }: EmailPayload): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY absente');
    return {
      ok: false,
      reason:
        'RESEND_API_KEY manquante. Vercel → Settings → Environment Variables → ajoutez-la pour Production, puis Redeploy.',
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
      /* garder raw */
    }
    console.error(`[email] Resend error ${res.status} -> ${to}: ${detail}`);

    if (
      res.status === 403 &&
      /only send testing emails to your own email/i.test(detail)
    ) {
      return {
        ok: false,
        reason:
          'Resend est en mode test : les codes ne partent que vers l’e-mail du compte Resend. ' +
          'Pour envoyer à tous les utilisateurs : resend.com/domains → ajoutez et vérifiez votre domaine, ' +
          'puis sur Vercel mettez MILOU_EMAIL_FROM = MILOU <notifications@votredomaine.com> et Redeploy.',
      };
    }

    return {
      ok: false,
      reason: detail
        ? `Resend (${res.status}) : ${detail}`
        : `Resend a refusé l’envoi (HTTP ${res.status}). Vérifiez MILOU_EMAIL_FROM et votre domaine sur resend.com.`,
    };
  }

  return { ok: true };
}

export function normalizePostalCode(value: unknown) {
  return String(value || '').replace(/\s+/g, '').trim().toUpperCase();
}
