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

dbtest('parts : on achète directement à la boutique, l\'argent va dans le coffre, limites respectées', async () => {
  const owner = await user(SHOP_PRICE), x = await user(1000), y = await user(1000);
  const { id } = await shops.createShop(owner, { name: 'Parts', sharePrice: 10, sharesMax: 30, maxPerPlayer: 20 });
  await assert.rejects(shops.buyShares(owner, id, 1), /propre boutique/);
  const r = await shops.buyShares(x, id, 2);
  assert.deepEqual(r, { qty: 2, cost: 20 });
  assert.equal(await bits(x), 980);
  assert.equal(Number((await db.one('SELECT balance FROM shops WHERE id = $1', [id])).balance), 20); // les 20 bits vont à la boutique
  await assert.rejects(shops.buyShares(x, id, 19), /20 parts par joueur/);
  await shops.buyShares(y, id, 20);
  await assert.rejects(shops.buyShares(x, id, 9), /que 8 parts/);
  // Pas de rachat par défaut ; quand le propriétaire l'active (80 %), on revend 2 parts pour 16 bits.
  await assert.rejects(shops.sellShares(x, id, 1), /ne rachète pas/);
  await shops.updateShop(owner, id, { buybackPct: 80 });
  assert.equal((await shops.sellShares(x, id, 2)).amount, 16);
  assert.equal(await bits(x), 996);
  await assert.rejects(shops.updateShop(owner, id, { sharesMax: 10 }), /20 parts sont déjà vendues/);
  // Boutique fermée : plus d'achat.
  await shops.updateShop(owner, id, { isOpen: false });
  await assert.rejects(shops.buyShares(x, id, 1), /fermée/);
  const st = await shops.stock(x.id, id);
  assert.equal(st.shop.sharesLeft, 10);
  assert.deepEqual(st.recent.map((g) => g.kind), ['revente', 'achat', 'achat']);
});

dbtest('dividendes : % du coffre ou % du prix, au prorata des parts, fractions gardées', async () => {
  const owner = await user(SHOP_PRICE * 2 + 2000), z = await user(10_000), w = await user(10_000);
  // Mode coffre : 10 % du coffre par jour, partagé entre les 1 000 parts.
  const a = await shops.createShop(owner, { name: 'Rentable', divPct: 10, sharePrice: 1 });
  await shops.deposit(owner, a.id, 1000);
  await shops.buyShares(z, a.id, 250);
  let before = await bits(z);
  await db.run('UPDATE shops SET div_day = 0 WHERE id = $1', [a.id]);
  await shops.dailyJobs();
  assert.equal(await bits(z), before + 31); // coffre 1250 (1000 + 250 parts à 1) : 10 % = 125 → 0,125 × 250 = 31,25
  assert.equal(Number((await db.one('SELECT balance FROM shops WHERE id = $1', [a.id])).balance), 1250 - 31);
  await shops.dailyJobs();
  assert.equal(await bits(z), before + 31); // pas deux fois le même jour
  // Mode fixe : 1 % du prix (10) = 0,1 bit par part et par jour ; avec 2 parts, 0,2/jour : versé tous les 5 jours.
  const b = await shops.createShop(owner, { name: 'Fixe', divMode: 'fixe', divPct: 1, sharePrice: 10 });
  await shops.buyShares(w, b.id, 2);
  before = await bits(w);
  for (let d = 0; d < 5; d++) { await db.run('UPDATE shops SET div_day = 0 WHERE id = $1', [b.id]); await shops.dailyJobs(); }
  assert.equal(await bits(w), before + 1);
  assert.equal(Number((await db.one('SELECT received FROM shares WHERE shop_id = $1 AND user_id = $2', [b.id, w.id])).received), 1);
  const pf = await shops.portfolio(w.id);
  assert.equal(pf.items[0].perDay, 0.2);
});

