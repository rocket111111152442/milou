// POST /api/checkout — crée une session Stripe Checkout (carte, Link, Apple Pay, Google Pay…)
const { stripe } = require('./_lib/stripe');
const { validateOrder, OrderError, cents } = require('./_lib/order');

const json = (res, status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Méthode non autorisée' });
  if (!process.env.STRIPE_SECRET_KEY) return json(res, 503, { demo: true, error: 'Paiement en ligne non configuré.' });

  let order;
  try {
    order = validateOrder(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
  } catch (e) {
    return json(res, 400, { error: e instanceof OrderError ? e.message : 'Commande invalide.' });
  }

  const origin = process.env.SITE_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const dateFr = new Date(order.date + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const when = `${order.modeLabel} le ${dateFr}, ${order.slot}`;

  const metadata = { mode: order.mode, date: order.date, slot: order.slot, zip: order.zone ? order.zone.zip : '' };
  order.lines.slice(0, 40).forEach((l, i) => { metadata[`item_${i + 1}`] = l.summary.slice(0, 480); });

  const params = {
    mode: 'payment',
    locale: 'fr',
    line_items: order.lines.map(l => ({
      quantity: l.qty,
      price_data: {
        currency: 'eur',
        unit_amount: cents(l.unit),
        product_data: { name: l.name, description: l.desc.slice(0, 300), images: l.image ? [l.image] : undefined }
      }
    })),
    phone_number_collection: { enabled: true },
    billing_address_collection: 'auto',
    metadata,
    payment_intent_data: { description: `Monceau Fleurs La Seyne — ${when}`, metadata },
    custom_text: { submit: { message: when } },
    success_url: `${origin}/?commande=ok&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?commande=annulee`
  };
  if (order.mode === 'livraison') {
    params.shipping_address_collection = { allowed_countries: ['FR'] };
    params.shipping_options = [{
      shipping_rate_data: {
        type: 'fixed_amount',
        display_name: `Livraison ${order.zone.city} (${order.zone.zip}) — ${dateFr}, ${order.slot}`,
        fixed_amount: { amount: cents(order.fee), currency: 'eur' }
      }
    }];
  }

  try {
    const session = await stripe('POST', 'checkout/sessions', params);
    return json(res, 200, { url: session.url });
  } catch (e) {
    console.error('Stripe checkout error:', e.message);
    return json(res, 502, { error: 'Le paiement est momentanément indisponible. Réessayez ou appelez la boutique.' });
  }
};
