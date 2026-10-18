// POST /api/webhook — reçoit les événements Stripe et prévient la boutique à chaque commande payée.
const { verifyWebhook } = require('./_lib/stripe');

const readRaw = req => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MODES = { boutique: 'Retrait en boutique', drive: 'Retrait au Drive', livraison: 'Livraison' };

function orderEmail(s) {
  const m = s.metadata || {};
  const items = Object.keys(m).filter(k => k.startsWith('item_')).sort((a, b) => a.slice(5) - b.slice(5)).map(k => `<li>${esc(m[k])}</li>`).join('');
  const c = s.customer_details || {};
  const ship = (s.collected_information && s.collected_information.shipping_details) || s.shipping_details;
  const a = ship && ship.address;
  const addr = a ? `${esc(ship.name)}<br>${esc(a.line1)}${a.line2 ? '<br>' + esc(a.line2) : ''}<br>${esc(a.postal_code)} ${esc(a.city)}` : '';
  const zipWarn = a && m.zip && a.postal_code !== m.zip ? `<p style="color:#c0392b"><strong>Attention :</strong> code postal saisi au panier (${esc(m.zip)}) différent de l'adresse de livraison (${esc(a.postal_code)}).</p>` : '';
  return `<h2>Nouvelle commande — ${(s.amount_total / 100).toFixed(2).replace('.', ',')} €</h2>
<p><strong>${esc(MODES[m.mode] || m.mode)}</strong> · ${esc(m.date)} · ${esc(m.slot)}</p>
<ul>${items}</ul>${zipWarn}
<p><strong>Client :</strong> ${esc(c.name)} · ${esc(c.email)} · ${esc(c.phone)}</p>
${addr ? `<p><strong>Adresse de livraison :</strong><br>${addr}</p>` : ''}
<p style="color:#888">Paiement Stripe ${esc(s.payment_intent)} · session ${esc(s.id)}</p>`;
}

async function notifyShop(s) {
  const html = orderEmail(s);
  console.log('Commande payée', s.id, s.amount_total, JSON.stringify(s.metadata));
  if (!process.env.RESEND_API_KEY || !process.env.SHOP_EMAIL) return;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Commandes Monceau Fleurs <onboarding@resend.dev>',
      to: process.env.SHOP_EMAIL.split(',').map(x => x.trim()),
      reply_to: s.customer_details && s.customer_details.email,
      subject: `🌸 Commande ${(s.amount_total / 100).toFixed(2).replace('.', ',')} € — ${MODES[(s.metadata || {}).mode] || ''} ${(s.metadata || {}).date || ''}`,
      html
    })
  });
  if (!r.ok) console.error('Resend error', r.status, await r.text());
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await readRaw(req);
  if (!secret || !verifyWebhook(raw, req.headers['stripe-signature'], secret)) { res.statusCode = 400; return res.end('Signature invalide'); }

  const event = JSON.parse(raw);
  const s = event.data && event.data.object;
  try {
    if ((event.type === 'checkout.session.completed' && s.payment_status === 'paid') || event.type === 'checkout.session.async_payment_succeeded') {
      await notifyShop(s);
    }
  } catch (e) {
    console.error('Webhook handling error:', e.message);
    res.statusCode = 500; return res.end('Erreur');
  }
  res.statusCode = 200;
  res.end('ok');
};
