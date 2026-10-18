// Validation et tarification d'une commande, côté serveur.
// Les prix envoyés par le navigateur ne sont jamais utilisés : tout est recalculé depuis data.js.
const MF = require('../../assets/js/data.js');

const C = MF.config;
const MODES = { boutique: 'Retrait en boutique', drive: 'Retrait au Drive', livraison: 'Livraison' };
const toMin = t => { const [h, m] = t.split(':'); return +h * 60 + +m; };
const cents = n => Math.round(n * 100);
const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

class OrderError extends Error {}
const fail = msg => { throw new OrderError(msg); };

function parisNow() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, min: (+get('hour') % 24) * 60 + +get('minute') };
}
const dayOfWeek = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
const addDaysIso = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const slotStart = s => toMin(s.match(/(\d{1,2})h/)[1].padStart(2, '0') + ':00');

// Créneaux possibles pour une date donnée (filtrés par les horaires d'ouverture)
function slotsFor(iso) {
  const h = C.hours[dayOfWeek(iso)];
  if (!h) return [];
  return C.order.slots.filter(s => slotStart(s) >= toMin(h[0]) - 60 && slotStart(s) < toMin(h[1]));
}

function priceLine(it) {
  const qty = Number(it && it.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) fail('Quantité invalide.');
  const ref = it.ref || {};
  if (ref.type === 'product') {
    const p = MF.products.find(x => x.id === ref.id) || fail('Produit introuvable.');
    const size = MF.sizes.find(x => x.id === ref.size) || fail('Taille invalide.');
    const msg = clean(ref.msg, 160);
    return {
      qty, unit: p.price + size.add,
      name: `${p.name} — ${size.label}`,
      desc: msg ? `Carte : « ${msg} »` : p.desc,
      image: `https://images.unsplash.com/photo-${p.img}?auto=format&fit=crop&w=600&h=600&q=75`,
      summary: `${qty}× ${p.name} (${size.label})${msg ? ` — carte : « ${msg} »` : ''}`
    };
  }
  if (ref.type === 'custom') {
    const counts = ref.flowers || {};
    let stems = 0, unit = 0;
    const parts = [];
    for (const [id, n] of Object.entries(counts)) {
      const f = MF.flowers.find(x => x.id === id) || fail('Fleur inconnue.');
      if (!Number.isInteger(n) || n < 0 || n > 30) fail('Composition invalide.');
      if (!n) continue;
      stems += n; unit += n * f.price; parts.push(`${n} ${f.name}${n > 1 && !/s$/.test(f.name) ? "s" : ""}`);
    }
    if (stems < 1 || stems > 30) fail('Un bouquet compte de 1 à 30 tiges.');
    const wrap = MF.wraps.find(x => x.id === ref.wrap) || fail('Emballage invalide.');
    unit += wrap.price;
    const compo = `${parts.join(', ')} · ${wrap.name}`;
    return { qty, unit: Math.round(unit * 100) / 100, name: 'Bouquet sur-mesure', desc: compo, image: null, summary: `${qty}× Bouquet sur-mesure : ${compo}` };
  }
  fail('Article invalide.');
}

function validateOrder(body) {
  const items = Array.isArray(body && body.items) ? body.items : fail('Panier vide.');
  if (!items.length || items.length > 30) fail('Panier vide ou trop volumineux.');
  const lines = items.map(priceLine);

  const mode = MODES[body.mode] ? body.mode : fail('Mode de retrait invalide.');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : fail('Choisissez une date.');
  const now = parisNow();
  if (date < now.date || date > addDaysIso(now.date, C.order.maxDaysAhead)) fail('Date indisponible.');
  const hours = C.hours[dayOfWeek(date)] || fail('La boutique est fermée ce jour-là.');
  if (date === now.date) {
    const limit = mode === 'livraison' ? toMin(C.order.deliveryCutoff) : toMin(hours[1]) - C.order.pickupLeadMinutes;
    if (now.min >= limit) fail(mode === 'livraison' ? "Trop tard pour une livraison aujourd'hui : choisissez une autre date." : "Trop tard pour un retrait aujourd'hui : choisissez une autre date.");
  }
  const slot = slotsFor(date).includes(body.slot) ? body.slot : fail('Créneau indisponible pour cette date.');
  if (date === now.date && slotStart(slot) + 180 <= now.min) fail('Ce créneau est déjà passé.');

  let zone = null;
  if (mode === 'livraison') {
    const zip = String(body.zip || '');
    zone = MF.zones.find(z => z.zip.includes(zip)) || fail("Ce code postal n'est pas dans notre zone de livraison directe.");
    zone = { ...zone, zip };
  }
  const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);
  return { lines, mode, modeLabel: MODES[mode], date, slot, zone, subtotal, fee: zone ? zone.fee : 0 };
}

module.exports = { validateOrder, slotsFor, OrderError, cents, parisNow, MF };
