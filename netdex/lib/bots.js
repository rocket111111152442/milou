// Joueurs automatiques : 10 000 bots à règles (pas d'IA générative), chacun avec sa personnalité,
// ses horaires, sa façon d'estimer les cartes et ses envies. Ils jouent avec les mêmes règles que les humains.
//
// Pas de processus permanent sur Vercel : les bots « dus » sont traités par petits lots à chaque visite
// d'un joueur (et une fois par jour par la tâche planifiée). Un bot en retard rattrape le temps écoulé
// comme un humain qui revient : il ouvre les boosters accumulés, répond aux échanges, etc.
import { randomInt } from 'node:crypto';
import { sitePrices } from './market.js';
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
  { type: 'casual', p: 0.5, every: [120, 420], packs: 0.5, market: 0.3, social: 0.08, cap: 18, stall: 1 },
  { type: 'regular', p: 0.28, every: [45, 150], packs: 0.8, market: 0.5, social: 0.12, cap: 24, stall: 2 },
  { type: 'grinder', p: 0.08, every: [20, 50], packs: 1, market: 0.45, social: 0.08, cap: 30, stall: 2 },
  { type: 'collector', p: 0.09, every: [40, 120], packs: 0.9, market: 0.7, social: 0.18, cap: 30, stall: 3 },
  { type: 'trader', p: 0.05, every: [20, 60], packs: 0.7, market: 0.95, social: 0.3, cap: 26, stall: 6 },
];
const TYPE_BY = Object.fromEntries(TYPES.map((t) => [t.type, t]));
// Les réglages de comportement viennent du type (modifiables sans recréer les bots) ; le reste est propre à chaque bot.
const traits = (p) => ({ ...p, ...TYPE_BY[p.type] && { every: TYPE_BY[p.type].every, market: TYPE_BY[p.type].market, social: TYPE_BY[p.type].social, stall: TYPE_BY[p.type].stall } });
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
    await game.ensureSites(db, cs); // certains sites tirés viennent de la longue traîne
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
    // Historique de départ : pas de Mythique et au plus une Légendaire, pour que les vrais joueurs puissent rattraper les bots.
    const n = t.id === 5 ? 0 : t.id === 4 ? Math.min(1, poisson(expected * 0.5)) : poisson(expected);
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
  const p = traits(bot.bot);
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
  // (les demandes des humains passent par serveHumans)
  const reqs = await db.all("SELECT f.user_id FROM friends f JOIN users u ON u.id = f.user_id AND u.is_bot WHERE f.friend_id = $1 AND f.status = 'pending' LIMIT 5", [bot.id]);
  for (const r of reqs) await tryDo('ami', () => game.respondFriend(me, r.user_id, rnd() < 0.92));
  await answerMessages(db, bot, p, now);
  const trades = await db.all("SELECT t.id FROM trades t JOIN users u ON u.id = t.from_id AND u.is_bot WHERE t.to_id = $1 AND t.status = 'pending' ORDER BY t.id LIMIT 5", [bot.id]);
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

