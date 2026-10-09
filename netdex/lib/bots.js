// Joueurs automatiques : 10 000 bots à règles (pas d'IA générative), chacun avec sa personnalité,
// ses horaires, sa façon d'estimer les cartes et ses envies. Ils jouent avec les mêmes règles que les humains.
//
// Pas de processus permanent sur Vercel : les bots « dus » sont traités par petits lots à chaque visite
// d'un joueur (et une fois par jour par la tâche planifiée). Un bot en retard rattrape le temps écoulé
// comme un humain qui revient : il ouvre les boosters accumulés, répond aux échanges, etc.
import { randomInt } from 'node:crypto';
import { RARITIES } from './sites.js';
import { CONFIG, GameError } from './game.js';

const rnd = () => randomInt(1_000_000) / 1_000_000;
const pick = (arr) => arr[randomInt(arr.length)];
const between = (a, b) => a + rnd() * (b - a);
const MIN = 60_000;
const HOUR = 60 * MIN;

// ---------- Pseudos crédibles ----------
const FIRST = ['lucas', 'emma', 'hugo', 'lea', 'louis', 'chloe', 'nathan', 'ines', 'enzo', 'jade', 'theo', 'manon', 'tom', 'camille', 'noah', 'sarah', 'leo', 'lina', 'mathis', 'zoe',
  'adam', 'lola', 'gabriel', 'julia', 'arthur', 'louise', 'raphael', 'alice', 'paul', 'eva', 'maxime', 'clara', 'axel', 'romane', 'yanis', 'anais', 'ethan', 'mael', 'nina', 'kylian',
  'sacha', 'margaux', 'evan', 'lucie', 'killian', 'oceane', 'rayan', 'elise', 'quentin', 'marion', 'kevin', 'julie', 'thomas', 'laura', 'antoine', 'pauline', 'alex', 'sam', 'mehdi', 'yasmine',
  'karim', 'amine', 'sofiane', 'nora', 'bilal', 'salome', 'diego', 'lisa', 'mateo', 'elena', 'jonas', 'mila', 'luca', 'aya', 'victor', 'agathe', 'baptiste', 'celia', 'dylan', 'eden',
  'florian', 'gaelle', 'hamza', 'iris', 'jules', 'kenza', 'loic', 'maya', 'nolan', 'olivia', 'pierre', 'rose', 'simon', 'tess', 'ugo', 'vanessa', 'william', 'yara', 'zack', 'max',
  'jake', 'emily', 'ryan', 'sophie', 'liam', 'mia', 'oscar', 'ava', 'finn', 'luna', 'kai', 'ella', 'marco', 'giulia', 'pablo', 'carla', 'jan', 'anna', 'erik', 'sara'];
const WORDS = ['pixel', 'byte', 'neo', 'shadow', 'ghost', 'nova', 'crypto', 'turbo', 'lunar', 'echo', 'zen', 'storm', 'blaze', 'frost', 'void', 'astro', 'cyber', 'retro', 'glitch', 'onyx',
  'wolf', 'fox', 'raven', 'tiger', 'panda', 'koala', 'dragon', 'phoenix', 'falcon', 'shark', 'lynx', 'otter', 'mango', 'kiwi', 'cookie', 'noodle', 'taco', 'waffle', 'pepper', 'mochi',
  'king', 'queen', 'lord', 'chief', 'boss', 'ninja', 'samurai', 'pirate', 'wizard', 'hunter', 'rider', 'pilot', 'nomad', 'ranger', 'rookie', 'legend', 'master', 'player', 'gamer', 'surfer',
  'web', 'net', 'link', 'domain', 'click', 'server', 'cache', 'cookie', 'proxy', 'tab', 'url', 'dns', 'ping', 'node', 'root', 'loot', 'deck', 'card', 'pack'];
const cap = (w) => w[0].toUpperCase() + w.slice(1);

