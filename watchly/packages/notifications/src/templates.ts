/**
 * Gabarits d'e-mails Watchly (HTML à styles en ligne + version texte).
 * Toutes les valeurs dynamiques sont échappées.
 */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHttpUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

interface Layout {
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string } | null;
  meta?: Array<[string, string]>;
  priority?: string;
  appUrl: string;
}

function layout(l: Layout): { html: string; text: string } {
  const badge =
    l.priority === "critical" || l.priority === "high"
      ? `<p style="margin:0 0 12px"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#FDECEF;color:#C4213B;font-size:12px;font-weight:600">${l.priority === "critical" ? "Alerte prioritaire" : "Important"}</span></p>`
      : "";
  const meta = (l.meta ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#6B6B79;font-size:13px;width:150px">${escapeHtml(k)}</td><td style="padding:6px 0;color:#111118;font-size:13px">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(l.heading)}</title></head>
<body style="margin:0;background:#F8F9FC;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111118">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(l.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E7E8EF;border-radius:20px;overflow:hidden">
<tr><td style="height:4px;background:linear-gradient(90deg,#00E5FF,#245BFF,#8028FF,#ED4DF5)"></td></tr>
<tr><td style="padding:28px 32px 8px"><strong style="font-size:18px;letter-spacing:-0.02em">Watchly</strong></td></tr>
<tr><td style="padding:8px 32px 28px">${badge}
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;letter-spacing:-0.02em">${escapeHtml(l.heading)}</h1>
${l.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#2A2A33">${escapeHtml(p)}</p>`).join("")}
${meta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 4px;width:100%">${meta}</table>` : ""}
${l.cta ? `<p style="margin:22px 0 0"><a href="${escapeHtml(l.cta.url)}" style="display:inline-block;background:#111118;color:#FFFFFF;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600">${escapeHtml(l.cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #E7E8EF;font-size:12px;color:#6B6B79;line-height:1.5">
Vous recevez cet e-mail car vous utilisez Watchly. <a href="${escapeHtml(l.appUrl)}/app/parametres" style="color:#245BFF">Gérer mes notifications</a><br>WATCHLY — Développé par LULLIN WEB</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    l.heading,
    "",
    ...l.paragraphs,
    ...(l.meta ?? []).map(([k, v]) => `${k} : ${v}`),
    l.cta ? `\n${l.cta.label} : ${l.cta.url}` : "",
    "",
    `Gérer mes notifications : ${l.appUrl}/app/parametres`,
    "WATCHLY — Développé par LULLIN WEB",
  ].join("\n");
  return { html, text };
}

export function renderEmail(template: string, subject: string, payload: Record<string, unknown>, appUrl: string): RenderedEmail {
  const p = payload;
  const link = typeof p.linkPath === "string" && p.linkPath.startsWith("/") ? `${appUrl}${p.linkPath}` : `${appUrl}/app/alertes`;
  const source = safeHttpUrl(p.sourceUrl);
  const meta: Array<[string, string]> = [];
  if (typeof p.taskName === "string" && p.taskName) meta.push(["Surveillance", p.taskName]);
  if (source) meta.push(["Source", source]);
  if (typeof p.detectedAt === "string") meta.push(["Détecté le", p.detectedAt]);

  switch (template) {
    case "support_ack": {
      const r = layout({
        appUrl,
        preheader: "Votre demande a bien été reçue",
        heading: "Nous avons bien reçu votre demande",
        paragraphs: [
          `Sujet : ${String(p.subject ?? "")}`,
          "L'équipe Watchly vous répondra par e-mail. Ne communiquez jamais de mot de passe ni de numéro de carte.",
        ],
        meta: [["Référence", String(p.ticketRef ?? "")]],
      });
      return { subject, ...r };
    }
    case "support_reply": {
      const r = layout({
        appUrl,
        preheader: "Réponse à votre demande d'assistance",
        heading: "Réponse de l'équipe Watchly",
        paragraphs: String(p.body ?? "")
          .split(/\n{2,}/)
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 20),
        meta: [["Référence", String(p.ticketRef ?? "")], ["Sujet", String(p.subject ?? "")]],
      });
      return { subject, ...r };
    }
    default: {
      const r = layout({
        appUrl,
        preheader: String(p.body ?? subject).slice(0, 120),
        heading: String(p.title ?? subject),
        paragraphs: [String(p.body ?? "")],
        meta,
        priority: String(p.priority ?? "normal"),
        cta: { label: typeof p.ctaLabel === "string" ? p.ctaLabel : "Voir dans Watchly", url: typeof p.ctaUrl === "string" ? p.ctaUrl : link },
      });
      return { subject, ...r };
    }
  }
}
