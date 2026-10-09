import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, withStatementCache } from '../server/db.js';
import { importSites, keepDomain, rarityForRank } from '../server/sites.js';
import { createGame, CONFIG } from '../server/game.js';

function setup() {
  const db = withStatementCache(openDb(':memory:'));
  const lines = [];
  for (let i = 1; i <= 200_000; i++) lines.push(`${i},site${i}.com`);
  importSites(db, lines.join('\n'));
  const game = createGame(db);
  let n = 0;
  const user = (bits = 1000) => {
    const now = Date.now();
    const id = Number(db.q('INSERT INTO users (username, pass_hash, created_at, bits, pack_stock, pack_anchor) VALUES (?, ?, ?, ?, ?, ?)')
      .run('u' + ++n, 'x', now, bits, CONFIG.startPacks, now).lastInsertRowid);
    return db.q('SELECT * FROM users WHERE id = ?').get(id);
  };
  const reload = (u) => db.q('SELECT * FROM users WHERE id = ?').get(u.id);
  return { db, game, user, reload };
}

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

test('le chrono des boosters tourne côté serveur et plafonne', () => {
  const { db, game, user, reload } = setup();
  const u = user();
  for (let i = 0; i < CONFIG.startPacks; i++) assert.equal(game.openPack(u.id, 'free').length, 5);
  assert.throws(() => game.openPack(u.id, 'free'), /Aucun booster/);
  // 3 minutes plus tard (app fermée) : un booster est revenu.
  db.q('UPDATE users SET pack_anchor = pack_anchor - ? WHERE id = ?').run(CONFIG.packInterval, u.id);
  assert.equal(game.packState(reload(u)).available, 1);
  // Une journée plus tard : plafonné au stock max.
  db.q('UPDATE users SET pack_anchor = pack_anchor - ? WHERE id = ?').run(86400e3, u.id);
  const st = game.packState(reload(u));
  assert.equal(st.available, CONFIG.packCap);
  assert.equal(st.nextAt, null);
  game.openPack(u.id, 'free');
  const after = game.packState(reload(u));
  assert.equal(after.available, CONFIG.packCap - 1);
  assert.ok(after.nextAt > Date.now() + CONFIG.packInterval - 2000, 'le chrono repart de maintenant après un stock plein');
});

test('la 5e carte est au moins Rare, le premium garantit Épique+', () => {
  const { game, user } = setup();
  const u = user(100_000);
  for (let i = 0; i < 20; i++) {
    const cards = game.openPack(u.id, 'premium');
    assert.ok(cards[4].site.rarity >= 3);
    assert.ok(cards.every((c) => c.site.rarity >= 1));
  }
});

test('échange entre amis', () => {
  const { db, game, user, reload } = setup();
  const a = user(500), b = user(500);
  assert.throws(() => game.createTrade(a, { toUserId: b.id, offerBits: 10 }), /amis/);
  game.requestFriend(a, b.username);
  game.respondFriend(b, a.id, true);
  assert.equal(game.relation(a.id, b.id), 'friends');
  const [ca] = game.openPack(a.id, 'free');
  const [cb] = game.openPack(b.id, 'free');
  const { id } = game.createTrade(a, { toUserId: b.id, offerCards: [ca.cardId], requestCards: [cb.cardId], offerBits: 50, requestBits: 0 });
  assert.throws(() => game.resolveTrade(a, id, 'accept'), /interdite/);
  game.resolveTrade(b, id, 'accept');
  assert.equal(db.q('SELECT user_id FROM cards WHERE id = ?').get(ca.cardId).user_id, b.id);
  assert.equal(db.q('SELECT user_id FROM cards WHERE id = ?').get(cb.cardId).user_id, a.id);
  assert.equal(reload(a).bits, 450);
  assert.equal(reload(b).bits, 550);
  // Une carte déjà partie rend l'échange invalide.
  const { id: id2 } = game.createTrade(a, { toUserId: b.id, offerCards: [cb.cardId] });
  game.recycle(a.id, [cb.cardId]);
  assert.throws(() => game.resolveTrade(b, id2, 'accept'), /plus disponible/);
  assert.equal(db.q('SELECT status FROM trades WHERE id = ?').get(id2).status, 'invalid');
});

test('enchères : surenchère remboursée, achat immédiat, commission', () => {
  const { db, game, user, reload } = setup();
  const seller = user(0), b1 = user(1000), b2 = user(1000);
  const [c] = game.openPack(seller.id, 'free');
  const { id } = game.createAuction(seller, { cardId: c.cardId, startPrice: 100, buyout: 400, hours: 1 });
  assert.throws(() => game.recycle(seller.id, [c.cardId]), /Aucune carte/);
  game.bid(b1, id, 100);
  assert.equal(reload(b1).bits, 900);
  assert.throws(() => game.bid(b2, id, 101), /minimum : 105/);
  game.bid(b2, id, 150);
  assert.equal(reload(b1).bits, 1000, 'b1 remboursé');
  game.bid(b1, id, 0, true);
  assert.equal(reload(b1).bits, 600);
  assert.equal(reload(b2).bits, 1000);
  assert.equal(reload(seller).bits, 400 - 20);
  const card = db.q('SELECT * FROM cards WHERE id = ?').get(c.cardId);
  assert.equal(card.user_id, b1.id);
  assert.equal(card.status, 'owned');
});

test('enchère expirée sans offre : la carte revient', () => {
  const { db, game, user } = setup();
  const s = user(0);
  const [c] = game.openPack(s.id, 'free');
  const { id } = game.createAuction(s, { cardId: c.cardId, startPrice: 5, hours: 1 });
  db.q('UPDATE auctions SET ends_at = 0 WHERE id = ?').run(id);
  assert.equal(game.settleAuctions(), 1);
  assert.equal(db.q('SELECT status FROM cards WHERE id = ?').get(c.cardId).status, 'owned');
});

test('recyclage des doublons garde un exemplaire', () => {
  const { db, game, user, reload } = setup();
  const u = user(0);
  const now = Date.now();
  for (let i = 0; i < 4; i++) db.q('INSERT INTO cards (user_id, site_id, holo, obtained_at) VALUES (?, ?, 0, ?)').run(u.id, 100000, now);
  const r = game.recycleDuplicates(u.id, 2);
  assert.equal(r.count, 3);
  assert.equal(reload(u).bits, 3 * 3);
  assert.equal(db.q('SELECT COUNT(*) n FROM cards WHERE user_id = ?').get(u.id).n, 1);
});