function makeName() {
  const f = pick(FIRST), w = pick(WORDS), w2 = pick(WORDS);
  const n2 = String(randomInt(100)).padStart(2, '0'), n4 = String(1990 + randomInt(20));
  const forms = [
    () => f + n2, () => f + '_' + n2, () => f + n4, () => f + '.' + pick('abcdefghijklmnoprstv'), () => cap(f) + cap(w),
    () => cap(w) + cap(w2), () => 'x' + cap(f) + 'x', () => w + '_' + f, () => f + w, () => cap(w) + n2,
    () => 'the' + cap(w), () => f + '-' + w, () => w + randomInt(1000), () => cap(f) + '_off', () => 'its' + cap(f),
    () => f.slice(0, 3) + w + n2, () => cap(w) + 'Fr', () => f + f.slice(-1).repeat(2), () => 'mr' + cap(w), () => cap(f) + n4.slice(2),
  ];
  return pick(forms)().slice(0, 20);
}

// ---------- Personnalités ----------
const TYPES = [
  // every : minutes entre deux sessions ; packs : part des boosters ouverts ; market/social : propension
  { type: 'casual', p: 0.5, every: [180, 600], packs: 0.5, market: 0.08, social: 0.05, cap: 18 },
  { type: 'regular', p: 0.28, every: [70, 200], packs: 0.8, market: 0.2, social: 0.1, cap: 24 },
  { type: 'grinder', p: 0.08, every: [25, 60], packs: 1, market: 0.25, social: 0.06, cap: 30 },
  { type: 'collector', p: 0.09, every: [60, 160], packs: 0.9, market: 0.35, social: 0.15, cap: 30 },
  { type: 'trader', p: 0.05, every: [40, 120], packs: 0.7, market: 0.7, social: 0.25, cap: 26 },
];
const FAMILIES = ['Commerce', 'Organisation', 'Réseau', 'Tech', 'Média', 'Gaming', 'Pays FR', 'Pays DE', 'Pays BR', 'Pays JP', 'État', 'Savoir', 'Startup'];

function makePersona() {
  let x = rnd(), t = TYPES[0];
  for (const ty of TYPES) { if ((x -= ty.p) < 0) { t = ty; break; } }
  // Majorité de fuseaux européens, une partie Amériques / Afrique / Asie.
  const tz = pick([1, 1, 1, 1, 2, 2, 0, 0, 1, -5, -4, -3, 3, 8, 9, -8]);
  const sleepStart = 22 + randomInt(4); // 22h à 1h
  return {
    type: t.type, tz, sleep: [sleepStart % 24, (sleepStart + 6 + randomInt(3)) % 24],
    every: t.every, greed: +between(0.85, 1.35).toFixed(2), eye: +between(1.4, 3.2).toFixed(2),
    fav: rnd() < 0.6 ? pick(FAMILIES) : null, packs: t.packs, market: t.market, social: t.social, cap: t.cap,
  };
}

function asleep(p, now) {
  const h = (new Date(now).getUTCHours() + p.tz + 24) % 24;
  const [s, e] = p.sleep;
  return s < e ? h >= s && h < e : h >= s || h < e;
}
function nextSession(p, now) {
  return now + Math.round(between(p.every[0], p.every[1]) * MIN);
}

// ---------- Estimation d'une carte par un bot ----------
// Chaque bot a son « œil » (eye) : combien de bits il estime qu'une carte vaut par rapport à sa valeur de recyclage.
function valuation(p, card, owns) {
  const base = RARITIES[card.rarity].value * (card.holo ? CONFIG.holoMultiplier : 1);
  let v = base * p.eye;
  if (!owns) v *= 1.35;                         // il ne l'a pas : il la veut davantage
  if (p.fav && card.family === p.fav) v *= 1.4; // sa famille préférée
  if (card.rarity >= 3) v *= 1.5;               // les grosses cartes font rêver
  return Math.max(1, Math.round(v));
}

