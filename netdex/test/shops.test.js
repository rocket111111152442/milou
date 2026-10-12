// Boutiques d'échange, boosters scellés, prêts et bourse.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, migrate } from '../lib/db.js';
import { importSites } from '../lib/sites.js';
import { createGame, CONFIG } from '../lib/game.js';
import { createShops, SHOP_PRICE } from '../lib/shops.js';
import { rollQuality, QUALITIES } from '../lib/game.js';

const URL = process.env.TEST_DATABASE_URL ? process.env.TEST_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, '/netdex_shops$1') : null;
let db, game, shops, n = 0;

before(async () => {
  if (!URL) return;
  const admin = createDb(process.env.TEST_DATABASE_URL);
  await admin.query('DROP DATABASE IF EXISTS netdex_shops').catch(() => {});
  await admin.query('CREATE DATABASE netdex_shops');
  await admin.close();
  db = createDb(URL);
  await migrate(db);
  const lines = [];
  for (let i = 1; i <= 200_000; i++) lines.push(`${i},site${i}.com`);
  await importSites(db, lines.join('\n'));
  game = await createGame(db);
  shops = createShops(db, game);
});
after(() => db?.close());

const user = async (bits = 0, packs = 5) => {
  const now = Date.now();
  return db.one('INSERT INTO users (username, pass_hash, created_at, bits, pack_stock, pack_anchor) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    ['s' + ++n, 'x', now, bits, packs, now]);
};
const bits = async (u) => (await db.one('SELECT bits FROM users WHERE id = $1', [u.id])).bits;
const dbtest = (name, fn) => test(name, { skip: !URL && 'TEST_DATABASE_URL absent' }, fn);

test('qualités : chaque booster est différent, les bons sont rares, moyenne ~0,9', () => {
  const c = {};
  let sum = 0;
  for (let i = 0; i < 50000; i++) { const r = rollQuality(); c[r.quality] = (c[r.quality] || 0) + 1; sum += r.boost; }
  assert.equal(Object.keys(c).length, Object.keys(QUALITIES).length);
  assert.ok(c.terne > 26500 && c.terne < 28500);
  assert.ok(c.prestige > 40 && c.prestige < 180); // ~1 sur 500
  const mean = sum / 50000;
  assert.ok(mean > 0.85 && mean < 0.96, 'moyenne ' + mean);
});

dbtest('cotes : un booster boosté a de meilleures chances', () => {
  const a = game.packOdds(1), b = game.packOdds(10);
  assert.ok(b[5] > a[5] * 7 && b[3] > a[3] * 5); // ×10 sur les poids, dilué par la normalisation
  assert.ok(a[2] > 0 && a[2] < 1);
});

dbtest('sceller puis ouvrir un booster', async () => {
  const u = await user(0, 2);
  await db.run(`UPDATE users SET next_pack = '{"quality":"brillant","boost":4.5}' WHERE id = $1`, [u.id]);
  const p = await shops.sealPack(u.id);
  assert.equal(p.quality, 'brillant'); // il garde la qualité annoncée
  assert.ok((await db.one('SELECT next_pack FROM users WHERE id = $1', [u.id])).next_pack.quality); // une nouvelle est tirée
  assert.ok(p.odds[5] > 0);
  assert.equal((await db.one('SELECT pack_stock FROM users WHERE id = $1', [u.id])).pack_stock, 1);
  const r = await shops.openSealed(u.id, p.id);
  assert.equal(r.cards.length, CONFIG.packSize);
  await assert.rejects(shops.openSealed(u.id, p.id), /introuvable/);
});

dbtest('boutique : création, vente avec commission dans le coffre', async () => {
  const owner = await user(SHOP_PRICE + 100), seller = await user(0), buyer = await user(1000);
  await assert.rejects(shops.createShop(await user(10), { name: 'Pauvre' }), /25/);
  const { id } = await shops.createShop(owner, { name: 'Le Comptoir', feePct: 10 });
  assert.equal(await bits(owner), 100);
  const pack = await shops.sealPack(seller.id);
  const l = await shops.listPack(seller, { packId: pack.id, shopId: id, price: 500 });
  await assert.rejects(shops.openSealed(seller.id, pack.id), /introuvable/); // en vente : on ne peut plus l'ouvrir
  await shops.buyListing(buyer, l.id);
  assert.equal(await bits(buyer), 500);
  assert.equal(await bits(seller), 450);
  assert.equal((await db.one('SELECT balance FROM shops WHERE id = $1', [id])).balance, 50);
  assert.equal((await db.one('SELECT owner_id FROM sealed_packs WHERE id = $1', [pack.id])).owner_id, buyer.id);
  await assert.rejects(shops.buyListing(buyer, l.id), /vendu/);
});

dbtest('boutique : qualités acceptées respectées', async () => {
  const owner = await user(SHOP_PRICE), seller = await user(0, 10);
  const { id } = await shops.createShop(owner, { name: 'Que du lourd', accepts: ['prestige'] });
  const p = await shops.sealPack(seller.id);
  if (p.quality !== 'prestige') await assert.rejects(shops.listPack(seller, { packId: p.id, shopId: id, price: 10 }), /n'accepte pas/);
});

dbtest('prêt : accord, remboursement automatique, défaut', async () => {
  const owner = await user(SHOP_PRICE + 5000), b = await user(0);
  const { id } = await shops.createShop(owner, { name: 'Banque', loanRate: 10, loanMax: 2000 });
  await assert.rejects(shops.requestLoan(b, id, { amount: 1000, days: 3 }).then((r) => shops.respondLoan(owner, r.id, true)), /coffre/);
  await shops.deposit(owner, id, 5000);
  const r = await shops.requestLoan(b, id, { amount: 1000, days: 3 }).catch(async () => {
    await db.run("UPDATE shop_loans SET status = 'refused' WHERE borrower_id = $1", [b.id]);
    return shops.requestLoan(b, id, { amount: 1000, days: 3 });
  });
  assert.equal(r.due, 1100);
  await shops.respondLoan(owner, r.id, true);
  assert.equal(await bits(b), 1000);
  // Échéance avec seulement 600 bits : défaut partiel.
  await db.run('UPDATE users SET bits = 600 WHERE id = $1', [b.id]);
  await db.run('UPDATE shop_loans SET due_at = 0 WHERE id = $1', [r.id]);
  await shops.dailyJobs();
  let l = await db.one('SELECT * FROM shop_loans WHERE id = $1', [r.id]);
  assert.equal(l.status, 'defaulted');
  assert.equal(l.paid, 600);
  await assert.rejects(shops.requestLoan(b, id, { amount: 10, days: 1 }), /impayé|déjà/);
  await db.run('UPDATE users SET bits = 1000 WHERE id = $1', [b.id]);
  await shops.repayLoan(b, r.id);
  l = await db.one('SELECT * FROM shop_loans WHERE id = $1', [r.id]);
  assert.equal(l.status, 'repaid');
  assert.equal(await bits(b), 500);
  assert.equal((await db.one('SELECT balance FROM shops WHERE id = $1', [id])).balance, 5000 + 100);
});

dbtest('bourse : carnet d\'ordres, priorité prix, bits et actions conservés', async () => {
  const owner = await user(SHOP_PRICE), x = await user(10_000), y = await user(10_000);
  const { id } = await shops.createShop(owner, { name: 'Cotée' });
  await shops.placeOrder(owner, id, { side: 'sell', type: 'limit', qty: 100, price: 20 });
  await shops.placeOrder(owner, id, { side: 'sell', type: 'limit', qty: 100, price: 15 });
  // x achète 150 au marché : 100 à 15 puis 50 à 20.
  const r = await shops.placeOrder(x, id, { side: 'buy', type: 'market', qty: 150 });
  assert.equal(r.filled, 150);
  assert.equal(await bits(x), 10_000 - 100 * 15 - 50 * 20);
  assert.equal((await db.one('SELECT last_price FROM shops WHERE id = $1', [id])).last_price, 20);
  // y place un achat limite à 18 (pas d'exécution), puis x vend 30 à 17 : exécuté au prix de l'acheteur (18).
  await shops.placeOrder(y, id, { side: 'buy', type: 'limit', qty: 40, price: 18 });
  assert.equal(await bits(y), 10_000 - 40 * 18);
  const s = await shops.placeOrder(x, id, { side: 'sell', type: 'limit', qty: 30, price: 17 });
  assert.equal(s.filled, 30);
  assert.equal(s.avgPrice, 18);
  // y annule le reste (10 actions × 18 rendus).
  const o = await db.one("SELECT id FROM stock_orders WHERE user_id = $1 AND status = 'open'", [y.id]);
  await shops.cancelOrder(y, o.id);
  assert.equal(await bits(y), 10_000 - 30 * 18);
  const sh = await db.all('SELECT user_id, qty, locked FROM shares WHERE shop_id = $1 ORDER BY user_id', [id]);
  assert.equal(sh.reduce((a, h) => a + h.qty, 0), 1000); // les actions ne se créent ni ne disparaissent
  assert.deepEqual(sh.find((h) => h.user_id === y.id), { user_id: y.id, qty: 30, locked: 0 });
  await assert.rejects(shops.placeOrder(y, id, { side: 'sell', type: 'limit', qty: 31, price: 5 }), /que 30/);
});

dbtest('dividendes : une fois par jour, au prorata des actions', async () => {
  const owner = await user(SHOP_PRICE + 1000), z = await user(10_000);
  const { id } = await shops.createShop(owner, { name: 'Rentable', divPct: 10 });
  await shops.deposit(owner, id, 1000);
  await shops.placeOrder(owner, id, { side: 'sell', type: 'limit', qty: 250, price: 1 });
  await shops.placeOrder(z, id, { side: 'buy', type: 'market', qty: 250 });
  const before = await bits(z);
  await db.run('UPDATE shops SET div_day = 0 WHERE id = $1', [id]);
  await shops.dailyJobs();
  assert.equal(await bits(z), before + 25); // 10 % de 1000 = 100, ×250/1000
  assert.equal((await db.one('SELECT balance FROM shops WHERE id = $1', [id])).balance, 900);
  await shops.dailyJobs();
  assert.equal(await bits(z), before + 25); // pas deux fois le même jour
});

dbtest('boutique Premium : 30 000 bits, commission jusqu\'à 40 %, +15 % une seule fois par booster', async () => {
  const owner = await user(30_000 + 25_000 + 5_000), a = await user(0, 3), b = await user(5000), c = await user(5000);
  await assert.rejects(shops.createShop(owner, { name: 'Trop cher', feePct: 30 }), /entre 0 et 25/); // Standard : 25 % max
  const { id } = await shops.createShop(owner, { name: 'Le Palace', tier: 'premium', feePct: 35 });
  assert.equal(await bits(owner), 30_000);
  assert.equal((await db.one('SELECT tier, fee_pct FROM shops WHERE id = $1', [id])).tier, 'premium');
  await db.run(`UPDATE users SET next_pack = '{"quality":"standard","boost":1}' WHERE id = $1`, [a.id]);
  const p = await shops.sealPack(a.id);
  const l1 = await shops.listPack(a, { packId: p.id, shopId: id, price: 100 });
  const view = await shops.shopDetail(b.id, id);
  assert.equal(view.listings[0].pack.boost, 1.15); // chances affichées = après bonus
  const r = await shops.buyListing(b, l1.id);
  assert.equal(r.fee, 35);
  assert.equal(r.boost, 1.15);
  // Revendu dans la même boutique : pas de deuxième bonus.
  const l2 = await shops.listPack(b, { packId: p.id, shopId: id, price: 100 });
  assert.equal((await shops.shopDetail(c.id, id)).listings[0].pack.boost, 1.15);
  assert.equal((await shops.buyListing(c, l2.id)).boost, 1.15);
  // Une boutique Standard passe Premium pour 5 000 bits.
  const s2 = await shops.createShop(owner, { name: 'Petite échoppe' });
  await shops.upgradeShop(owner, s2.id);
  assert.equal(await bits(owner), 0);
  await shops.updateShop(owner, s2.id, { feePct: 40 });
  await assert.rejects(shops.updateShop(owner, s2.id, { feePct: 41 }), /entre 0 et 40/);
});

dbtest('comptes animés : coffre, mini-jeux, boosters en boutique, bourse, prêts et boutique à eux', async () => {
  const { createBotEconomy } = await import('../lib/bot-economy.js');
  const { createFun } = await import('../lib/fun.js');
  const { GameError } = await import('../lib/game.js');
  const eco = createBotEconomy(db, game, shops, createFun(db, game));
  const owner = await user(SHOP_PRICE + 5000);
  const { id } = await shops.createShop(owner, { name: 'Chez Humain', feePct: 5, loanMax: 500 });
  await shops.deposit(owner, id, 3000);
  await shops.placeOrder(owner, id, { side: 'sell', type: 'limit', qty: 100, price: 8 });
  const mk = async (type, b) => db.one(`INSERT INTO users (username, pass_hash, created_at, bits, pack_stock, pack_anchor, is_bot, bot, bot_next_at)
    VALUES ($1, 'x', 0, $2, 10, $3, true, $4, 0) RETURNING *`,
  ['anim' + ++n, b, Date.now(), JSON.stringify({ type, tz: 0, sleep: [3, 4], greed: 1, eye: 2.5, fav: null, market: 1, social: 0, stall: 4 })]);
  const bots = [await mk('trader', 40_000), await mk('trader', 3000), await mk('collector', 5000), await mk('regular', 50), await mk('grinder', 800)];
  const log = [];
  const tryDo = async (label, fn) => { try { const r = await fn(); if (r !== undefined) log.push(label); return r; } catch (e) { if (!(e instanceof GameError)) throw e; } };
  for (let round = 0; round < 25; round++) {
    for (const b of bots) {
      const fresh = await db.one('SELECT * FROM users WHERE id = $1', [b.id]);
      await db.run('UPDATE users SET pack_stock = 10, pack_anchor = $1 WHERE id = $2', [Date.now(), b.id]);
      await eco.play(fresh, { id: b.id, username: b.username }, { ...JSON.parse(JSON.stringify(fresh.bot)), packs: 1 }, tryDo, { dbFull: false });
    }
  }
  if (process.env.BOTLOG) console.log(Object.entries(log.reduce((a, l) => ({ ...a, [l]: (a[l] || 0) + 1 }), {})));
  const has = (l) => log.includes(l);
  for (const l of ['coffre', 'roue', 'mini-jeu', 'booster scellé', 'booster en vente']) assert.ok(has(l), `${l} manquant : ${[...new Set(log)].join(', ')}`);
  assert.ok(log.some((l) => l.startsWith('achat d\'actions')), `aucun achat d'actions : ${[...new Set(log)].join(', ')}`);
  assert.ok(has('boutique ouverte'), 'le compte riche ouvre une boutique');
  assert.ok((await db.one("SELECT COUNT(*) n FROM shop_listings")).n > 0);
  // Aucun bit créé : bits des joueurs + coffres + ordres d'achat bloqués restent cohérents (pas de solde négatif).
  assert.equal((await db.one('SELECT COUNT(*) n FROM users WHERE bits < 0')).n, 0);
  assert.equal((await db.one('SELECT COUNT(*) n FROM shares WHERE locked > qty')).n, 0);
});
