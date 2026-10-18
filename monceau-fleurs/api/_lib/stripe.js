// Client Stripe minimal (API REST, sans dépendance npm).
const crypto = require('crypto');

function encode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') encode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join('&');
}

async function stripe(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) { const e = new Error('Stripe non configuré'); e.notConfigured = true; throw e; }
  const qs = params && method === 'GET' ? '?' + encode(params) : '';
  const res = await fetch(`https://api.stripe.com/v1/${path}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params && method !== 'GET' ? encode(params) : undefined
  });
  const data = await res.json();
  if (!res.ok) { const e = new Error((data.error && data.error.message) || 'Erreur Stripe'); e.status = res.status; throw e; }
  return data;
}

// Vérifie l'en-tête Stripe-Signature d'un webhook (tolérance 5 min)
function verifyWebhook(raw, header, secret, tolerance = 300) {
  const parts = Object.fromEntries(String(header || '').split(',').map(p => p.split('=')).filter(p => p.length === 2).map(([k, v]) => [k, v]));
  const sigs = String(header || '').split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  if (!parts.t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > tolerance) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex');
  return sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

module.exports = { stripe, verifyWebhook, encode };