// ---------- Création des bots ----------
export async function seedBots(db, game, count = 10_000) {
  count = Math.max(1, Math.min(20_000, Math.floor(count)));
  const taken = new Set((await db.all('SELECT lower(username) u FROM users')).map((r) => r.u));
  const now = Date.now();
  const users = [];
  while (users.length < count) {
    const name = makeName();
    if (name.length < 3 || taken.has(name.toLowerCase()) || !/^[A-Za-z0-9_.-]{3,20}$/.test(name)) continue;
    taken.add(name.toLowerCase());
    const p = makePersona();
    const ageDays = between(1, 30);
    const createdAt = Math.round(now - ageDays * 24 * HOUR);
    // Historique crédible : nombre de boosters déjà ouverts selon l'ancienneté et l'assiduité.
    const perDay = { casual: 2, regular: 5, grinder: 12, collector: 8, trader: 5 }[p.type];
    const packs = Math.max(1, Math.round(ageDays * perDay * between(0.4, 1.2)));
    users.push({ name, p, createdAt, packs });
  }
  const ids = [];
  const BATCH = 2000;
  for (let i = 0; i < users.length; i += BATCH) {
    const chunk = users.slice(i, i + BATCH);
    const stats = chunk.map((u) => simulateHistory(game, u.packs));
    const rows = await db.all(`INSERT INTO users (username, pass_hash, created_at, bits, pack_stock, pack_anchor, packs_opened, dex_score, dex_count, last_seen, is_bot, bot, bot_next_at)
      SELECT u, '!', c, b, s, a, po, ds, dc, ls, true, bp, nx
      FROM unnest($1::text[], $2::bigint[], $3::int[], $4::int[], $5::bigint[], $6::int[], $7::int[], $8::int[], $9::bigint[], $10::jsonb[], $11::bigint[])
        AS x(u, c, b, s, a, po, ds, dc, ls, bp, nx) RETURNING id`, [
      chunk.map((u) => u.name), chunk.map((u) => u.createdAt), chunk.map(() => randomInt(40, 1500)), chunk.map(() => randomInt(0, 4)),
      chunk.map(() => now - randomInt(0, 3) * CONFIG.packInterval), chunk.map((u) => u.packs), stats.map((s) => s.score), stats.map((s) => s.count),
      chunk.map(() => now - randomInt(0, 48) * HOUR), chunk.map((u) => JSON.stringify(u.p)), chunk.map(() => now + randomInt(0, 6 * 60) * MIN),
    ]);
    // Collection actuelle : ce qu'ils ont gardé (les grosses cartes + une poignée de communes).
    const cu = [], cs = [], ch = [];
    rows.forEach((r, k) => {
      for (const c of keptCards(game, stats[k], users[i + k].p.cap)) { cu.push(r.id); cs.push(c.siteId); ch.push(c.holo); }
    });
    for (let j = 0; j < cu.length; j += 20_000) {
      await db.run(`INSERT INTO cards (user_id, site_id, holo, obtained_at) SELECT u, s, h, $4 FROM unnest($1::int[], $2::int[], $3::smallint[]) AS x(u, s, h)`,
        [cu.slice(j, j + 20_000), cs.slice(j, j + 20_000), ch.slice(j, j + 20_000), now - randomInt(1, 72) * HOUR]);
    }
    ids.push(...rows.map((r) => r.id));
  }
  await db.run(`UPDATE users u SET avatar_site = c.site_id FROM (SELECT DISTINCT ON (user_id) user_id, site_id FROM cards WHERE user_id = ANY($1::int[]) ORDER BY user_id, site_id) c
    WHERE u.id = c.user_id`, [ids]);
  // Réseau d'amis entre bots (1 à 4 chacun) pour que les échanges circulent.
  const a = [], b = [];
  for (const id of ids) for (let k = randomInt(1, 5); k > 0; k--) { const o = pick(ids); if (o !== id) { a.push(id, o); b.push(o, id); } }
  for (let j = 0; j < a.length; j += 20_000) {
    await db.run(`INSERT INTO friends (user_id, friend_id, status, created_at) SELECT x, y, 'accepted', $3 FROM unnest($1::int[], $2::int[]) AS t(x, y) ON CONFLICT DO NOTHING`,
      [a.slice(j, j + 20_000), b.slice(j, j + 20_000), now]);
  }
  return { created: ids.length };
}

// Approximation statistique de « n boosters ouverts » : cartes par rareté, sites distincts, score.
function simulateHistory(game, packs) {
  const cards = packs * CONFIG.packSize;
  const total = RARITIES.reduce((s, r) => s + r.weight, 0);
  let score = 0, count = 0;
  const got = game.tiers.map((t) => {
    const expected = (cards * t.weight) / total;
    const n = poisson(expected);
    const distinct = Math.min(n, Math.round(t.total * (1 - Math.exp(-n / Math.max(1, t.total)))));
    score += distinct * t.value;
    count += distinct;
    return n;
  });
  return { got, score, count };
}
function poisson(l) {
  if (l > 50) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss()));
  let k = 0, p = 1;
  const L = Math.exp(-l);
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}
function gauss() { return Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd()); }