dbtest('réglages : frais de dépôt, prix min/max, annonces par vendeur, réduction actionnaires', async () => {
  const owner = await user(SHOP_PRICE), a = await user(100, 5), b = await user(5000);
  const { id } = await shops.createShop(owner, { name: 'Stricte', feePct: 20, listingFee: 10, minPrice: 50, maxPrice: 500, sellerMax: 1, holderDiscount: 50, sharePrice: 1 });
  await db.run(`UPDATE users SET next_pack = '{"quality":"standard","boost":1}' WHERE id = $1`, [a.id]);
  const p1 = await shops.sealPack(a.id), p2 = await shops.sealPack(a.id);
  await assert.rejects(shops.listPack(a, { packId: p1.id, shopId: id, price: 20 }), /au moins 50/);
  await assert.rejects(shops.listPack(a, { packId: p1.id, shopId: id, price: 900 }), /au-dessus de 500/);
  const l = await shops.listPack(a, { packId: p1.id, shopId: id, price: 100 });
  assert.equal(await bits(a), 90); // 10 bits de frais de dépôt
  await assert.rejects(shops.listPack(a, { packId: p2.id, shopId: id, price: 100 }), /1 booster en vente par vendeur/);
  await shops.buyShares(b, id, 1); // b devient actionnaire : commission 20 % → 10 %
  assert.equal((await shops.buyListing(b, l.id)).fee, 10);
  assert.equal(await bits(a), 90 + 90);
  assert.equal(Number((await db.one('SELECT balance FROM shops WHERE id = $1', [id])).balance), 10 + 1 + 10);
  await assert.rejects(shops.updateShop(owner, id, { minPrice: 600 }), /minimum dépasse/);
  await assert.rejects(shops.updateShop(owner, id, { color: 'red' }), /Couleur/);
});

dbtest('prêts : intérêts selon la durée, frais de dossier, acceptation automatique, pénalité de retard', async () => {
  const owner = await user(SHOP_PRICE + 10_000), b = await user(0), c = await user(0);
  const { id } = await shops.createShop(owner, { name: 'Crédit', loanRate: 5, loanDaily: 1, loanFee: 10, loanLate: 10, loanMin: 100, loanMax: 2000, loanMinDays: 2, loanMaxDays: 10, loanAuto: 500 });
  await shops.deposit(owner, id, 10_000);
  await assert.rejects(shops.requestLoan(b, id, { amount: 50, days: 3 }), /minimum 100/);
  await assert.rejects(shops.requestLoan(b, id, { amount: 300, days: 1 }), /de 2 à 10 jours/);
  // 300 bits sur 2 jours : 300 × (1 + 5 % + 2 × 1 %) + 10 = 331 ; acceptés tout de suite (≤ 500).
  const r1 = await shops.requestLoan(b, id, { amount: 300, days: 2 });
  assert.deepEqual([r1.due, r1.status], [331, 'active']);
  assert.equal(await bits(b), 300);
  // Plus long = plus cher : 1000 bits sur 10 jours = 1000 × 1,15 + 10 = 1160 ; au-dessus de 500 : décision du propriétaire.
  const r2 = await shops.requestLoan(c, id, { amount: 1000, days: 10 });
  assert.deepEqual([r2.due, r2.status], [1160, 'pending']);
  // Retard : b n'a que 100 bits à l'échéance → 231 restants + 10 % = 24 de pénalité.
  await db.run('UPDATE users SET bits = 100 WHERE id = $1', [b.id]);
  await db.run('UPDATE shop_loans SET due_at = 0 WHERE id = $1', [r1.id]);
  await shops.dailyJobs();
  const l = await db.one('SELECT * FROM shop_loans WHERE id = $1', [r1.id]);
  assert.deepEqual([l.status, l.paid, l.due_amount], ['defaulted', 100, 331 + 24]);
});

