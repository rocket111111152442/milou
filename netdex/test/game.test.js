// Tests sur un vrai Postgres : TEST_DATABASE_URL=postgres://... npm test (base vidée à chaque test).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, migrate } from '../lib/db.js';
import { importSites, keepDomain, rarityForRank } from '../lib/sites.js';
import { createGame, CONFIG } from '../lib/game.js';

const URL = process.env.TEST_DATABASE_URL;
let db, game, n = 0;

before(async () => {
  if (!URL) return;
  db = createDb(URL);
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(db);
  const lines = [];
  for (let i = 1; i <= 200_000; i++) lines.push(`${i},site${i}.com`);
  await importSites(db, lines.join('\n'));
  game = await createGame(db);
});
after(() => db?.close());

const user = async (bits = 1000) => {
  const now = Date.now();
  return db.one('INSERT INTO users (username, pass_hash, created_at, bits, pack_stock, pack_anchor) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    ['u' + ++n, 'x', now, bits, CONFIG.startPacks, now]);
};
const reload = (u) => db.one('SELECT * FROM users WHERE id = $1', [u.id]);
const dbtest = (name, fn) => test(name, { skip: !URL && 'TEST_DATABASE_URL absent' }, fn);

test('filtres et raretés', () => {
  assert.equal(keepDomain('youtube.com'), true);
  assert.equal(keepDomain('akamaiedge.net'), false);
  assert.equal(keepDomain('googleapis.com'), false);
  assert.equal(keepDomain('pornhub.com'), false);
  assert.equal(keepDomain('essex.ac.uk'), true);
  assert.equal(rarityForRank(1), 5);
  assert.equal(rarityForRank(26), 4);
  assert.equal(rarityForRank(2500), 3);
  assert.equal(rarityForRank(25001), 1);
  assert.equal(rarityForRank(500000), 0);
});

dbtest('le chrono des boosters tourne côté serveur et plafonne', async () => {
  const u = await user();
  for (let i = 0; i < CONFIG.startPacks; i++) assert.equal((await game.openPack(u.id, 'free')).length, 5);
  await assert.rejects(game.openPack(u.id, 'free'), /Aucun booster/);
  await db.run('UPDATE users SET pack_anchor = pack_anchor - $1 WHERE id = $2', [CONFIG.packInterval, u.id]);
  assert.equal(game.packState(await reload(u)).available, 1);
  await db.run('UPDATE users SET pack_anchor = pack_anchor - $1 WHERE id = $2', [86400e3, u.id]);
  const st = game.packState(await reload(u));
  assert.equal(st.available, CONFIG.packCap);
  assert.equal(st.nextAt, null);
  await game.openPack(u.id, 'free');
  const after = game.packState(await reload(u));
  assert.equal(after.available, CONFIG.packCap - 1);
  assert.ok(after.nextAt > Date.now() + CONFIG.packInterval - 2000);
});

dbtest('ouvertures simultanées : jamais plus que le stock', async () => {
  const u = await user();
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => game.openPack(u.id, 'free')));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, CONFIG.startPacks);
});

dbtest('la 5e carte est au moins Rare, le premium garantit Épique+', async () => {
  const u = await user(100_000);
  for (let i = 0; i < 10; i++) {
    const cards = await game.openPack(u.id, 'premium');
    assert.ok(cards[4].site.rarity >= 3);
    assert.ok(cards.every((c) => c.site.rarity >= 1));
  }
  await assert.rejects(game.openPack((await user(10)).id, 'premium'), /300 bits/);
});

dbtest('échange entre amis', async () => {
  const a = await user(500), b = await user(500);
  await assert.rejects(game.createTrade(a, { toUserId: b.id, offerBits: 10 }), /amis/);
  await game.requestFriend(a, b.username);
  await game.respondFriend(b, a.id, true);
  assert.equal(await game.relation(db, a.id, b.id), 'friends');
  const [ca] = await game.openPack(a.id, 'free');
  const [cb] = await game.openPack(b.id, 'free');
  const { id } = await game.createTrade(a, { toUserId: b.id, offerCards: [ca.cardId], requestCards: [cb.cardId], offerBits: 50 });
  await assert.rejects(game.resolveTrade(a, id, 'accept'), /interdite/);
  await game.resolveTrade(b, id, 'accept');
  assert.equal((await db.one('SELECT user_id FROM cards WHERE id = $1', [ca.cardId])).user_id, b.id);
  assert.equal((await db.one('SELECT user_id FROM cards WHERE id = $1', [cb.cardId])).user_id, a.id);
  assert.equal((await reload(a)).bits, 450);
  assert.equal((await reload(b)).bits, 550);
  const { id: id2 } = await game.createTrade(a, { toUserId: b.id, offerCards: [cb.cardId] });
  await game.recycle(a.id, [cb.cardId]);
  await assert.rejects(game.resolveTrade(b, id2, 'accept'), /plus disponible/);
  assert.equal((await db.one('SELECT status FROM trades WHERE id = $1', [id2])).status, 'invalid');
});

dbtest('enchères : surenchère remboursée, achat immédiat, commission', async () => {
  const seller = await user(0), b1 = await user(1000), b2 = await user(1000);
  const [c] = await game.openPack(seller.id, 'free');
  const { id } = await game.createAuction(seller, { cardId: c.cardId, startPrice: 100, buyout: 400, hours: 1 });
  await assert.rejects(game.recycle(seller.id, [c.cardId]), /Aucune carte/);
  await game.bid(b1, id, 100);
  assert.equal((await reload(b1)).bits, 900);
  await assert.rejects(game.bid(b2, id, 101), /minimum : 105/);
  await game.bid(b2, id, 150);
  assert.equal((await reload(b1)).bits, 1000, 'b1 remboursé');
  await game.bid(b1, id, 0, true);
  assert.equal((await reload(b1)).bits, 600);
  assert.equal((await reload(b2)).bits, 1000);
  assert.equal((await reload(seller)).bits, 400 - 20);
  const card = await db.one('SELECT * FROM cards WHERE id = $1', [c.cardId]);
  assert.equal(card.user_id, b1.id);
  assert.equal(card.status, 'owned');
});

dbtest('enchère expirée sans offre : la carte revient', async () => {
  const s = await user(0);
  const [c] = await game.openPack(s.id, 'free');
  const { id } = await game.createAuction(s, { cardId: c.cardId, startPrice: 5, hours: 1 });
  await db.run('UPDATE auctions SET ends_at = 0 WHERE id = $1', [id]);
  assert.ok((await game.settleAuctions()) >= 1);
  assert.equal((await db.one('SELECT status FROM cards WHERE id = $1', [c.cardId])).status, 'owned');
});

dbtest('recyclage des doublons garde un exemplaire', async () => {
  const u = await user(0);
  for (let i = 0; i < 4; i++) await db.run('INSERT INTO cards (user_id, site_id, holo, obtained_at) VALUES ($1, 100000, 0, $2)', [u.id, Date.now()]);
  const r = await game.recycleDuplicates(u.id, 2);
  assert.equal(r.count, 3);
  assert.equal((await reload(u)).bits, 9);
  assert.equal((await db.one('SELECT COUNT(*) n FROM cards WHERE user_id = $1', [u.id])).n, 1);
});