function keptCards(game, stats, capN) {
  const out = [];
  const t = game.tiers;
  const randSite = (tier) => tier.lo + randomInt(tier.hi - tier.lo + 1);
  for (let r = 5; r >= 2; r--) for (let k = Math.min(stats.got[r], r >= 3 ? 3 : 6); k > 0 && out.length < capN; k--) out.push({ siteId: randSite(t[r]), holo: rnd() < 0.01 ? 1 : 0 });
  const rest = Math.max(0, Math.min(capN - out.length, randomInt(4, 14)));
  for (let k = 0; k < rest; k++) out.push({ siteId: randSite(rnd() < 0.3 ? t[1] : t[0]), holo: rnd() < 0.01 ? 1 : 0 });
  return out;
}

// ---------- Une session de jeu d'un bot ----------
async function session(db, game, bot, opts) {
  const p = bot.bot;
  const now = Date.now();
  const me = { id: bot.id, username: bot.username };
  const log = [];
  const tryDo = async (label, fn) => { try { const r = await fn(); if (r !== undefined) log.push(label); return r; } catch (e) { if (!(e instanceof GameError)) throw e; return undefined; } };

  if (asleep(p, now)) {
    // Il dort : il reviendra au réveil (avec un peu de hasard).
    const wake = now + Math.round(between(4, 9) * HOUR);
    await db.run('UPDATE users SET bot_next_at = $1 WHERE id = $2', [wake, bot.id]);
    return ['dort'];
  }

  // 1. Il regarde ses demandes d'amis et ses échanges reçus.
  const reqs = await db.all("SELECT user_id FROM friends WHERE friend_id = $1 AND status = 'pending' LIMIT 5", [bot.id]);
  for (const r of reqs) await tryDo('ami', () => game.respondFriend(me, r.user_id, rnd() < 0.92));
  const trades = await db.all("SELECT id FROM trades WHERE to_id = $1 AND status = 'pending' ORDER BY id LIMIT 5", [bot.id]);
  for (const t of trades) await considerTrade(db, game, bot, me, t.id, tryDo);

  // 2. Bonus quotidien.
  if (game.dailyState(bot, now).available) await tryDo('bonus', () => game.claimDaily(bot.id));

  // 3. Boosters (sauf si la base approche de sa taille max).
  const full = opts.dbFull;
  if (!full) {
    const avail = game.packState(bot, now).available;
    const n = Math.min(avail, Math.max(avail ? 1 : 0, Math.round(avail * p.packs * between(0.6, 1.1))), 10);
    for (let k = 0; k < n; k++) await tryDo('booster', () => game.openPack(bot.id, 'free'));
  }

  // 4. Il range sa collection : doublons recyclés, et il ne garde pas toutes ses communes.
  const { n: count } = await db.one("SELECT COUNT(*) n FROM cards WHERE user_id = $1 AND status = 'owned'", [bot.id]);
  if (count > p.cap) {
    await tryDo('recyclage', () => game.recycleDuplicates(bot.id, 1));
    const extra = await db.all(`SELECT c.id FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.user_id = $1 AND c.status = 'owned' AND c.holo = 0 AND s.rarity <= 1
      ORDER BY s.rarity, c.obtained_at LIMIT GREATEST(0, (SELECT COUNT(*) FROM cards WHERE user_id = $1) - $2)`, [bot.id, p.cap]);
    if (extra.length) await tryDo('recyclage', () => game.recycle(bot.id, extra.map((e) => e.id)));
  }

  // 5. Marché.
  if (rnd() < p.market) await shop(db, game, bot, me, p, tryDo);
  if (!full && rnd() < p.market * 0.6) await sell(db, game, bot, me, p, tryDo);

  // 6. Vie sociale.
  if (rnd() < p.social) await socialize(db, game, bot, me, p, tryDo, opts);

  // 7. De temps en temps il change d'avatar pour sa plus belle carte.
  if (rnd() < 0.05) await db.run(`UPDATE users SET avatar_site = (SELECT site_id FROM cards WHERE user_id = $1 ORDER BY site_id LIMIT 1) WHERE id = $1`, [bot.id]);

  await db.run('UPDATE users SET bot_next_at = $1, last_seen = $2 WHERE id = $3', [nextSession(p, now), now, bot.id]);
  return log;
}