// ---------- Messages privés ----------
// Chaque compte a son style d'écriture (minuscules, émojis, fautes de frappe, ponctuation), tiré de son id,
// et répond selon ce qu'on lui dit et ce qu'il possède vraiment.
const hash32 = (x) => { let h = 2166136261; for (const c of String(x)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export function styleOf(id) {
  const h = hash32('style' + id);
  return { lower: h % 3 !== 0, emoji: (h >> 3) % 4 === 0, typos: (h >> 5) % 3 === 0, dots: (h >> 7) % 4 === 0, noPunct: (h >> 9) % 2 === 0 };
}
const EMO = ['😅', '😂', '👍', '🔥', '😭', '🙏', '😎', '🤝'];
export function stylize(text, st) {
  let t = text;
  if (st.lower) t = t.toLowerCase();
  if (st.noPunct) t = t.replace(/[.!]+$/, '');
  if (st.typos && rnd() < 0.35 && t.length > 6 && !/\w\.\w/.test(t)) { // jamais dans un nom de site
    const i = 1 + randomInt(t.length - 2);
    if (t[i] !== ' ' && t[i + 1] !== ' ') t = t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2);
  }
  if (st.dots && rnd() < 0.5) t = t.replace(/[.!?]*$/, '...');
  if (st.emoji && rnd() < 0.6) t += ' ' + pick(EMO);
  return t;
}
const RARNAMES = ['commune', 'peu commune', 'rare', 'épique', 'légendaire', 'mythique'];
const TOPICS = [
  [/(combien|nombre).*(carte|site)|collection|t'as quoi|tu as quoi/i, (c) => [`${c.dex} sites trouvés, mais j'en garde que ${c.cards}`, `${c.dex} sites trouvés pour l'instant`, `${c.cards} cartes, je recycle beaucoup`]],
  [/\b(salut|slt|yo|coucou|bonjour|bonsoir|hello|hey|cc|wesh|bjr)\b/i, (c) => [`${pick(['salut', 'yo', 'coucou', 'hey', 'wesh'])} ${pick(['', 'ça va ?', 'quoi de neuf ?', 'tu joues depuis longtemps ?', ''])}`.trim()]],
  [/(^|[^a-zà-ÿ])(ça va|ca va|cv|la forme|tu vas bien)/i, (c) => [
    pick(['ça va et toi ?', 'tranquille et toi', 'bien bien', 'ouais ça va, un peu crevé', 'ça va, je farm des boosters là']),
    c.recent ? `ça va, je viens de choper ${c.recent.domain} en ${RARNAMES[c.recent.rarity]}` : 'ça va, rien de fou dans mes derniers boosters']],
  [/(échange|echange|trade|troc|swap)/i, (c) => [
    pick(['envoie une proposition je regarde', 'fais une offre, si c\'est au prix du marché ça passe', 'ça dépend de ce que tu proposes', 'propose, je regarde quand je peux']),
    c.fav ? `je cherche surtout des sites ${c.fav.toLowerCase()} si t'en as` : 'je cherche des rares surtout']],
  [/(vend|achète|achete|prix|combien|cote|bits|marché|marche)/i, (c) => [
    pick(['regarde au marché, j\'ai mis des trucs en vente', 'je vends jamais en dessous de la cote', 'je garde mes bits pour les enchères', 'les prix ont monté je trouve']),
    `j'ai ${c.bits} bits là, pas énorme`]],
  [/(mythique|légendaire|legendaire|holo|épique|epique)/i, (c) => [
    c.best && c.best.rarity >= 4 ? `ma meilleure c'est ${c.best.domain}, ${RARNAMES[c.best.rarity]}` : pick(['jamais eu de légendaire moi', 'j\'en rêve', 'gg si t\'en as une', 'les holo c\'est la vie']),
    c.best ? `ma meilleure carte c'est ${c.best.domain} (${RARNAMES[c.best.rarity]})` : 'j\'ai rien de ouf encore']],
  [/(merci|thx|thanks|mrc)/i, () => [pick(['de rien', 'tkt', 'avec plaisir', 'np'])]],
  [/(bye|a\+|ciao|bonne nuit|à plus|a plus|tchao)/i, () => [pick(['a+', 'bye', 'bonne soirée', 'à plus', 'ciao'])]],
];
const FALLBACK = ['ok', 'mdr', 'ah ouais ?', 'grave', 'je vois', 'ah ok', 'pas faux', 'haha', 'ouais', 'ptdr', 'ah bon ?', 'carrément', 'jsp', 'trop bien'];

async function replyContext(db, bot) {
  const [best, recent, n] = await Promise.all([
    db.one('SELECT s.domain, s.rarity FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.user_id = $1 ORDER BY s.rarity DESC, s.id LIMIT 1', [bot.id]),
    db.one('SELECT s.domain, s.rarity FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.user_id = $1 AND s.rarity >= 2 ORDER BY c.obtained_at DESC LIMIT 1', [bot.id]),
    db.one('SELECT COUNT(*) n FROM cards WHERE user_id = $1', [bot.id]),
  ]);
  return { best, recent, cards: n.n, dex: bot.dex_count, bits: bot.bits, fav: bot.bot?.fav };
}
export async function composeReply(db, bot, text) {
  const ctx = await replyContext(db, bot);
  // On lui parle d'un site précis : il dit s'il l'a.
  const dom = /\b([a-z0-9-]+\.(?:[a-z]{2,}\.)?[a-z]{2,})\b/i.exec(text)?.[1]?.toLowerCase();
  if (dom) {
    const has = await db.one('SELECT 1 FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.user_id = $1 AND s.domain = $2 LIMIT 1', [bot.id, dom]);
    return has ? pick([`oui j'ai ${dom}`, `${dom} je l'ai ouais`, `j'ai ${dom} mais je la garde pour l'instant`]) : pick([`non j'ai pas ${dom}`, `${dom} ? jamais eu`, `pas ${dom} non, tu l'as toi ?`]);
  }
  const hits = TOPICS.filter(([re]) => re.test(text));
  if (!hits.length) return pick(FALLBACK);
  return pick(hits[0][1](ctx)); // le sujet le plus précis d'abord
}
async function answerMessages(db, bot, p, now) {
  const msgs = await db.all('SELECT DISTINCT ON (from_id) from_id, text FROM messages WHERE to_id = $1 AND NOT read ORDER BY from_id, id DESC LIMIT 3', [bot.id]);
  const st = styleOf(bot.id);
  for (const m of msgs) {
    await db.run('UPDATE messages SET read = true WHERE to_id = $1 AND from_id = $2 AND NOT read', [bot.id, m.from_id]);
    if (rnd() < 0.15) continue; // parfois il lit sans répondre
    const last = await db.one('SELECT text FROM messages WHERE from_id = $1 AND to_id = $2 ORDER BY id DESC LIMIT 1', [bot.id, m.from_id]);
    let reply = '';
    for (let k = 0; k < 4 && (!reply || reply === last?.text); k++) reply = stylize(await composeReply(db, bot, m.text), st);
    await db.run('INSERT INTO messages (from_id, to_id, text, at) VALUES ($1, $2, $3, $4)', [bot.id, m.from_id, reply, now]);
  }
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
    if (bids >= 3) break;
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

async function sell(db, game, bot, me, p, tryDo, force = false) {
  const { n: open } = await db.one("SELECT COUNT(*) n FROM auctions WHERE seller_id = $1 AND status = 'open'", [bot.id]);
  if (open >= (p.stall || 1)) return;
  // De préférence un doublon ; sinon une carte qu'il est prêt à lâcher (jamais sa seule Légendaire/Mythique).
  const c = await db.one(`SELECT c.id, c.holo, s.rarity, s.family FROM cards c JOIN sites s ON s.id = c.site_id
    WHERE c.user_id = $1 AND c.status = 'owned'
      AND ((SELECT COUNT(*) FROM cards d WHERE d.user_id = $1 AND d.site_id = c.site_id) > 1 OR ($2 AND s.rarity <= 3))
    ORDER BY (SELECT COUNT(*) FROM cards d WHERE d.user_id = $1 AND d.site_id = c.site_id) DESC, random() LIMIT 1`, [bot.id, force || p.type === 'trader' || rnd() < 0.5]);
  if (!c) return;
  const price = Math.max(1, Math.round(valuation(p, c, true) * between(0.6, 1.25)));
  const buyout = rnd() < 0.65 ? Math.max(price + 1, Math.round(price * between(1.4, 2.4))) : null;
  return tryDo('vente', () => game.createAuction(me, { cardId: c.id, startPrice: price, buyout, hours: pick([1, 3, 3, 6, 6, 12, 24, 24, 72]) }));
}

// Teneur de marché : si l'hôtel des ventes se vide, des bots y mettent des cartes (comme le feraient des joueurs actifs).
async function stockMarket(db, game, target) {
  const { n } = await db.one("SELECT COUNT(*) n FROM auctions WHERE status = 'open'");
  const missing = Math.min(30, target - n);
  if (missing <= 0) return 0;
  const sellers = await db.all('SELECT * FROM users WHERE is_bot ORDER BY random() LIMIT $1', [missing]);
  let listed = 0;
  for (const bot of sellers) {
    const p = traits(bot.bot);
    const ok = await sell(db, game, bot, { id: bot.id, username: bot.username }, { ...p, stall: Math.max(2, p.stall) }, async (_l, fn) => { try { return await fn(); } catch (e) { if (!(e instanceof GameError)) throw e; } }, true);
    if (ok) listed++;
  }
  return listed;
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
    // Rare : un bot n'aborde un humain qu'exceptionnellement (au plus une demande de bot par humain et par semaine).
    const human = rnd() < 0.02 && !opts.noHumans;
    let target;
    if (human) {
      target = await db.one(`SELECT u.username FROM users u WHERE NOT u.is_bot AND u.last_seen > $1
        AND NOT EXISTS (SELECT 1 FROM friends f WHERE (f.user_id = $2 AND f.friend_id = u.id) OR (f.user_id = u.id AND f.friend_id = $2))
        AND NOT EXISTS (SELECT 1 FROM friends f JOIN users b ON b.id = f.user_id WHERE f.friend_id = u.id AND b.is_bot AND f.created_at > $3)
        ORDER BY random() LIMIT 1`, [now - 3 * 24 * HOUR, bot.id, now - 7 * 24 * HOUR]);
    } else {
      target = await db.one('SELECT username FROM users WHERE is_bot AND id != $1 OFFSET floor(random() * 500) LIMIT 1', [bot.id]);
    }
    if (target) await tryDo('demande d\'ami', () => game.requestFriend(me, target.username));
  }
}

// ---------- Guichet des humains ----------
// Un humain qui demande un bot en ami ou lui propose un échange reçoit une réponse en quelques minutes
// (plus longtemps si le bot « dort »), sans attendre la prochaine session du bot. Les bots proposent aussi
// eux-mêmes des échanges équitables à leurs amis humains, au prix du marché.
// Délai de réponse propre à chaque demande : de 2 min à ~3 h (le plus souvent rapide), jamais pendant son sommeil,
// et étalé après son réveil (il ne répond pas à tout à la seconde où il se lève).
function lastWake(p, now) {
  const d = new Date(now);
  const h = (d.getUTCHours() + p.tz + 24) % 24 + d.getUTCMinutes() / 60;
  return now - (((h - p.sleep[1]) + 24) % 24) * HOUR;
}
function ready(p, seed, createdAt, now) {
  if (asleep(p, now)) return false;
  const u = (hash32('delay' + seed) % 10000) / 10000;
  const delay = 2 * MIN * Math.pow(90, u * u) * (p.type === 'casual' ? 1.5 : p.type === 'grinder' ? 0.6 : 1);
  const afterWake = (hash32('wake' + seed) % 45) * MIN;
  return now - createdAt >= delay && now - lastWake(p, now) >= Math.min(afterWake, now - createdAt);
}
const say = (db, from, to, text) => db.run('INSERT INTO messages (from_id, to_id, text, at) VALUES ($1, $2, $3, $4)', [from, to, text, Date.now()]);
const DEAL = ['deal !', 'ok ça marche', 'vendu, merci !', 'parfait, échange fait', 'ça me va 👍'];
const NO_DEAL = (need) => pick([`pas assez pour moi, ajoute ~${need} bits et c'est bon`, `presque ! encore ${need} bits et j'accepte`, `non merci… avec ${need} bits de plus ok`]);

async function cardPrices(db, game, items) {
  const prices = await sitePrices(db, game, items.map((i) => i.site_id));
  return (i) => (prices.get(i.site_id) || 1) * (i.holo ? CONFIG.holoMultiplier : 1);
}

async function judgeHumanTrade(db, game, bot, t) {
  const p = traits(bot.bot);
  const me = { id: bot.id, username: bot.username };
  const items = await db.all(`SELECT ti.side, c.holo, c.user_id, c.status, s.id site_id, s.rarity, s.family FROM trade_items ti
    JOIN cards c ON c.id = ti.card_id JOIN sites s ON s.id = c.site_id WHERE ti.trade_id = $1`, [t.id]);
  const offer = items.filter((i) => i.side === 'offer'), request = items.filter((i) => i.side === 'request');
  if (bot.bits < t.request_bits) {
    await game.resolveTrade(me, t.id, 'decline');
    return say(db, bot.id, t.from_id, `j'ai pas ${t.request_bits} bits, désolé`);
  }
  const price = await cardPrices(db, game, items);
  const owns = await ownedSites(db, bot.id, offer.map((i) => i.site_id));
  // Ce qu'il reçoit : prix du marché, un peu plus s'il ne l'a pas ou si c'est sa famille préférée.
  const gain = offer.reduce((a, i) => a + price(i) * (owns.has(i.site_id) ? 0.8 : 1.15) * (p.fav && i.family === p.fav ? 1.2 : 1), 0) + t.offer_bits;
  // Ce qu'il donne : prix du marché ; il tient davantage à ses Légendaires et Mythiques.
  const loss = request.reduce((a, i) => a + price(i) * (i.rarity >= 4 ? 1.3 : 1), 0) + t.request_bits;
  const greed = Math.min(1.2, Math.max(0.9, p.greed || 1));
  if (gain >= loss * greed) {
    const r = await game.resolveTrade(me, t.id, 'accept').catch((e) => { if (e instanceof GameError) return null; throw e; });
    if (r?.status === 'accepted') await say(db, bot.id, t.from_id, stylize(pick(DEAL), styleOf(bot.id)));
    return r;
  }
  await game.resolveTrade(me, t.id, 'decline');
  return say(db, bot.id, t.from_id, stylize(NO_DEAL(Math.max(1, Math.ceil(loss * greed - gain))), styleOf(bot.id)));
}

async function proposeToHuman(db, game, human) {
  // Un de ses amis bots, réveillé, au hasard.
  const now = Date.now();
  const bots = await db.all(`SELECT u.* FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.status = 'accepted' AND u.is_bot ORDER BY random() LIMIT 5`, [human.id]);
  const bot = bots.find((b) => !asleep(traits(b.bot), now));
  if (!bot) return null;
  // Ce que le bot veut : un doublon de l'humain (hors favoris) qu'il n'a pas.
  const wants = await db.all(`SELECT DISTINCT ON (c.site_id) c.id, c.holo, s.id site_id, s.rarity, s.family FROM cards c JOIN sites s ON s.id = c.site_id
    WHERE c.user_id = $1 AND c.status = 'owned' AND s.rarity <= 3
      AND (SELECT COUNT(*) FROM cards d WHERE d.user_id = $1 AND d.site_id = c.site_id) > 1
      AND NOT EXISTS (SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.site_id = c.site_id)
      AND NOT EXISTS (SELECT 1 FROM cards o WHERE o.user_id = $2 AND o.site_id = c.site_id)
    ORDER BY c.site_id, c.holo LIMIT 30`, [human.id, bot.id]);
  if (!wants.length) return null;
  // Ce qu'il propose : une carte que l'humain n'a jamais eue.
  const gives = await db.all(`SELECT c.id, c.holo, s.id site_id, s.rarity, s.family FROM cards c JOIN sites s ON s.id = c.site_id
    WHERE c.user_id = $1 AND c.status = 'owned' AND s.rarity <= 3
      AND NOT EXISTS (SELECT 1 FROM dex d WHERE d.user_id = $2 AND d.site_id = c.site_id)
    ORDER BY random() LIMIT 40`, [bot.id, human.id]);
  if (!gives.length) return null;
  const price = await cardPrices(db, game, [...wants, ...gives]);
  let best = null;
  for (const w of wants) for (const g of gives) {
    const gap = price(w) - price(g); // > 0 : le bot complète en bits
    const score = Math.abs(gap) / price(w);
    if (gap >= 0 && gap <= bot.bits * 0.3 && (!best || score < best.score)) best = { w, g, gap, score };
  }
  if (!best || best.score > 0.6) return null;
  const bits = Math.round(best.gap);
  await game.createTrade({ id: bot.id, username: bot.username }, {
    toUserId: human.id, offerCards: [best.g.id], requestCards: [best.w.id], offerBits: bits,
    message: pick(['échange ? t\'as un doublon que je cherche', 'ça t\'intéresse ? c\'est au prix du marché', 'je complète ma collec, deal ?', 'petit échange équitable ?']),
  });
  return bot.id;
}

export async function serveHumans(db, game) {
  const now = Date.now();
  const out = { friends: 0, trades: 0, proposals: 0 };
  const reqs = await db.all(`SELECT f.user_id, f.created_at, b.id bot_id, b.username, b.bot FROM friends f
    JOIN users h ON h.id = f.user_id AND NOT h.is_bot JOIN users b ON b.id = f.friend_id AND b.is_bot
    WHERE f.status = 'pending' AND f.created_at < $1 ORDER BY f.created_at LIMIT 40`, [now - MIN]);
  for (const r of reqs) {
    if (!ready(traits(r.bot), `f${r.user_id}:${r.bot_id}`, r.created_at, now)) continue;
    try { await game.respondFriend({ id: r.bot_id, username: r.username }, r.user_id, true); out.friends++; } catch (e) { if (!(e instanceof GameError)) throw e; }
  }
  const trades = await db.all(`SELECT t.*, b.username, b.bot, b.bits FROM trades t
    JOIN users h ON h.id = t.from_id AND NOT h.is_bot JOIN users b ON b.id = t.to_id AND b.is_bot
    WHERE t.status = 'pending' AND t.created_at < $1 ORDER BY t.id LIMIT 30`, [now - MIN]);
  for (const t of trades) {
    if (!ready(traits(t.bot), `t${t.id}`, t.created_at, now)) continue;
    try { await judgeHumanTrade(db, game, { id: t.to_id, username: t.username, bot: t.bot, bits: t.bits }, t); out.trades++; } catch (e) { if (!(e instanceof GameError)) throw e; }
  }
  // Propositions des bots : au plus une toutes les 6 h par humain actif, et jamais s'il en a déjà une en attente.
  const humans = await db.all(`SELECT u.id FROM users u WHERE NOT u.is_bot AND u.last_seen > $1
      AND EXISTS (SELECT 1 FROM friends f JOIN users b ON b.id = f.friend_id WHERE f.user_id = u.id AND f.status = 'accepted' AND b.is_bot)
      AND NOT EXISTS (SELECT 1 FROM trades t JOIN users b ON b.id = t.from_id WHERE t.to_id = u.id AND b.is_bot AND (t.status = 'pending' OR t.created_at > $2))
    ORDER BY random() LIMIT 3`, [now - 2 * 24 * HOUR, now - 6 * HOUR]);
  for (const h of humans) {
    if (rnd() > 0.02) continue; // irrégulier : en moyenne quelques heures après la fin du délai minimal
    try { if (await proposeToHuman(db, game, h)) out.proposals++; } catch (e) { if (!(e instanceof GameError)) throw e; }
  }
  return out;
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
export async function runBots(db, game, { budgetMs = 8000, batch = 25, throttleMs = 15_000, force = false, maxSessions = 2000 } = {}) {
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
  // Les demandes des vrais joueurs passent avant tout le reste.
  done.humans = await serveHumans(db, game).catch((e) => { console.error('humains', e.message); return null; });
  while (Date.now() < deadline) {
    // Réserve un lot de bots dus (SKIP LOCKED : plusieurs instances peuvent travailler sans se gêner).
    const bots = await db.all(`UPDATE users SET bot_next_at = $1 WHERE id IN (
        SELECT id FROM users WHERE is_bot AND bot_next_at <= $2 ORDER BY bot_next_at LIMIT $3 FOR UPDATE SKIP LOCKED) RETURNING *`,
    [Date.now() + 15 * MIN, Date.now(), batch]);
    if (!bots.length) break;
    // 4 bots en parallèle : assez pour suivre le rythme, sans saturer la base.
    for (let i = 0; i < bots.length && Date.now() < deadline; i += 4) {
      await Promise.all(bots.slice(i, i + 4).map(async (bot) => {
        try {
          const log = await session(db, game, bot, opts);
          done.sessions++;
          done.actions += log.length;
        } catch (e) {
          console.error('bot', bot.id, e.message);
        }
      }));
    }
    if (done.sessions >= maxSessions) break;
  }
  if (!opts.dbFull) done.listed = await stockMarket(db, game, Number(process.env.MARKET_TARGET) || 400).catch((e) => { console.error('market', e.message); return 0; });
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
  await db.run('DELETE FROM events WHERE id < (SELECT MAX(id) - 3000 FROM events)');
  await db.run('DELETE FROM sales WHERE at < $1', [Date.now() - 90 * 24 * HOUR]);
  await db.run('DELETE FROM messages WHERE at < $1', [Date.now() - 60 * 24 * HOUR]);
  // Sites de la traîne dépliés mais plus utilisés par personne : on les replie (ils restent dans les blocs).
  const tail = await db.one("SELECT value FROM meta WHERE key = 'tail'");
  if (tail) {
    await db.run(`DELETE FROM sites s WHERE s.id >= $1 AND s.id < 100000000
      AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.site_id = s.id) AND NOT EXISTS (SELECT 1 FROM dex d WHERE d.site_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM auctions a WHERE a.site_id = s.id) AND NOT EXISTS (SELECT 1 FROM events e WHERE e.site_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.site_id = s.id) AND NOT EXISTS (SELECT 1 FROM users u WHERE u.avatar_site = s.id)
      AND NOT EXISTS (SELECT 1 FROM wishlist w WHERE w.site_id = s.id) AND NOT EXISTS (SELECT 1 FROM favorites f WHERE f.site_id = s.id)`, [JSON.parse(tail.value).start]);
  }
}

// Supprime les comptes d'animation (tous, ou seulement les moins actifs pour n'en garder que `keep`).
// Ceux qui sont amis avec un vrai joueur sont gardés en priorité, pour ne pas vider sa liste d'amis.
export async function deleteBots(db, { keep = 0 } = {}) {
  return db.tx(async (q) => {
    const victims = (await q.all(`SELECT id FROM users u WHERE is_bot ORDER BY
        EXISTS (SELECT 1 FROM friends f JOIN users h ON h.id = f.friend_id WHERE f.user_id = u.id AND NOT h.is_bot) ASC, packs_opened ASC
      LIMIT GREATEST(0, (SELECT COUNT(*) FROM users WHERE is_bot) - $1)`, [Math.max(0, Math.floor(keep))])).map((r) => r.id);
    if (!victims.length) return { deleted: 0 };
    // Leurs cartes en vente disparaissent avec eux : on rembourse les joueurs qui menaient ces enchères.
    await q.run(`UPDATE users h SET bits = h.bits + a.current_bid FROM auctions a
      WHERE a.status = 'open' AND a.seller_id = ANY($1::int[]) AND a.bidder_id = h.id AND NOT (h.id = ANY($1::int[]))`, [victims]);
    await q.run("UPDATE cards c SET status = 'owned' FROM auctions a WHERE a.status = 'open' AND a.bidder_id = ANY($1::int[]) AND c.id = a.card_id", [victims]);
    await q.run("DELETE FROM auctions WHERE status = 'open' AND (seller_id = ANY($1::int[]) OR bidder_id = ANY($1::int[]))", [victims]);
    for (let k = 0; k < victims.length; k += 1000) await q.run('DELETE FROM users WHERE id = ANY($1::int[])', [victims.slice(k, k + 1000)]);
    return { deleted: victims.length };
  });
}
