// Parts de boutiques : décisions des comptes animés selon leur profil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, investorOf, yieldOf, STYLES } from '../lib/bot-bourse.js';

// Boutique type : part à 10, dividende fixe de 1 %/jour (0,1 bit par part), rachat 80 %, coffre bien rempli.
const shop = (o = {}) => ({ id: 1, owner_id: 999, is_open: true, share_price: 10, div_mode: 'fixe', div_pct: 1, balance: 5000, total_shares: 1000,
  shares_max: 1000, sold: 0, max_per_player: 1000, buyback_pct: 80, holders: 3, ...o });
const inv = (name, id = 7) => ({ ...investorOf({ id }, { type: 'trader', bourse: name }), botId: id });
// Décision la plus fréquente sur 300 essais (les profils gardent une part de hasard, comme un joueur).
const often = (fn) => {
  const c = {};
  for (let i = 0; i < 300; i++) { const d = fn(); const k = d ? `${d.side}:${d.why}` : 'rien'; c[k] = (c[k] || 0) + 1; }
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
};

test('rendement : dividende par part et par jour rapporté au prix', () => {
  assert.equal(yieldOf(shop()), 0.01);
  assert.equal(yieldOf(shop({ div_mode: 'coffre', div_pct: 5, balance: 2000 })), 0.01); // 5 % de 2000 / 1000 parts = 0,1
  assert.equal(yieldOf(shop({ div_pct: 0 })), 0);
});

test('chaque compte a un profil stable, tous les profils existent', () => {
  assert.equal(investorOf({ id: 42 }, { type: 'trader' }).name, investorOf({ id: 42 }, { type: 'trader' }).name);
  const seen = new Set();
  for (let id = 1; id < 3000; id++) for (const type of ['trader', 'collector', 'grinder', 'regular', 'casual']) seen.add(investorOf({ id }, { type }).name);
  assert.deepEqual([...seen].sort(), Object.keys(STYLES).sort());
});

test('rentier : achète un bon rendement, ignore une boutique qui ne verse rien, revend si les dividendes s\'arrêtent', () => {
  assert.equal(often(() => decide(inv('rentier'), shop({ div_pct: 2 }), 0, 5000, 5000)), 'buy:pour les dividendes');
  assert.equal(often(() => decide(inv('rentier'), shop({ div_pct: 0 }), 0, 5000, 5000)), 'rien');
  assert.equal(often(() => decide(inv('rentier'), shop({ div_pct: 0 }), 50, 5000, 5500)), 'sell:plus de dividendes');
});

test('prudent : exige un rachat garanti', () => {
  assert.equal(often(() => decide(inv('prudent'), shop({ div_pct: 4, buyback_pct: 0 }), 0, 5000, 5000)), 'rien');
  assert.equal(often(() => decide(inv('prudent'), shop({ div_pct: 4 }), 0, 5000, 5000)), 'buy:rendement sûr');
});

test('chasseur : quitte une boutique quand une autre rapporte deux fois plus', () => {
  assert.equal(often(() => decide(inv('chasseur'), shop({ div_pct: 2 }), 40, 3000, 3400, 0.05)), 'sell:mieux ailleurs');
});

test('limites : parts restantes, maximum par joueur, sa propre boutique, boutique fermée, budget', () => {
  const d = decide(inv('chasseur'), shop({ div_pct: 3, shares_max: 100, sold: 95 }), 0, 100_000, 100_000);
  assert.ok(d && d.qty <= 5);
  assert.equal(decide(inv('chasseur'), shop({ div_pct: 3, max_per_player: 10 }), 10, 100_000, 100_000), null);
  assert.equal(decide(inv('chasseur'), shop({ div_pct: 3, owner_id: 7 }), 0, 100_000, 100_000), null);
  assert.equal(decide(inv('chasseur'), shop({ div_pct: 3, is_open: false }), 0, 100_000, 100_000), null);
  assert.equal(decide(inv('chasseur'), shop({ div_pct: 3 }), 0, 5, 5), null);
});

test('à court de bits : revend une partie si la boutique rachète', () => {
  assert.equal(often(() => decide(inv('rentier'), shop({ div_pct: 2 }), 40, 20, 420)), 'sell:besoin de bits');
  assert.equal(decide(inv('rentier'), shop({ div_pct: 2, buyback_pct: 0 }), 40, 20, 420)?.side ?? 'rien', 'rien');
});
