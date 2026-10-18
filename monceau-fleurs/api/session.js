// GET /api/session?id=cs_... — résumé d'une commande payée (page de confirmation)
const { stripe } = require('./_lib/stripe');

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || '');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) { res.statusCode = 400; return res.end('{"error":"Identifiant invalide"}'); }
  try {
    const s = await stripe('GET', `checkout/sessions/${id}`);
    const m = s.metadata || {};
    res.end(JSON.stringify({ paid: s.payment_status === 'paid', amount: s.amount_total / 100, mode: m.mode, date: m.date, slot: m.slot, email: s.customer_details && s.customer_details.email }));
  } catch (e) {
    res.statusCode = e.notConfigured ? 503 : 404;
    res.end('{"error":"Commande introuvable"}');
  }
};