async function ownedSites(db, botId, siteIds) {
  if (!siteIds.length) return new Set();
  return new Set((await db.all('SELECT DISTINCT site_id FROM cards WHERE user_id = $1 AND site_id = ANY($2::int[])', [botId, siteIds])).map((r) => r.site_id));
}

async function considerTrade(db, game, bot, me, tradeId, tryDo) {
  const [t] = (await db.all('SELECT * FROM trades WHERE id = $1', [tradeId]));
  if (!t) return;
  const items = await db.all(`SELECT ti.side, c.holo, s.id site_id, s.rarity, s.family FROM trade_items ti JOIN cards c ON c.id = ti.card_id JOIN sites s ON s.id = c.site_id WHERE ti.trade_id = $1`, [t.id]);
  const owns = await ownedSites(db, bot.id, items.filter((i) => i.side === 'offer').map((i) => i.site_id));
  const p = bot.bot;
  const gain = items.filter((i) => i.side === 'offer').reduce((a, i) => a + valuation(p, i, owns.has(i.site_id)), 0) + t.offer_bits;
  // Ce qu'on lui demande : il l'estime comme une carte qu'il possède (donc sans bonus d'envie).
  const loss = items.filter((i) => i.side === 'request').reduce((a, i) => a + valuation(p, i, true), 0) + t.request_bits;
  const accept = gain >= loss * p.greed || (loss === 0 && gain > 0);
  await tryDo(accept ? 'échange accepté' : 'échange refusé', () => game.resolveTrade(me, t.id, accept ? 'accept' : 'decline'));
}

async function shop(db, game, bot, me, p, tryDo) {
  const now = Date.now();
  const list = await db.all(`SELECT a.*, s.rarity, s.family, c.holo, ub.is_bot bidder_is_bot FROM auctions a JOIN sites s ON s.id = a.site_id JOIN cards c ON c.id = a.card_id
    LEFT JOIN users ub ON ub.id = a.bidder_id
    WHERE a.status = 'open' AND a.seller_id != $1 AND a.ends_at > $2 AND (a.bidder_id IS NULL OR a.bidder_id != $1)
    ORDER BY (s.family = $3) DESC, s.rarity DESC, a.ends_at ASC LIMIT 25`, [bot.id, now + 2 * MIN, p.fav || '']);
  const owns = await ownedSites(db, bot.id, list.map((a) => a.site_id));
  let bids = 0;
  for (const a of list) {
    if (bids >= 2) break;
    const v = valuation(p, a, owns.has(a.site_id));
    const min = game.minBid(a);
    if (min > v || min > bot.bits * 0.6) continue;
    // Face à un humain qui mène, il ne surenchérit que rarement et seulement si l'affaire est franchement bonne.
    if (a.bidder_id && !a.bidder_is_bot && !(min * 1.5 <= v && rnd() < 0.3)) continue;
    if (a.buyout && a.buyout <= v * 0.8 && a.buyout <= bot.bits * 0.6 && rnd() < 0.5) {
      if (await tryDo('achat', () => game.bid(me, a.id, 0, true))) { bids++; continue; }
    }
    // Il n'enchérit pas tout de suite au maximum : comme un humain, il monte par paliers.
    const amount = Math.min(v, Math.round(min * between(1, 1.25)));
    if (await tryDo('enchère', () => game.bid(me, a.id, Math.max(min, amount)))) bids++;
  }
}

async function sell(db, game, bot, me, p, tryDo) {
  const { n: open } = await db.one("SELECT COUNT(*) n FROM auctions WHERE seller_id = $1 AND status = 'open'", [bot.id]);
  if (open >= (p.type === 'trader' ? 4 : 1)) return;
  // Un doublon d'au moins Peu commune, ou n'importe quelle carte pour un trader.
  const c = await db.one(`SELECT c.id, c.holo, s.rarity, s.family FROM cards c JOIN sites s ON s.id = c.site_id
    WHERE c.user_id = $1 AND c.status = 'owned' AND s.rarity >= 1
      AND ((SELECT COUNT(*) FROM cards d WHERE d.user_id = $1 AND d.site_id = c.site_id) > 1 OR $2)
    ORDER BY random() LIMIT 1`, [bot.id, p.type === 'trader']);
  if (!c) return;
  const price = Math.max(2, Math.round(valuation(p, c, true) * between(0.7, 1.3)));
  const buyout = rnd() < 0.6 ? Math.round(price * between(1.6, 2.6)) : null;
  await tryDo('vente', () => game.createAuction(me, { cardId: c.id, startPrice: price, buyout, hours: pick([6, 24, 24, 72]) }));
}

