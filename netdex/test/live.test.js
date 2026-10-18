// Saison, boss de la semaine, loterie, collections, événements surprises.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, migrate } from '../lib/db.js';
import { importSites } from '../lib/sites.js';
import { createGame, weekId } from '../lib/game.js';
import { createShops } from '../lib/shops.js';
import { createLive, tierReward, TIER_XP, TICKET_PRICE } from '../lib/live.js';

const URL = process.env.TEST_DATABASE_URL ? process.env.TEST_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, '/netdex_live$1') : null;
let db, game, live, n = 0;
before(async () => {
  if (!URL) return;
  const admin = createDb(process.env.TEST_DATABASE_URL);
  await admin.query('DROP DATABASE IF EXISTS netdex_live').catch(() => {});
  await admin.query('CREATE DATABASE netdex_live');
  await admin.close();
  db = createDb(URL);
  await migrate(db);
  const lines = [];
  for (let i = 1; i <= 200_000; i++) lines.push(`${i},site${i}.com`);
  await importSites(db, lines.join('\n'));
  game = await createGame(db);
  live = createLive(db, game, createShops(db, game));
});
after(() => db?.close());
const user = async (bits = 0, packs = 5) => {
  const now = Date.now();
  return db.one('INSERT INTO users (username, pass_hash, created_at, bits, pack_stock, pack_anchor) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', ['l' + ++n, 'x', now, bits, packs, now]);
};
const bits = async (u) => (await db.one('SELECT bits FROM users WHERE id = $1', [u.id])).bits;
const dbtest = (name, fn) => test(name, { skip: !URL && 'TEST_DATABASE_URL absent' }, fn);

test('saison : récompenses des paliers', () => {
  assert.equal(tierReward(30).booster, 'jackpot');
  assert.equal(tierReward(10).booster, 'epique');
  assert.equal(tierReward(5).count, 2);
  assert.ok(tierReward(7).bits > 0);
});

dbtest('saison : l\'XP vient de ce qu\'on fait depuis le début de saison, paliers récupérés une fois', async () => {
  const u = await user(0, 10);
  await live.season(u.id); // point de départ
  await assert.rejects(live.claimSeason(u.id), /Aucun palier/);
  // 40 boosters ouverts = 400 XP = 2 paliers (150 XP chacun).
  await db.run(`UPDATE users SET stats = COALESCE(stats, '{}'::jsonb) || '{"packs": 40}'::jsonb WHERE id = $1`, [u.id]);
  const s = await live.season(u.id);
  assert.equal(s.xp, 400);
  assert.equal(s.tier, Math.floor(400 / TIER_XP));
  const r = await live.claimSeason(u.id);
  assert.deepEqual([r.from, r.to], [1, 2]);
  assert.equal(await bits(u), tierReward(1).bits + tierReward(2).bits);
  await assert.rejects(live.claimSeason(u.id), /Aucun palier/);
});

dbtest('boss : les boosters lui infligent des dégâts, butin à sa chute selon le classement', async () => {
  const a = await user(0, 10), b = await user(0, 10), c = await user(0, 10);
  const before = (await live.boss(a.id)).dealt;
  await game.openPack(a.id, 'free');
  const after = await live.boss(a.id);
  assert.ok(after.dealt > before);
  assert.ok(after.mine.dmg >= 5); // 5 cartes, au moins 1 dégât chacune
  await assert.rejects(live.claimBoss(a.id), /encore debout/);
  // Le boss tombe : a est premier, c n'a presque rien fait.
  const wk = weekId();
  await db.run('UPDATE boss_hits SET dmg = $3 WHERE week = $1 AND user_id = $2', [wk, a.id, after.hp]);
  await db.run('INSERT INTO boss_hits (week, user_id, dmg) VALUES ($1, $2, 500), ($1, $3, 10)', [wk, b.id, c.id]);
  const r = await live.claimBoss(a.id);
  assert.equal(r.rank, 1);
  assert.equal(r.booster, 'jackpot');
  await assert.rejects(live.claimBoss(a.id), /déjà/);
  assert.equal((await live.claimBoss(b.id)).rank, 2);
  await assert.rejects(live.claimBoss(c.id), /au moins/);
  const packs = await db.one("SELECT COUNT(*) n FROM sealed_packs WHERE owner_id = $1 AND label = 'Booster Jackpot'", [a.id]);
  assert.equal(Number(packs.n), 1);
});

