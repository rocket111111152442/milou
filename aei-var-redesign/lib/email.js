// Envoi d'e-mails via l'API HTTP de Resend (doc officielle : https://resend.com/docs/api-reference/emails/send-email).
// Désactivé tant que RESEND_API_KEY et EMAIL_FROM ne sont pas configurés : l'application
// continue de fonctionner (les demandes sont enregistrées), seuls les e-mails ne partent pas.
import agence from '../config/agence.js';

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function sendEmail({ to, subject, text, html, replyTo }) {
  if (!emailEnabled()) return { sent: false, reason: 'non configuré' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [].concat(to),
      subject,
      text,
      html: html || layout(subject, text),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) {
    console.error('Envoi e-mail échoué', res.status, await res.text().catch(() => ''));
    return { sent: false, reason: `erreur ${res.status}` };
  }
  return { sent: true };
}

// Gabarit HTML sobre, aux couleurs de l'agence
export function layout(title, text, cta) {
  const body = esc(text).split('\n').map(l => l ? `<p style="margin:0 0 12px">${l}</p>` : '').join('');
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f7fb;font-family:Arial,Helvetica,sans-serif;color:#16142e">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#1e146a;padding:22px 28px;color:#fff;font-size:20px;font-family:Georgia,serif;border-left:6px solid #a3262a">${esc(agence.nomCourt)}</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">
<h1 style="font-family:Georgia,serif;font-weight:normal;color:#0e0a36;font-size:24px;margin:0 0 18px">${esc(title)}</h1>
${body}
${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.url)}" style="background:#a3262a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block">${esc(cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:18px 28px;background:#f7f7fb;font-size:12px;color:#66647d">${esc(agence.nom)} · ${esc(agence.adresse)}, ${esc(agence.codePostal)} ${esc(agence.ville)} · ${esc(agence.telephone)}</td></tr>
</table></td></tr></table></body></html>`;
}
