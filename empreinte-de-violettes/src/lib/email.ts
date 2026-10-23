import "server-only";
import { euro, frDate, MODE_LABEL, ORDER_STATUS } from "./format";
import type { Message, Order, Settings } from "./types";

/** Envoi via l'API Resend (https://resend.com). Sans clé, l'envoi est simplement journalisé. */
export async function sendEmail({ to, subject, html, replyTo }: { to: string; subject: string; html: string; replyTo?: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Empreinte de Violettes <onboarding@resend.dev>";
  if (!key || !to) {
    console.info(`[email] (non envoyé — RESEND_API_KEY absente) → ${to} : ${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, reply_to: replyTo }),
    });
    if (!res.ok) console.error("[email] échec", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[email] erreur", e);
    return false;
  }
}

const esc = (s: string = "") => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, settings: Settings) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#efe6dc;font-family:Georgia,'Times New Roman',serif;color:#160c1c">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#efe6dc;padding:32px 12px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#f6f1ea;border:1px solid #e3d7c8">
<tr><td style="background:#0e0912;padding:34px 24px;text-align:center">
<div style="font-size:11px;letter-spacing:6px;color:#c6a15b;text-transform:uppercase">Maison</div>
<div style="font-size:24px;letter-spacing:4px;color:#eadba8;text-transform:uppercase;margin-top:6px">Empreinte de Violettes</div>
<div style="font-size:10px;letter-spacing:5px;color:#b9a2cf;text-transform:uppercase;margin-top:10px">Artisane fleuriste</div>
</td></tr>
<tr><td style="padding:36px 36px 12px"><h1 style="font-weight:normal;font-size:26px;margin:0 0 18px;color:#26152f">${title}</h1>${body}</td></tr>
<tr><td style="padding:24px 36px 36px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6e4f8c;line-height:1.6;border-top:1px solid #e3d7c8">
${esc(settings.address)}, ${esc(settings.postcode)} ${esc(settings.city)}<br/>${esc(settings.phone)} · ${esc(settings.email)}
</td></tr></table></td></tr></table></body></html>`;
}

function orderTable(order: Order) {
  const rows = order.items
    .map(
      (i) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e3d7c8;font-family:Helvetica,Arial,sans-serif;font-size:14px">
${i.quantity} × ${esc(i.name)}${i.variantName ? ` <span style="color:#6e4f8c">— ${esc(i.variantName)}</span>` : ""}
${i.addons.length ? `<br/><span style="font-size:12px;color:#6e4f8c">+ ${i.addons.map((a) => esc(a.name)).join(", ")}</span>` : ""}
</td><td align="right" style="padding:10px 0;border-bottom:1px solid #e3d7c8;font-family:Helvetica,Arial,sans-serif;font-size:14px">${euro(i.lineTotal)}</td></tr>`,
    )
    .join("");
  const line = (label: string, v: string, bold = false) =>
    `<tr><td style="padding:6px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;${bold ? "font-weight:bold;font-size:15px" : ""}">${label}</td><td align="right" style="padding:6px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;${bold ? "font-weight:bold;font-size:15px" : ""}">${v}</td></tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0">${rows}
${line("Sous-total", euro(order.subtotal))}
${order.mode === "delivery" ? line("Livraison", order.deliveryFee ? euro(order.deliveryFee) : "Offerte") : ""}
${order.discount ? line(`Remise${order.promoCode ? " (" + esc(order.promoCode) + ")" : ""}`, "− " + euro(order.discount)) : ""}
${line("Total", euro(order.total), true)}</table>`;
}

function fulfilment(order: Order) {
  const when = `${frDate(order.date)} · ${esc(order.slotLabel)}`;
  if (order.mode === "delivery" && order.recipient) {
    const r = order.recipient;
    return `<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6"><strong>Livraison</strong> — ${when}<br/>
${esc(r.name)}<br/>${esc(r.address)}${r.address2 ? "<br/>" + esc(r.address2) : ""}<br/>${esc(r.postcode)} ${esc(r.city)}</p>`;
  }
  return `<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6"><strong>${MODE_LABEL[order.mode]}</strong> — ${when}</p>`;
}

export function orderConfirmationEmail(order: Order, settings: Settings, trackUrl: string) {
  const body = `<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7">Bonjour ${esc(order.customer.firstName)},<br/>
merci pour votre commande <strong>${esc(order.number)}</strong>. Nous la préparons avec soin, à la main, dans notre atelier.</p>
${fulfilment(order)}
${orderTable(order)}
${order.paymentStatus === "in_store" ? `<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#8e6a2e">Règlement à effectuer lors du retrait en boutique.</p>` : ""}
<p style="margin:28px 0"><a href="${trackUrl}" style="background:#26152f;color:#f6f1ea;padding:14px 26px;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase">Suivre ma commande</a></p>`;
  return { subject: `Votre commande ${order.number} — Empreinte de Violettes`, html: layout("Merci, votre commande est confirmée", body, settings) };
}

export function orderNotificationEmail(order: Order, settings: Settings, adminUrl: string) {
  const c = order.customer;
  const body = `<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7">Nouvelle commande <strong>${esc(order.number)}</strong> de ${esc(c.firstName)} ${esc(c.lastName)} (${esc(c.email)}, ${esc(c.phone)}).</p>
${fulfilment(order)}
${order.cardMessage ? `<p style="font-family:Georgia,serif;font-style:italic;font-size:15px;background:#efe6dc;padding:14px">« ${esc(order.cardMessage)} »${order.cardSignature ? "<br/>— " + esc(order.cardSignature) : ""}</p>` : ""}
${orderTable(order)}
<p style="margin:28px 0"><a href="${adminUrl}" style="background:#26152f;color:#f6f1ea;padding:14px 26px;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase">Ouvrir dans l'administration</a></p>`;
  return { subject: `🌿 Nouvelle commande ${order.number} — ${euro(order.total)}`, html: layout("Nouvelle commande", body, settings) };
}

export function statusEmail(order: Order, settings: Settings, trackUrl: string) {
  const label = ORDER_STATUS[order.status]?.label || order.status;
  const texts: Record<string, string> = {
    ready: order.mode === "delivery" ? "Votre création est prête et partira bientôt en livraison." : "Votre commande vous attend en boutique. À tout de suite !",
    out_for_delivery: "Votre bouquet est en route ! Il sera livré dans le créneau choisi.",
    delivered: "Votre commande a été livrée. Merci de votre confiance.",
    cancelled: "Votre commande a été annulée. Si un paiement a été effectué, il vous sera remboursé.",
    refunded: "Votre commande a été remboursée. Le montant apparaîtra sur votre compte sous quelques jours.",
  };
  const body = `<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7">Bonjour ${esc(order.customer.firstName)},<br/>${texts[order.status] || `Le statut de votre commande est désormais : ${label}.`}</p>
<p style="margin:28px 0"><a href="${trackUrl}" style="background:#26152f;color:#f6f1ea;padding:14px 26px;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase">Suivre ma commande</a></p>`;
  return { subject: `Commande ${order.number} : ${label}`, html: layout(label, body, settings) };
}

export function messageNotificationEmail(m: Message, settings: Settings) {
  const rows = [
    ["Type", m.type],
    ["Nom", m.name],
    ["E-mail", m.email],
    ["Téléphone", m.phone],
    ["Date de l'événement", m.eventDate],
    ["Lieu", m.venue],
    ["Invités", m.guests],
    ["Budget", m.budget],
    ["Objet", m.subject],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6e4f8c;font-family:Helvetica,Arial,sans-serif;font-size:13px">${k}</td><td style="font-family:Helvetica,Arial,sans-serif;font-size:13px">${esc(String(v))}</td></tr>`)
    .join("");
  const body = `<table>${rows}</table><p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap;background:#efe6dc;padding:16px">${esc(m.message)}</p>`;
  return { subject: `Nouveau message (${m.type}) — ${m.name}`, html: layout("Nouveau message reçu", body, settings) };
}
