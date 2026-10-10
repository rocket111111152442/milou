// Tests des options « fun » (progression, récompenses quotidiennes, forge, social, codes promo).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, migrate } from '../lib/db.js';
import { importSites } from '../lib/sites.js';
import { createGame, CONFIG } from '../lib/game.js';
import { createFun, progression } from '../lib/fun.js';

const URL = process.env.TEST_DATABASE_URL ? process.env.TEST_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, '/netdex_fun$1') : null;
let db, game, fun, n = 0;

before(async () => {
  if (!URL) return;
  const admin = createDb(process.env.TEST_DATABASE_URL);
  await admin.query('DROP DATABASE IF EXISTS netdex_fun').catch(() => {});
  await admin.query('CREATE DATABASE netdex_fun');
  await admin.close();
  db = createDb(URL);
  await migrate(db);
  const lines = [];
  for (let i = 1; i <= 200_000; i++) lines.push(`${i},site${i}.com`);
  await importSites(db, lines.join('\n'));
  game = await createGame(db);
  fun = createFun(db, game);
});
after(() => db?.close());

const user = async (bits = 1000) => {
  const now = Date.now();
  return db.one('INSERT INTO users (username, pass_hash, created_at, bits, pack_stock, pack_anchor) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    ['f' + ++n, 'x', now, bits, CONFIG.startPacks, now]);
};
const reload = (u) => db.one('SELECT * FROM users WHERE id = $1', [u.id]);
const befriend = async (a, b) => {
  await db.run("INSERT INTO friends (user_id, friend_id, status, created_at) VALUES ($1, $2, 'accepted', 0), ($2, $1, 'accepted', 0)", [a.id, b.id]);
};
const dbtest = (name, fn) => test(name, { skip: !URL && 'TEST_DATABASE_URL absent' }, fn);

dbtest('les boosters alimentent stats, XP et score de la semaine', async () => {
  const u = await user();
  await game.openPack(u.id, 'free');
  const r = await reload(u);
  assert.equal(r.stats.packs, 1);
  assert.equal(r.stats.cards, 5);
  assert.ok(r.week_score > 0);
  assert.ok(progression(r).xp >= 10);
});

dbtest('compteur de pitié : Épique+ garantie après 40 boosters sans', async () => {
  const u = await user();
  await db.run('UPDATE users SET pity = $1, pack_stock = 5 WHERE id = $2', [CONFIG.pityAfter, u.id]);
  const cards = await game.openPack(u.id, 'free');
  assert.ok(cards.some((c) => c.site.rarity >= 3));
  assert.equal((await reload(u)).pity, 0);
});

dbtest('coffre, roue, ticket : une fois par jour', async () => {
  const u = await user(0);
  const chest = await fun.openChest(u.id);
  assert.equal(chest.cards.length, 1);
  assert.ok(chest.cards[0].site.rarity >= 2);
  await assert.rejects(fun.openChest(u.id), /Déjà fait/);
  const w = await fun.spinWheel(u.id);
  assert.ok(w.index >= 0 && w.index < 8);
  await assert.rejects(fun.spinWheel(u.id), /Déjà fait/);
  const s = await fun.scratch(u.id);
  assert.equal(s.grid.length, 9);
  const counts = {};
  for (const x of s.grid) counts[x] = (counts[x] || 0) + 1;
  const trios = Object.entries(counts).filter(([, k]) => k >= 3).map(([x]) => x);
  assert.deepEqual(trios, s.win ? [s.win.sym] : []);
});

dbtest('quêtes : progression mesurée depuis le début de journée', async () => {
  const u = await user();
  await fun.touch(u.id);
  await db.run('UPDATE users SET pack_stock = 20 WHERE id = $1', [u.id]);
  for (let i = 0; i < 15; i++) await game.openPack(u.id, 'free');
  const h = await fun.hub(u.id);
  assert.equal(h.quests.length, 3);
  const packQ = h.quests.find((q) => q.id.startsWith('packs'));
  if (packQ) {
    assert.equal(packQ.progress, packQ.n);
    const before = (await reload(u)).bits;
    await fun.claimQuest(u.id, packQ.id);
    assert.equal((await reload(u)).bits, before + 60);
    await assert.rejects(fun.claimQuest(u.id, packQ.id), /Déjà/);
  }
  const open = h.quests.find((q) => q.progress < q.n);
  if (open) await assert.rejects(fun.claimQuest(u.id, open.id), /pas encore/);
});

dbtest('forge : 5 doublons communs donnent 1 peu commune, favoris protégés', async () => {
  const u = await user();
  const t = game.tiers[0];
  await db.run('INSERT INTO cards (user_id, site_id, obtained_at) SELECT $1, $2, 0 FROM generate_series(1, 4)', [u.id, t.lo]);
  await db.run('INSERT INTO cards (user_id, site_id, obtained_at) SELECT $1, $2, 0 FROM generate_series(1, 3)', [u.id, t.lo + 1]);
  await fun.toggle('favorites', u.id, t.lo + 1, true);
  await assert.rejects(fun.forge(u.id, 0), /Il faut 5/); // 3 doublons hors favoris seulement
  await fun.toggle('favorites', u.id, t.lo + 1, false);
  const r = await fun.forge(u.id, 0);
  assert.equal(r.cards[0].site.rarity, 1);
  const left = await db.all('SELECT site_id FROM cards WHERE user_id = $1 AND site_id IN ($2, $3)', [u.id, t.lo, t.lo + 1]);
  assert.equal(left.length, 2); // un exemplaire de chaque reste
  assert.equal((await reload(u)).stats.forged, 1);
});

dbtest('holo-isation : coût débité, carte holo en cas de succès', async () => {
  const u = await user(10_000);
  const c = await db.one('INSERT INTO cards (user_id, site_id, obtained_at) VALUES ($1, $2, 0) RETURNING id', [u.id, game.tiers[2].lo]);
  let ok = false, spent = 0;
  for (let i = 0; i < 40 && !ok; i++) { const r = await fun.holofy(u.id, c.id); ok = r.success; spent += r.cost; }
  assert.ok(ok);
  assert.equal((await reload(u)).bits, 10_000 - spent);
  await assert.rejects(fun.holofy(u.id, c.id), /déjà holo/);
});

dbtest('cadeaux et messages entre amis seulement, avec limites', async () => {
  const a = await user(2000), b = await user(0), c = await user(0);
  await assert.rejects(fun.gift(a, { toUserId: b.id, bits: 10 }), /amis/);
  await befriend(a, b);
  await fun.gift(a, { toUserId: b.id, bits: 300 });
  await assert.rejects(fun.gift(a, { toUserId: b.id, bits: 300 }), /Maximum 500/);
  assert.equal((await reload(b)).bits, 300);
  const card = await db.one('INSERT INTO cards (user_id, site_id, obtained_at) VALUES ($1, 5000, 0) RETURNING id', [a.id]);
  await fun.gift(a, { toUserId: b.id, cardId: card.id });
  assert.equal((await db.one('SELECT user_id FROM cards WHERE id = $1', [card.id])).user_id, b.id);
  await fun.sendMessage(a, b.id, 'salut');
  await assert.rejects(fun.sendMessage(a, c.id, 'salut'), /amis/);
  const conv = await fun.conversations(b.id);
  assert.equal(conv.items[0].unread, 1);
  const th = await fun.thread(b.id, a.id);
  assert.equal(th.items[0].text, 'salut');
  assert.equal((await fun.conversations(b.id)).items[0].unread, 0);
  // Un message d'un non-ami doit apparaître dans la liste (sinon le compteur affiche des messages introuvables).
  await db.run("INSERT INTO messages (from_id, to_id, text, at) VALUES ($1, $2, 'coucou', $3)", [c.id, b.id, Date.now()]);
  const conv2 = await fun.conversations(b.id);
  const fromC = conv2.items.find((x) => x.id === c.id);
  assert.equal(fromC.unread, 1);
  assert.equal(fromC.friend, false);
});

dbtest('codes promo : une fois par joueur, nombre d\'utilisations limité', async () => {
  const a = await user(0), b = await user(0);
  await fun.createPromo({ code: 'bienvenue', bits: 100, packs: 1, maxUses: 1 });
  const r = await fun.redeem(a.id, 'BIENVENUE');
  assert.deepEqual(r, { bits: 100, packs: 1 });
  await assert.rejects(fun.redeem(a.id, 'bienvenue'), /maximum|déjà/);
  await assert.rejects(fun.redeem(b.id, 'bienvenue'), /maximum/);
  await assert.rejects(fun.redeem(b.id, 'nope'), /invalide/);
});

dbtest('plus ou moins : bonne réponse = série + bits plafonnés', async () => {
  const u = await user(0);
  const r = await fun.higherLower(u.id);
  const st = (await reload(u)).fun.hl;
  const right = st.a < st.b ? 'a' : 'b';
  assert.ok(r.a.domain && r.b.domain);
  const ans = await fun.higherLowerAnswer(u.id, right);
  assert.equal(ans.ok, true);
  assert.equal(ans.streak, 1);
  assert.equal(ans.bits, 5);
  assert.ok(ans.next.a.domain);
});

dbtest('niveaux : récompenses cumulées une seule fois', async () => {
  const u = await user(0);
  await db.run(`UPDATE users SET stats = '{"packs": 100}' WHERE id = $1`, [u.id]);
  const lvl = progression(await reload(u)).level;
  assert.ok(lvl > 1);
  const r = await fun.claimLevel(u.id);
  assert.equal(r.level, lvl);
  await assert.rejects(fun.claimLevel(u.id), /Aucune/);
});

dbtest('enchère : alerte liste de souhaits et historique acheteur/vendeur', async () => {
  const s = await user(0), b = await user(5000);
  const c = await db.one('INSERT INTO cards (user_id, site_id, obtained_at) VALUES ($1, 3000, 0) RETURNING id', [s.id]);
  await fun.toggle('wishlist', b.id, 3000, true);
  const a = await game.createAuction(s, { cardId: c.id, startPrice: 10, buyout: 50, hours: 1 });
  const notif = await db.one('SELECT text FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [b.id]);
  assert.match(notif.text, /liste de souhaits/);
  await game.bid(b, a.id, 0, true);
  const h = await fun.history(b.id);
  assert.equal(h.items[0].sold, false);
  assert.equal((await fun.history(s.id)).items[0].sold, true);
  assert.equal((await reload(b)).stats.bought, 1);
});

dbtest('bots : acceptent les amis humains, jugent les échanges au prix du marché, proposent des échanges', async () => {
  const { serveHumans } = await import('../lib/bots.js');
  const persona = { type: 'regular', tz: 12 - new Date().getUTCHours(), sleep: [23, 6], greed: 1, eye: 2, fav: null };
  const mk = async (name, bits) => db.one(`INSERT INTO users (username, pass_hash, created_at, bits, pack_stock, pack_anchor, is_bot, bot, bot_next_at)
    VALUES ($1, 'x', 0, $2, 0, 0, true, $3, $4) RETURNING *`, [name, bits, JSON.stringify(persona), Date.now() + 3600e3]);
  const bot = await mk('botA' + n, 1000);
  const h = await user(0);
  await game.requestFriend(h, bot.username);
  await db.run('UPDATE friends SET created_at = $1 WHERE user_id = $2', [Date.now() - 3600e3, h.id]);
  const r1 = await serveHumans(db, game);
  assert.ok(r1.friends >= 1);
  assert.equal(await game.relation(db, h.id, bot.id), 'friends');

  // Échange déséquilibré (on lui demande une Épique contre une Commune) : refusé, avec un message.
  const ep = await db.one('INSERT INTO cards (user_id, site_id, obtained_at) VALUES ($1, $2, 0) RETURNING id', [bot.id, game.tiers[3].lo]);
  const co = await db.one('INSERT INTO cards (user_id, site_id, obtained_at) VALUES ($1, $2, 0) RETURNING id', [h.id, game.tiers[0].lo + 7]);
  const t1 = await game.createTrade(h, { toUserId: bot.id, offerCards: [co.id], requestCards: [ep.id] });
  await db.run('UPDATE trades SET created_at = $1 WHERE id = $2', [Date.now() - 3600e3, t1.id]);
  await serveHumans(db, game);
  assert.equal((await db.one('SELECT status FROM trades WHERE id = $1', [t1.id])).status, 'declined');
  assert.match((await db.one('SELECT text FROM messages WHERE from_id = $1 ORDER BY id DESC LIMIT 1', [bot.id])).text, /bits/);

  // Échange généreux (une carte offerte contre rien) : accepté.
  const t2 = await game.createTrade(h, { toUserId: bot.id, offerCards: [co.id] });
  await db.run('UPDATE trades SET created_at = $1 WHERE id = $2', [Date.now() - 3600e3, t2.id]);
  await serveHumans(db, game);
  assert.equal((await db.one('SELECT status FROM trades WHERE id = $1', [t2.id])).status, 'accepted');

  // Proposition du bot : un doublon de l'humain contre une carte que l'humain n'a pas.
  await db.run('UPDATE users SET last_seen = $1 WHERE id = $2', [Date.now(), h.id]);
  await db.run('UPDATE trades SET created_at = 0 WHERE from_id = $1 OR to_id = $1', [bot.id]);
  await db.run(`UPDATE trades SET status = 'cancelled' WHERE to_id = $1 AND status = 'pending'`, [h.id]);
  await db.run('INSERT INTO cards (user_id, site_id, obtained_at) SELECT $1, $2, 0 FROM generate_series(1, 2)', [h.id, game.tiers[1].lo + 3]);
  await db.run('INSERT INTO cards (user_id, site_id, obtained_at) VALUES ($1, $2, 0)', [bot.id, game.tiers[1].lo + 4]);
  const r3 = await serveHumans(db, game);
  assert.equal(r3.proposals, 1);
  const prop = await db.one(`SELECT * FROM trades WHERE from_id = $1 AND to_id = $2 AND status = 'pending'`, [bot.id, h.id]);
  assert.ok(prop);
});