dbtest('retrait du coffre (25 %/jour, public) et suppression de la boutique', async () => {
  const owner = await user(SHOP_PRICE + 2000), h = await user(1000), s1 = await user(0, 2), bor = await user(0);
  const { id } = await shops.createShop(owner, { name: 'Éphémère', sharePrice: 10, loanAuto: 1000 });
  await shops.deposit(owner, id, 1000);
  await shops.buyShares(h, id, 50); // coffre 1500
  await assert.rejects(shops.withdraw(owner, id, 400), /au plus 375/);
  await shops.withdraw(owner, id, 300);
  await assert.rejects(shops.withdraw(owner, id, 100), /au plus 75/);
  assert.equal(await bits(owner), 2000 - 1000 + 300);
  await assert.rejects(shops.withdraw(h, id, 1), /propriétaire/);
  // Un booster en vente et un prêt en cours.
  await db.run(`UPDATE users SET next_pack = '{"quality":"standard","boost":1}' WHERE id = $1`, [s1.id]);
  const p = await shops.sealPack(s1.id);
  await shops.listPack(s1, { packId: p.id, shopId: id, price: 50 });
  await shops.requestLoan(bor, id, { amount: 200, days: 3 }); // accordé automatiquement : coffre 1200 - 200 = 1000
  const r = await shops.deleteShop(owner, id);
  assert.deepEqual([r.listings, r.loans, r.holders, r.refunded, r.toOwner], [1, 1, 1, 500, 500]);
  assert.equal(await bits(h), 1000); // remboursé au prix d'une part
  assert.equal((await db.one('SELECT status FROM sealed_packs WHERE id = $1', [p.id])).status, 'owned');
  assert.ok(!(await db.one('SELECT 1 FROM shops WHERE id = $1', [id])));
  assert.equal(await bits(bor), 200); // prêt annulé : il garde les bits
});

dbtest('remise à zéro de l\'ancienne bourse : acheteurs remboursés, vendeurs repris, ordres annulés', async () => {
  const { resetOldBourse } = await import('../lib/db.js');
  const owner = await user(SHOP_PRICE + 500), buyer = await user(100), bidder = await user(50);
  const { id } = await shops.createShop(owner, { name: 'Ancienne' });
  await db.run("DELETE FROM meta WHERE key = 'bourse_v2'");
  // Ancien état : buyer a payé 300 à owner pour 30 actions ; bidder a 40 bits bloqués dans un ordre d'achat.
  await db.run('INSERT INTO stock_trades (shop_id, price, qty, buyer_id, seller_id, at) VALUES ($1, 10, 30, $2, $3, 0)', [id, buyer.id, owner.id]);
  await db.run("INSERT INTO stock_orders (shop_id, user_id, side, price, qty, filled, status, created_at) VALUES ($1, $2, 'buy', 4, 10, 0, 'open', 0)", [id, bidder.id]);
  await db.run('INSERT INTO shares (shop_id, user_id, qty) VALUES ($1, $2, 30)', [id, buyer.id]);
  const r = await db.tx((q) => resetOldBourse(q));
  assert.deepEqual([r.refunded, r.clawed, r.escrow], [300, 300, 40]);
  assert.deepEqual([await bits(buyer), await bits(owner), await bits(bidder)], [400, 200, 90]);
  assert.equal((await db.one('SELECT COUNT(*) n FROM shares')).n, 0);
  assert.equal(await db.tx((q) => resetOldBourse(q)), null); // une seule fois
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
  await shops.updateShop(owner, id, { sharePrice: 5, divPct: 5 });
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
  assert.ok(log.some((l) => l.startsWith('achat de parts')), `aucun achat de parts : ${[...new Set(log)].join(', ')}`);
  assert.ok(has('boutique ouverte'), 'le compte riche ouvre une boutique');
  assert.ok((await db.one("SELECT COUNT(*) n FROM shop_listings")).n > 0);
  // Aucun bit créé : bits des joueurs + coffres + ordres d'achat bloqués restent cohérents (pas de solde négatif).
  assert.equal((await db.one('SELECT COUNT(*) n FROM users WHERE bits < 0')).n, 0);
  assert.equal((await db.one('SELECT COUNT(*) n FROM shares WHERE qty < 0')).n, 0);
});
