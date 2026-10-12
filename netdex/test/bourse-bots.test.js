// Profils d'investisseurs des comptes animés : décisions face à des situations de marché typiques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBotBourse, investorOf, STYLES } from '../lib/bot-bourse.js';

const { decide } = createBotBourse(null, null);
const shop = { id: 1, owner_id: 999, tier: 'standard', balance: 5000, div_pct: 5, fees_total: 2000, last_price: 20, sales_count: 10 };
const inv = (name, id = 7) => ({ ...investorOf({ id }, { type: 'trader', bourse: name }), botId: id });
const q = (o) => ({ bid: 19, ask: 21, last: 20, ref: 20, fair: 20, vol: 30, trend24: 0, trend6: 0, yld: 0, div: null, ...o });
const none = { qty: 0, free: 0, avg: null };
// Décision la plus fréquente sur 300 essais (les profils gardent une part de hasard, comme un joueur).
const often = (fn) => {
  const c = {};
  for (let i = 0; i < 300; i++) { const d = fn(); const k = d ? `${d.side}:${d.why}` : 'rien'; c[k] = (c[k] || 0) + 1; }
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
};

test('chaque compte a un profil stable, tous les profils existent', () => {
  assert.equal(investorOf({ id: 42 }, { type: 'trader' }).name, investorOf({ id: 42 }, { type: 'trader' }).name);
  const seen = new Set();
  for (let id = 1; id < 3000; id++) for (const type of ['trader', 'collector', 'grinder', 'regular', 'casual']) seen.add(investorOf({ id }, { type }).name);
  assert.deepEqual([...seen].sort(), Object.keys(STYLES).sort());
});

test('fondamental : achète sous la valeur, ignore ce qui est cher, vend quand c\'est surcoté', () => {
  assert.equal(often(() => decide(inv('fondamental'), q({ last: 10, ref: 10, bid: 9, ask: 11, fair: 20 }), none, 10000, 5000, shop)), 'buy:sous sa valeur');
  assert.equal(often(() => decide(inv('fondamental'), q({ fair: 15 }), none, 10000, 5000, shop)), 'rien');
  assert.equal(often(() => decide(inv('fondamental'), q({ last: 40, ref: 40, fair: 20 }), { qty: 50, free: 50, avg: 38 }, 10000, 5000, shop)), 'sell:trop cher');
});

test('tendance : suit la hausse, coupe à la baisse', () => {
  assert.equal(often(() => decide(inv('tendance'), q({ trend6: 0.1, trend24: 0.05 }), none, 10000, 5000, shop)), 'buy:tendance haussière');
  assert.equal(often(() => decide(inv('tendance'), q({ trend6: -0.08 }), { qty: 30, free: 30, avg: 20 }, 10000, 5000, shop)), 'sell:retournement');
});

test('creux : achète après une chute, revend au rebond', () => {
  assert.equal(often(() => decide(inv('creux'), q({ trend24: -0.2, last: 16, ref: 16 }), none, 10000, 5000, shop)), 'buy:achat sur repli');
  assert.match(often(() => decide(inv('creux'), q({ last: 23, ref: 23 }), { qty: 30, free: 30, avg: 20 }, 10000, 5000, shop)), /^sell:(rebond|prise de bénéfices)$/);
});

test('rentier : achète les boutiques qui versent, vend si les dividendes s\'arrêtent', () => {
  assert.equal(often(() => decide(inv('rentier'), q({ div: 0.2, yld: 0.01 }), none, 10000, 5000, shop)), 'buy:pour les dividendes');
  assert.equal(often(() => decide(inv('rentier'), q({}), none, 10000, 5000, { ...shop, div_pct: 0 })), 'rien');
});

test('impulsif : prix ronds, vend tout dès qu\'il gagne, panique à la baisse', () => {
  const d = decide(inv('impulsif'), q({ trend24: 0.3, ask: 47, last: 46, ref: 46 }), none, 10000, 5000, shop);
  assert.ok(d && d.side === 'buy' && (d.type === 'market' || d.price % 5 === 0), JSON.stringify(d));
  assert.equal(often(() => decide(inv('impulsif'), q({ trend6: -0.25, last: 14, ref: 14 }), { qty: 40, free: 40, avg: 20 }, 10000, 5000, shop)), 'sell:vente panique');
  const tp = decide(inv('impulsif'), q({ last: 30, ref: 30 }), { qty: 40, free: 40, avg: 20 }, 10000, 5000, shop);
  assert.equal(tp.why, 'prise de bénéfices');
  assert.equal(tp.qty, 40);
});

test('teneur : se place juste devant le meilleur acheteur, petites quantités', () => {
  const d = decide(inv('teneur'), q({ bid: 18, ask: 24 }), none, 10000, 5000, shop);
  assert.equal(d.price, 19);
  assert.ok(d.qty <= 25);
});

test('jamais plus d\'une part de sa fortune sur une boutique, rien sans bits', () => {
  const d = decide(inv('fondamental'), q({ last: 10, ref: 10, fair: 20, ask: null }), { qty: 340, free: 340, avg: 10 }, 10000, 5000, shop);
  assert.ok(!d || d.side !== 'buy' || d.qty * (d.price || 10) <= 10000 * 0.35 - 3400 + 10);
  assert.equal(decide(inv('tendance'), q({ trend6: 0.1, trend24: 0.05 }), none, 5, 5, shop), null);
});