dbtest('loterie : tickets, jackpot, tirage pondéré, report sans ticket', async () => {
  const a = await user(1000), b = await user(1000);
  await assert.rejects(live.buyTickets(a.id, 51), /Entre 1 et 50/);
  await live.buyTickets(a.id, 10);
  await live.buyTickets(b.id, 30);
  assert.equal(await bits(a), 1000 - 10 * TICKET_PRICE);
  const st = await live.lottery(a.id);
  assert.equal(st.tickets, 40);
  assert.equal(st.mine, 10);
  assert.equal(st.jackpot, 500 + Math.floor(40 * TICKET_PRICE * 0.8));
  // On fait comme si ces tickets dataient d'hier : le tirage a lieu.
  const today = Math.floor(Date.now() / 86400e3);
  await db.run('UPDATE lottery_tickets SET day = $1 WHERE day = $2', [today - 1, today]);
  await db.run("INSERT INTO meta (key, value) VALUES ('lottery_drawn', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [String(today - 2)]);
  const r = await live.drawLottery();
  assert.equal(r.jackpot, st.jackpot);
  const won = (await bits(a)) + (await bits(b)) - (1000 - 200) - (1000 - 600);
  assert.equal(won, st.jackpot); // un seul gagnant, tout le jackpot
  assert.equal(await live.drawLottery(), null); // pas deux fois
  // Jour sans ticket : jackpot reporté.
  await db.run("UPDATE meta SET value = $1 WHERE key = 'lottery_drawn'", [String(today - 2)]);
  await db.run('DELETE FROM lottery_tickets');
  await live.drawLottery();
  assert.equal((await live.lottery(a.id)).jackpot, 500 + 500);
});

dbtest('collections : paliers par famille, récupérés une seule fois', async () => {
  const u = await user();
  const fam = (await db.one("SELECT family FROM sites WHERE family IS NOT NULL AND family != '' GROUP BY family HAVING COUNT(*) >= 20 LIMIT 1"))?.family;
  if (!fam) return; // pas de familles dans le jeu de test
  const ids = (await db.all('SELECT id FROM sites WHERE family = $1 ORDER BY id LIMIT 16', [fam])).map((r) => r.id);
  await db.run('INSERT INTO cards (user_id, site_id, obtained_at) SELECT $1, x, 0 FROM unnest($2::int[]) x', [u.id, ids]);
  const s = (await live.sets(u.id)).items.find((i) => i.family === fam);
  assert.deepEqual([s.n, s.reached, s.claimed], [16, 2, 0]);
  const r = await live.claimSet(u.id, fam);
  assert.equal(r.bits, 50 + 150);
  await assert.rejects(live.claimSet(u.id, fam), /Rien/);
});

dbtest('événements surprises : jamais par-dessus un événement en cours, coupés par l\'admin', async () => {
  await db.run("INSERT INTO meta (key, value) VALUES ('auto_events', 'false') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value");
  for (let i = 0; i < 2000; i++) assert.equal(await live.maybeSurprise(), null);
  await db.run("UPDATE meta SET value = 'true' WHERE key = 'auto_events'");
  let started = null;
  for (let i = 0; i < 5000 && !started; i++) started = await live.maybeSurprise();
  assert.ok(started, 'un événement finit par démarrer');
  assert.equal(await live.maybeSurprise(), null); // déjà un événement en cours
});