async function socialize(db, game, bot, me, p, tryDo, opts) {
  const now = Date.now();
  if (rnd() < 0.7) {
    // Il propose un échange à un ami : un de ses doublons contre une carte qu'il n'a pas, de valeur proche.
    const friend = await db.one(`SELECT u.id, u.is_bot FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.status = 'accepted' ORDER BY random() LIMIT 1`, [bot.id]);
    if (!friend) return;
    if (!friend.is_bot) {
      // Pas plus d'une proposition de bot toutes les 12 h pour un même humain.
      const recent = await db.one(`SELECT 1 FROM trades t JOIN users u ON u.id = t.from_id WHERE t.to_id = $1 AND u.is_bot AND t.created_at > $2 LIMIT 1`, [friend.id, now - 12 * HOUR]);
      if (recent) return;
    }
    // Un doublon de préférence ; sinon (4 fois sur 10) n'importe quelle carte dont il veut bien se séparer.
    const mine = await db.one(`SELECT c.id, c.holo, s.rarity, s.family, s.id site_id FROM cards c JOIN sites s ON s.id = c.site_id
      WHERE c.user_id = $1 AND c.status = 'owned' AND s.rarity <= 3
        AND ((SELECT COUNT(*) FROM cards d WHERE d.user_id = $1 AND d.site_id = c.site_id) > 1 OR $2)
      ORDER BY random() LIMIT 1`, [bot.id, rnd() < 0.4]);
    if (!mine) return;
    const theirs = await db.one(`SELECT c.id, c.holo, s.rarity, s.family, s.id site_id FROM cards c JOIN sites s ON s.id = c.site_id
      WHERE c.user_id = $1 AND c.status = 'owned' AND s.rarity BETWEEN $2 AND $3
        AND NOT EXISTS (SELECT 1 FROM cards o WHERE o.user_id = $4 AND o.site_id = c.site_id) ORDER BY random() LIMIT 1`,
    [friend.id, Math.max(0, mine.rarity - 1), mine.rarity, bot.id]);
    if (!theirs) return;
    const gap = valuation(p, theirs, false) - valuation(p, mine, true);
    const bits = gap > 0 ? Math.min(Math.round(gap * between(0.3, 0.8)), Math.floor(bot.bits * 0.3)) : 0;
    await tryDo('proposition', () => game.createTrade(me, { toUserId: friend.id, offerCards: [mine.id], requestCards: [theirs.id], offerBits: bits }));
  } else {
    // Nouvelle rencontre : le plus souvent un autre bot, parfois un humain actif récemment (avec retenue).
    const human = rnd() < 0.15 && !opts.noHumans;
    let target;
    if (human) {
      target = await db.one(`SELECT u.username FROM users u WHERE NOT u.is_bot AND u.last_seen > $1
        AND NOT EXISTS (SELECT 1 FROM friends f WHERE (f.user_id = $2 AND f.friend_id = u.id) OR (f.user_id = u.id AND f.friend_id = $2))
        AND NOT EXISTS (SELECT 1 FROM friends f JOIN users b ON b.id = f.user_id WHERE f.friend_id = u.id AND b.is_bot AND f.created_at > $3)
        ORDER BY random() LIMIT 1`, [now - 3 * 24 * HOUR, bot.id, now - 24 * HOUR]);
    } else {
      target = await db.one('SELECT username FROM users WHERE is_bot AND id != $1 OFFSET floor(random() * 500) LIMIT 1', [bot.id]);
    }
    if (target) await tryDo('demande d\'ami', () => game.requestFriend(me, target.username));
  }
}

// ---------- Ordonnanceur ----------
let lastLocalTick = 0;
let sizeCache = { at: 0, mb: 0 };

export async function botStatus(db) {
  const [row, paused, last] = await Promise.all([
    db.one(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE bot_next_at <= $1) due, COUNT(*) FILTER (WHERE last_seen > $2) active FROM users WHERE is_bot`, [Date.now(), Date.now() - HOUR]),
    db.one("SELECT value FROM meta WHERE key = 'bots_paused'"),
    db.one("SELECT value FROM meta WHERE key = 'bots_tick'"),
  ]);
  return { ...row, paused: paused?.value === '1', lastTick: last ? Number(last.value) : null, dbMb: await dbSizeMb(db, true) };
}

async function dbSizeMb(db, fresh = false) {
  if (fresh || Date.now() - sizeCache.at > 5 * MIN) {
    const { b } = await db.one('SELECT pg_database_size(current_database()) b');
    sizeCache = { at: Date.now(), mb: Math.round(b / 1048576) };
  }
  return sizeCache.mb;
}

// Traite les bots en attente pendant au plus budgetMs. throttle : intervalle minimum global entre deux passages.
export async function runBots(db, game, { budgetMs = 8000, batch = 25, throttleMs = 15_000, force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastLocalTick < throttleMs) return null;
  lastLocalTick = now;
  if ((await db.one("SELECT value FROM meta WHERE key = 'bots_paused'"))?.value === '1') return null;
  // Verrou global léger : une seule instance prend la main toutes les throttleMs.
  const lock = await db.one(`INSERT INTO meta (key, value) VALUES ('bots_tick', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    WHERE meta.value::bigint < $2 RETURNING value`, [String(now), String(now - throttleMs)]);
  if (!lock && !force) return null;
  const maxMb = Number(process.env.BOT_DB_MAX_MB) || 90;
  const opts = { dbFull: (await dbSizeMb(db)) >= maxMb };
  const done = { sessions: 0, actions: 0, dbFull: opts.dbFull };
  const deadline = now + budgetMs;
  if (rnd() < 0.05 || force) await cleanup(db);
  while (Date.now() < deadline) {
    // Réserve un lot de bots dus (SKIP LOCKED : plusieurs instances peuvent travailler sans se gêner).
    const bots = await db.all(`UPDATE users SET bot_next_at = $1 WHERE id IN (
        SELECT id FROM users WHERE is_bot AND bot_next_at <= $2 ORDER BY bot_next_at LIMIT $3 FOR UPDATE SKIP LOCKED) RETURNING *`,
    [Date.now() + 15 * MIN, Date.now(), batch]);
    if (!bots.length) break;
    for (const bot of bots) {
      if (Date.now() >= deadline) break;
      try {
        const log = await session(db, game, bot, opts);
        done.sessions++;
        done.actions += log.length;
      } catch (e) {
        console.error('bot', bot.id, e.message);
      }
    }
  }
  return done;
}

// Ménage régulier pour rester dans le stockage gratuit.
async function cleanup(db) {
  const old = Date.now() - 7 * 24 * HOUR;
  await db.run('DELETE FROM notifications WHERE created_at < $1', [Date.now() - 14 * 24 * HOUR]);
  await db.run("DELETE FROM trades WHERE status != 'pending' AND resolved_at < $1", [old]);
  await db.run("DELETE FROM trades t USING users u WHERE t.status = 'pending' AND t.created_at < $1 AND u.id = t.to_id AND u.is_bot", [Date.now() - 2 * 24 * HOUR]);
  await db.run("DELETE FROM auctions WHERE status != 'open' AND ends_at < $1", [old]);
  await db.run('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);
}

export async function deleteBots(db) {
  // Les cartes en vente par des bots disparaissent avec eux ; on rembourse les humains qui menaient ces enchères.
  await db.tx(async (q) => {
    await q.run(`UPDATE users h SET bits = h.bits + a.current_bid FROM auctions a JOIN users s ON s.id = a.seller_id
      WHERE a.status = 'open' AND s.is_bot AND a.bidder_id = h.id AND NOT h.is_bot`);
    await q.run("UPDATE cards c SET status = 'owned' FROM auctions a JOIN users b ON b.id = a.bidder_id WHERE a.status = 'open' AND b.is_bot AND c.id = a.card_id");
    await q.run('DELETE FROM auctions a USING users u WHERE (u.id = a.seller_id OR u.id = a.bidder_id) AND u.is_bot AND a.status = $1', ['open']);
    await q.run('DELETE FROM users WHERE is_bot');
  });
}
