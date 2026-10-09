// API JSON de Netdex. handleApi(req, res) fonctionne avec node:http et avec les fonctions Vercel.
import { randomBytes, createHash, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { createDb, databaseUrl, ADMIN_USERNAMES } from './db.js';
import { copyDatabase, scheduleCron } from './transfer.js';
import { RARITIES, tailDomains, searchTail, siteRow } from './sites.js';
import { wallet, marketIndex, sitePrices, snapshotDue } from './market.js';
import { createGame, CONFIG, GameError } from './game.js';
import { setupDatabase, setupTail } from './setup.js';
import { runBots, seedBots, botStatus, deleteBots } from './bots.js';
import { waitUntil } from '@vercel/functions';

const SESSION_DAYS = 60;
const scrypt = promisify(scryptCb);
const sha = (s) => createHash('sha256').update(s).digest('hex');

// Initialisation paresseuse : une connexion et un état de jeu par instance (réutilisés entre requêtes).
let ctx = null;
export function getContext(db) {
  if (!ctx) {
    ctx = (async () => {
      const d = db || createDb();
      if (!d) throw new GameError('Base de données non configurée (DATABASE_URL manquant).', 503);
      return { db: d, game: await createGame(d) };
    })();
    ctx.catch(() => { ctx = null; });
  }
  return ctx;
}
export function resetContext() { ctx = null; }

// ---------- Comptes ----------
async function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 64);
  return `s1$${salt.toString('hex')}$${hash.toString('hex')}`;
}
async function checkPassword(pw, stored) {
  const [, salt, hash] = stored.split('$');
  const got = await scrypt(pw, Buffer.from(salt, 'hex'), 64);
  return timingSafeEqual(got, Buffer.from(hash, 'hex'));
}
const tokenFrom = (req) => /(?:^|;\s*)nd_sid=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '')?.[1];

function setCookie(res, req, value, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `nd_sid=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}
async function createSession(db, res, req, userId) {
  const token = randomBytes(32).toString('base64url');
  await db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [sha(token), userId, Date.now() + SESSION_DAYS * 86400e3]);
  setCookie(res, req, token, SESSION_DAYS * 86400);
}
async function getUser(db, req) {
  const token = tokenFrom(req);
  if (!token) return null;
  const u = await db.one('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > $2', [sha(token), Date.now()]);
  if (u && Date.now() - u.last_seen > 60_000) await db.run('UPDATE users SET last_seen = $1 WHERE id = $2', [Date.now(), u.id]);
  return u || null;
}

// Limiteur par IP (par instance : protection de base contre le bourrage d'identifiants).
const hits = new Map();
function rateLimit(req, key, max, windowMs) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '?';
  const k = key + ip;
  const now = Date.now();
  if (hits.size > 10_000) for (const [kk, v] of hits) if (v.reset < now) hits.delete(kk);
  const h = hits.get(k);
  if (!h || h.reset < now) { hits.set(k, { n: 1, reset: now + windowMs }); return; }
  if (++h.n > max) throw new GameError('Trop de tentatives, réessaie dans une minute.', 429);
}

// ---------- Vues ----------
async function meView({ db, game }, u) {
  const now = Date.now();
  const c = await db.one(`SELECT
      (SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND NOT read) notifications,
      (SELECT COUNT(*) FROM trades WHERE to_id = $1 AND status = 'pending') trades,
      (SELECT COUNT(*) FROM friends WHERE friend_id = $1 AND status = 'pending') friend_requests`, [u.id]);
  return {
    user: { id: u.id, username: u.username, isAdmin: u.is_admin, bits: u.bits, dexCount: u.dex_count, dexScore: u.dex_score, packsOpened: u.packs_opened, avatarSite: u.avatar_site, createdAt: u.created_at },
    packs: game.packState(u, now),
    daily: game.dailyState(u, now),
    counts: { notifications: c.notifications, trades: c.trades, friendRequests: c.friend_requests },
    config: { premiumPrice: CONFIG.premiumPrice, holoMultiplier: CONFIG.holoMultiplier, auctionHours: CONFIG.auctionHours, auctionFee: CONFIG.auctionFee, maxTradeCards: CONFIG.maxTradeCards, totalSites: game.totalSites },
    serverTime: now,
  };
}
const reloadUser = (db, id) => db.one('SELECT * FROM users WHERE id = $1', [id]);

const COLLECTION_SORT = {
  rarity: 's.rarity DESC, s.id ASC',
  recent: 'last DESC',
  name: 's.domain ASC',
  count: 'n DESC, s.rarity DESC',
  rank: 's.id ASC',
};
const likeArg = (s) => '%' + String(s).toLowerCase().replace(/[%_\\]/g, '') + '%';

async function collection(db, userId, query) {
  const args = [userId];
  const p = (v) => { args.push(v); return '$' + args.length; };
  const where = ['c.user_id = $1'];
  if (query.rarity !== undefined && query.rarity !== '') where.push(`s.rarity = ${p(Number(query.rarity))}`);
  if (query.q) where.push(`s.domain LIKE ${p(likeArg(query.q))}`);
  const having = query.dupes === '1' ? 'HAVING COUNT(*) > 1' : query.holo === '1' ? 'HAVING SUM(c.holo) > 0' : '';
  const limit = Math.min(200, Number(query.limit) || 120);
  const offset = Math.max(0, Number(query.offset) || 0);
  const rows = await db.all(`SELECT s.id, s.domain, s.rarity, s.family, COUNT(*)::int n, SUM(c.holo)::int holo, MAX(c.obtained_at) last,
      string_agg(CASE WHEN c.status = 'owned' THEN c.id::text || CASE WHEN c.holo = 1 THEN 'h' ELSE '' END END, ',') cards
    FROM cards c JOIN sites s ON s.id = c.site_id WHERE ${where.join(' AND ')}
    GROUP BY s.id ${having} ORDER BY ${COLLECTION_SORT[query.sort] || COLLECTION_SORT.rarity} LIMIT ${p(limit + 1)} OFFSET ${p(offset)}`, args);
  return { items: rows.slice(0, limit), more: rows.length > limit };
}

async function stats({ db, game }, userId, isBot = false) {
  const [owned, byRarity] = await Promise.all([
    db.one('SELECT COUNT(*) n, COUNT(DISTINCT site_id) d FROM cards WHERE user_id = $1', [userId]),
    isBot
      ? db.all('SELECT s.rarity, COUNT(DISTINCT s.id) n FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.user_id = $1 GROUP BY s.rarity', [userId])
      : db.all('SELECT s.rarity, COUNT(*) n FROM dex d JOIN sites s ON s.id = d.site_id WHERE d.user_id = $1 GROUP BY s.rarity', [userId]),
  ]);
  const found = Object.fromEntries(byRarity.map((r) => [r.rarity, r.n]));
  return {
    cards: owned.n, distinct: owned.d,
    tiers: game.tiers.map((t) => ({ id: t.id, name: t.name, key: t.key, total: t.total, lo: t.lo, hi: t.hi, found: found[t.id] || 0, value: t.value, chance: t.weight / 10000 })),
  };
}

async function publicProfile(c, meId, name) {
  const { db, game } = c;
  const u = await db.one('SELECT u.*, s.domain avatar_domain FROM users u LEFT JOIN sites s ON s.id = u.avatar_site WHERE lower(u.username) = lower($1)', [name]);
  if (!u) throw new GameError('Joueur introuvable.', 404);
  const [best, rank, st, relation] = await Promise.all([
    db.all(`SELECT s.id, s.domain, s.rarity, s.family, MAX(c.holo) holo, COUNT(*)::int n FROM cards c JOIN sites s ON s.id = c.site_id
      WHERE c.user_id = $1 GROUP BY s.id ORDER BY s.rarity DESC, s.id ASC LIMIT 12`, [u.id]),
    db.one('SELECT COUNT(*) + 1 r FROM users WHERE dex_score > $1', [u.dex_score]),
    stats(c, u.id, u.is_bot),
    meId === u.id ? 'self' : game.relation(db, meId, u.id),
  ]);
  return {
    id: u.id, username: u.username, createdAt: u.created_at, lastSeen: u.last_seen, dexCount: u.dex_count, dexScore: u.dex_score,
    packsOpened: u.packs_opened, avatarSite: u.avatar_site, avatarDomain: u.avatar_domain, rank: rank.r, relation, best, stats: st,
  };
}

async function siteInfo({ db, game }, meId, id) {
  const site = (await game.ensureSites(db, [Number(id) || 0])).get(Number(id) || 0);
  if (!site) throw new GameError('Site inconnu.', 404);
  const [circ, mine, owners, found, history, prices] = await Promise.all([
    db.one('SELECT COUNT(*) n, COALESCE(SUM(holo), 0) h, COUNT(DISTINCT user_id) owners FROM cards WHERE site_id = $1', [site.id]),
    db.all('SELECT id, holo, status, obtained_at FROM cards WHERE site_id = $1 AND user_id = $2 ORDER BY holo DESC, id', [site.id, meId]),
    db.all(`SELECT u.username, COUNT(*) n, SUM(c.holo) h FROM cards c JOIN users u ON u.id = c.user_id
      WHERE c.site_id = $1 GROUP BY u.id ORDER BY n DESC LIMIT 15`, [site.id]),
    db.one('SELECT found_at FROM dex WHERE user_id = $1 AND site_id = $2', [meId, site.id]),
    db.all('SELECT at, price, holo FROM sales WHERE site_id = $1 ORDER BY at DESC LIMIT 60', [site.id]),
    sitePrices(db, game, [site.id]),
  ]);
  return { site, circulation: circ.n, holos: circ.h, owners: circ.owners, ownerList: owners, mine, foundAt: found?.found_at || null,
    value: RARITIES[site.rarity].value, price: prices.get(site.id), sales: history.reverse() };
}

// Sites pour une liste d'id : ceux de la table, et ceux de la longue traîne lus dans les blocs (sans les déplier).
async function sitesByIds({ db, game }, ids) {
  if (!ids.length) return [];
  const rows = await db.all('SELECT id, domain, rarity, family FROM sites WHERE id = ANY($1::int[])', [ids]);
  const map = new Map(rows.map((r) => [r.id, r]));
  const missing = ids.filter((id) => !map.has(id));
  if (missing.length) for (const [id, d] of await tailDomains(db, game.tail, missing)) map.set(id, siteRow(id, d));
  return ids.map((id) => map.get(id)).filter(Boolean);
}
const PAGE = 96;

// ---------- Routes ----------
const routes = [];
const route = (method, path, handler, opts = {}) => {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, auth: opts.auth !== false, db: opts.db !== false });
};

const USERNAME = /^[A-Za-z0-9_.-]{3,20}$/;

route('POST', '/api/register', async ({ c, req, res, body }) => {
  rateLimit(req, 'reg', 5, 60_000);
  const { db, game } = c;
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!USERNAME.test(username)) throw new GameError('Pseudo : 3 à 20 caractères (lettres, chiffres, _ . -).');
  if (password.length < 8 || password.length > 200) throw new GameError('Mot de passe : 8 caractères minimum.');
  if (await db.one('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username])) throw new GameError('Ce pseudo est déjà pris.', 409);
  const hash = await hashPassword(password);
  const now = Date.now();
  let id;
  try {
    ({ id } = await db.one('INSERT INTO users (username, pass_hash, created_at, bits, pack_stock, pack_anchor, last_seen, is_admin) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [username, hash, now, CONFIG.startBits, CONFIG.startPacks, now, now, ADMIN_USERNAMES.includes(username.toLowerCase())]));
  } catch {
    throw new GameError('Ce pseudo est déjà pris.', 409);
  }
  await game.notify(db, id, `Bienvenue sur Netdex, ${username} ! Tu as ${CONFIG.startPacks} boosters offerts.`, '#/');
  await game.logEvent(db, 'join', id);
  await createSession(db, res, req, id);
  return meView(c, await reloadUser(db, id));
}, { auth: false });

route('POST', '/api/login', async ({ c, req, res, body }) => {
  rateLimit(req, 'login', 10, 60_000);
  const u = await c.db.one('SELECT * FROM users WHERE lower(username) = lower($1)', [String(body.username || '').trim()]);
  if (!u || !(await checkPassword(String(body.password || ''), u.pass_hash))) throw new GameError('Pseudo ou mot de passe incorrect.', 401);
  await c.db.run('DELETE FROM sessions WHERE user_id = $1 AND expires_at < $2', [u.id, Date.now()]);
  await createSession(c.db, res, req, u.id);
  return meView(c, u);
}, { auth: false });

route('POST', '/api/logout', async ({ c, req, res }) => {
  const token = tokenFrom(req);
  if (token) await c.db.run('DELETE FROM sessions WHERE token_hash = $1', [sha(token)]);
  setCookie(res, req, '', 0);
  return { ok: true };
}, { auth: false });

route('POST', '/api/account/password', async ({ c, me, body }) => {
  if (!(await checkPassword(String(body.current || ''), me.pass_hash))) throw new GameError('Mot de passe actuel incorrect.', 401);
  const pw = String(body.password || '');
  if (pw.length < 8 || pw.length > 200) throw new GameError('Mot de passe : 8 caractères minimum.');
  await c.db.run('UPDATE users SET pass_hash = $1 WHERE id = $2', [await hashPassword(pw), me.id]);
  return { ok: true };
});

route('POST', '/api/account/avatar', async ({ c, me, body }) => {
  const siteId = Number(body.siteId) || 0;
  if (!(await c.db.one('SELECT 1 FROM cards WHERE user_id = $1 AND site_id = $2', [me.id, siteId]))) throw new GameError('Tu dois posséder cette carte.');
  await c.db.run('UPDATE users SET avatar_site = $1 WHERE id = $2', [siteId, me.id]);
  return { ok: true };
});

route('GET', '/api/me', async ({ c, me }) => { await c.game.settleAuctions(); return meView(c, await reloadUser(c.db, me.id)); });
route('POST', '/api/packs/open', async ({ c, me, body }) => {
  const cards = await c.game.openPack(me.id, body.kind === 'premium' ? 'premium' : 'free', { free: !!body.free });
  return { cards, me: await meView(c, await reloadUser(c.db, me.id)) };
});
route('POST', '/api/daily', ({ c, me }) => c.game.claimDaily(me.id));

route('GET', '/api/collection', async ({ c, me, query }) => {
  const owner = query.user ? await c.db.one('SELECT id FROM users WHERE lower(username) = lower($1)', [query.user]) : me;
  if (!owner) throw new GameError('Joueur introuvable.', 404);
  return collection(c.db, owner.id, query);
});
route('GET', '/api/stats', ({ c, me }) => stats(c, me.id));
route('POST', '/api/cards/recycle', ({ c, me, body }) => c.game.recycle(me.id, body.cardIds));
route('POST', '/api/cards/recycle-duplicates', ({ c, me, body }) => c.game.recycleDuplicates(me.id, body.maxRarity));

route('GET', '/api/dex', async ({ c, me, query }) => {
  const t = c.game.tiers[Math.max(0, Math.min(5, Number(query.rarity) || 0))];
  const offset = Math.max(0, Number(query.offset) || 0);
  const found = await c.db.all('SELECT site_id, found_at FROM dex WHERE user_id = $1 AND site_id BETWEEN $2 AND $3', [me.id, t.lo, t.hi]);
  const f = new Map(found.map((r) => [r.site_id, r.found_at]));
  if (query.missing === '1') {
    // Les manquants : on saute les id déjà découverts.
    const ids = [];
    let id = t.lo + offset;
    for (; id <= t.hi && ids.length < PAGE; id++) if (!f.has(id)) ids.push(id);
    return { items: ids.map((x) => ({ id: x, rarity: t.id })), more: id <= t.hi, next: id - t.lo };
  }
  const ids = [];
  for (let id = t.lo + offset; id <= t.hi && ids.length < PAGE; id++) ids.push(id);
  const known = await sitesByIds(c, ids.filter((id) => f.has(id)));
  const byId = new Map(known.map((k) => [k.id, k]));
  return { items: ids.map((id) => (byId.has(id) ? { ...byId.get(id), found_at: f.get(id) } : { id, rarity: t.id })), more: t.lo + offset + PAGE <= t.hi, next: offset + PAGE };
});

route('GET', '/api/sites/search', async ({ c, me, query }) => {
  const q = String(query.q || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].replace(/[%_\\]/g, '');
  if (q.length < 2) return { items: [] };
  const head = await c.db.all(`SELECT s.id, s.domain, s.rarity, s.family FROM sites s WHERE s.domain LIKE $1 ORDER BY s.id LIMIT 30`, [q + '%']);
  const seen = new Set(head.map((h) => h.id));
  const tail = head.length < 30 ? (await searchTail(c.db, c.game.tail, q, { limit: 30 - head.length })).filter((t) => !seen.has(t.id)).map((t) => siteRow(t.id, t.domain)) : [];
  const items = [...head, ...tail];
  const found = new Map((await c.db.all('SELECT site_id, found_at FROM dex WHERE user_id = $1 AND site_id = ANY($2::int[])', [me.id, items.map((i) => i.id)])).map((r) => [r.site_id, r.found_at]));
  return { items: items.map((i) => ({ ...i, found_at: found.get(i.id) || null })) };
});
route('GET', '/api/sites/:id', ({ c, me, params }) => siteInfo(c, me.id, params.id));

route('GET', '/api/users/search', async ({ c, me, query }) => {
  const q = String(query.q || '').trim().replace(/[%_\\]/g, '');
  if (q.length < 2) return { items: [] };
  return { items: await c.db.all('SELECT id, username, dex_count, dex_score FROM users WHERE lower(username) LIKE lower($1) AND id != $2 ORDER BY dex_score DESC LIMIT 20', [q + '%', me.id]) };
});
route('GET', '/api/users/:name', ({ c, me, params }) => publicProfile(c, me.id, decodeURIComponent(params.name)));

route('GET', '/api/leaderboard', async ({ c, me, query }) => {
  const by = query.by === 'count' ? 'dex_count' : query.by === 'packs' ? 'packs_opened' : 'dex_score';
  const friends = query.scope === 'friends';
  const items = await c.db.all(`SELECT u.id, u.username, u.dex_score, u.dex_count, u.packs_opened, s.domain avatar_domain FROM users u
    LEFT JOIN sites s ON s.id = u.avatar_site
    ${friends ? "WHERE u.id = $1 OR u.id IN (SELECT friend_id FROM friends WHERE user_id = $1 AND status = 'accepted')" : ''}
    ORDER BY u.${by} DESC, u.id ASC LIMIT 100`, friends ? [me.id] : []);
  const myRank = (await c.db.one(`SELECT COUNT(*) + 1 r FROM users WHERE ${by} > $1`, [me[by]])).r;
  return { items, myRank };
});

route('GET', '/api/friends', ({ c, me }) => c.game.listFriends(me.id));
route('POST', '/api/friends/request', ({ c, me, body }) => c.game.requestFriend(me, body.username));
route('POST', '/api/friends/respond', ({ c, me, body }) => c.game.respondFriend(me, body.userId, !!body.accept));
route('POST', '/api/friends/remove', ({ c, me, body }) => c.game.removeFriend(me, body.userId));

route('GET', '/api/trades', ({ c, me }) => c.game.listTrades(me.id));
route('POST', '/api/trades', ({ c, me, body }) => c.game.createTrade(me, body));
route('POST', '/api/trades/:id/:action', ({ c, me, params }) => {
  if (!['accept', 'decline', 'cancel'].includes(params.action)) throw new GameError('Action inconnue.', 404);
  return c.game.resolveTrade(me, params.id, params.action);
});

route('GET', '/api/auctions', async ({ c, me, query }) => ({ items: await c.game.listAuctions(me.id, query) }));
route('POST', '/api/auctions', ({ c, me, body }) => c.game.createAuction(me, body));
route('POST', '/api/auctions/:id/bid', ({ c, me, params, body }) => c.game.bid(me, params.id, body.amount));
route('POST', '/api/auctions/:id/buyout', ({ c, me, params }) => c.game.bid(me, params.id, 0, true));
route('POST', '/api/auctions/:id/cancel', ({ c, me, params }) => c.game.cancelAuction(me, params.id));

route('GET', '/api/notifications', async ({ c, me }) => ({ items: await c.db.all('SELECT * FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 50', [me.id]) }));
route('POST', '/api/notifications/read', async ({ c, me }) => { await c.db.run('UPDATE notifications SET read = true WHERE user_id = $1 AND NOT read', [me.id]); return { ok: true }; });


// ---------- En direct ----------
route('GET', '/api/feed', async ({ c }) => {
  const now = Date.now();
  const [stats, events] = await Promise.all([
    c.db.one(`SELECT (SELECT COUNT(*) FROM users WHERE last_seen > $1) online, (SELECT COUNT(*) FROM auctions WHERE status = 'open') auctions,
      (SELECT COUNT(*) FROM events WHERE at > $2) last_hour`, [now - 10 * 60_000, now - 3600_000]),
    c.db.all(`SELECT e.id, e.at, e.kind, e.holo, e.amount, u.username who, o.username other, s.id site_id, s.domain, s.rarity
      FROM events e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN users o ON o.id = e.other_id LEFT JOIN sites s ON s.id = e.site_id
      ORDER BY e.id DESC LIMIT 25`),
  ]);
  return { ...stats, events };
});

// ---------- Catalogue : toutes les cartes du jeu ----------
route('GET', '/api/catalog', async ({ c, me, query }) => {
  const offset = Math.max(0, Number(query.offset) || 0);
  const tier = query.rarity !== undefined && query.rarity !== '' ? c.game.tiers[Math.max(0, Math.min(5, Number(query.rarity) || 0))] : null;
  const lo = tier ? tier.lo : 1, hi = tier ? tier.hi : c.game.totalSites;
  const counts = async (ids) => new Map((await c.db.all('SELECT site_id, COUNT(*)::int n FROM cards WHERE user_id = $1 AND site_id = ANY($2::int[]) GROUP BY site_id', [me.id, ids])).map((r) => [r.site_id, r.n]));
  let items, more = false;
  if (query.filter === 'owned') {
    const rows = await c.db.all(`SELECT s.id, s.domain, s.rarity, s.family, COUNT(*)::int n FROM cards o JOIN sites s ON s.id = o.site_id
      WHERE o.user_id = $1 AND s.id BETWEEN $2 AND $3 ${query.q ? 'AND s.domain LIKE $5' : ''} GROUP BY s.id ORDER BY s.id LIMIT ${PAGE + 1} OFFSET $4`,
    query.q ? [me.id, lo, hi, offset, likeArg(query.q)] : [me.id, lo, hi, offset]);
    items = rows.slice(0, PAGE); more = rows.length > PAGE;
  } else if (query.q) {
    // Recherche : d'abord les sites de la table, puis la longue traîne.
    const q = String(query.q).toLowerCase().trim().replace(/[%_\\]/g, '');
    const head = await c.db.all('SELECT id, domain, rarity, family FROM sites WHERE domain LIKE $1 AND id BETWEEN $2 AND $3 ORDER BY id LIMIT $4', [likeArg(q), lo, hi, PAGE]);
    const seen = new Set(head.map((h) => h.id));
    const tail = head.length < PAGE && hi >= (c.game.tail?.start || Infinity)
      ? (await searchTail(c.db, c.game.tail, q, { mode: 'contains', limit: PAGE - head.length })).filter((t) => !seen.has(t.id) && t.id >= lo && t.id <= hi).map((t) => siteRow(t.id, t.domain)) : [];
    items = [...head, ...tail];
    const n = await counts(items.map((i) => i.id));
    items = items.map((i) => ({ ...i, n: n.get(i.id) || 0 }));
    if (query.filter === 'missing') items = items.filter((i) => !i.n);
  } else {
    const ids = [];
    for (let id = lo + offset; id <= hi && ids.length < PAGE; id++) ids.push(id);
    const n = await counts(ids);
    items = (await sitesByIds(c, ids)).map((i) => ({ ...i, n: n.get(i.id) || 0 }));
    if (query.filter === 'missing') items = items.filter((i) => !i.n);
    more = lo + offset + PAGE <= hi;
  }
  return { items, more, next: offset + (query.filter === 'owned' ? items.length : PAGE), total: c.game.totalSites };
});

// ---------- Valeur des collections & cours du marché ----------
route('GET', '/api/wallet', async ({ c, me, query }) => {
  const u = query.user ? await c.db.one('SELECT id, is_bot FROM users WHERE lower(username) = lower($1)', [query.user]) : me;
  if (!u) throw new GameError('Joueur introuvable.', 404);
  return wallet(c.db, c.game, u.id);
});
route('GET', '/api/market/index', ({ c }) => marketIndex(c.db));

// ---------- Administration ----------
const admin = (fn) => async (ctx) => {
  if (!ctx.me.is_admin) throw new GameError('Réservé aux administrateurs.', 403);
  return fn(ctx);
};
async function findUser(db, body) {
  const u = body.userId ? await db.one('SELECT * FROM users WHERE id = $1', [Number(body.userId)])
    : await db.one('SELECT * FROM users WHERE lower(username) = lower($1)', [String(body.username || '').trim()]);
  if (!u) throw new GameError('Joueur introuvable.', 404);
  return u;
}

route('GET', '/api/admin/overview', admin(async ({ c }) => {
  const [counts, bots] = await Promise.all([
    c.db.one(`SELECT (SELECT COUNT(*) FROM users WHERE NOT is_bot) humans, (SELECT COUNT(*) FROM users WHERE is_bot) bots,
      (SELECT COUNT(*) FROM cards) cards, (SELECT COUNT(*) FROM auctions WHERE status = 'open') auctions,
      (SELECT COUNT(*) FROM trades WHERE status = 'pending') trades, (SELECT COUNT(*) FROM sites) sites`),
    botStatus(c.db),
  ]);
  return { counts, bots, dbLimitMb: Number(process.env.BOT_DB_MAX_MB) || 90 };
}));

route('GET', '/api/admin/users', admin(async ({ c, query }) => {
  const q = String(query.q || '').trim().replace(/[%_\\]/g, '');
  const kind = query.kind === 'bots' ? 'AND is_bot' : query.kind === 'all' ? '' : 'AND NOT is_bot';
  return { items: await c.db.all(`SELECT id, username, bits, dex_count, dex_score, packs_opened, is_bot, is_admin, last_seen, created_at, pack_stock
    FROM users WHERE lower(username) LIKE lower($1) ${kind} ORDER BY last_seen DESC LIMIT 50`, [q + '%']) };
}));

// Offrir : bits (positif ou négatif), boosters, cartes. Cible : un joueur ou tous les humains.
route('POST', '/api/admin/give', admin(async ({ c, body, me }) => {
  const bits = Math.trunc(Number(body.bits) || 0);
  const packs = Math.max(0, Math.min(1000, Math.trunc(Number(body.packs) || 0)));
  const count = Math.max(1, Math.min(100, Math.trunc(Number(body.count) || 1)));
  let site = null;
  if (body.siteId || body.domain) {
    const dom = String(body.domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    let id = Number(body.siteId) || (await c.db.one('SELECT id FROM sites WHERE domain = $1', [dom]))?.id;
    if (!id && dom) id = (await searchTail(c.db, c.game.tail, dom, { exact: true, limit: 1 }))[0]?.id;
    site = id ? (await c.game.ensureSites(c.db, [id])).get(id) : null;
    if (!site) throw new GameError('Site introuvable dans le jeu.', 404);
  }
  if (!bits && !packs && !site) throw new GameError('Rien à offrir.');
  const targets = body.everyone ? await c.db.all('SELECT * FROM users WHERE NOT is_bot') : [await findUser(c.db, body)];
  const now = Date.now();
  await c.db.tx(async (q) => {
    const ids = targets.map((t) => t.id);
    if (bits) await q.run('UPDATE users SET bits = GREATEST(0, bits + $1) WHERE id = ANY($2::int[])', [bits, ids]);
    if (packs) await q.run('UPDATE users SET pack_stock = pack_stock + $1 WHERE id = ANY($2::int[])', [packs, ids]);
    for (const t of targets) {
      if (site) {
        await q.run('INSERT INTO cards (user_id, site_id, holo, obtained_at) SELECT $1, $2, $3, $4 FROM generate_series(1, $5)', [t.id, site.id, body.holo ? 1 : 0, now, count]);
        await c.game.discover(q, t.id, site.id, now);
      }
      const parts = [bits > 0 && `${bits} bits`, packs && `${packs} booster${packs > 1 ? 's' : ''}`, site && `${count > 1 ? count + ' × ' : ''}${site.domain}${body.holo ? ' HOLO' : ''}`].filter(Boolean);
      if (parts.length && t.id !== me.id) await c.game.notify(q, t.id, `Cadeau de l'équipe Netdex : ${parts.join(', ')} !`, '#/');
    }
  });
  return { ok: true, targets: targets.length };
}));

route('POST', '/api/admin/user/:id/:action', admin(async ({ c, me, params, body }) => {
  const id = Number(params.id);
  if (params.action === 'admin') { await c.db.run('UPDATE users SET is_admin = $1 WHERE id = $2', [!!body.value, id]); return { ok: true }; }
  if (params.action === 'delete') {
    if (id === me.id) throw new GameError('Tu ne peux pas supprimer ton propre compte ici.');
    await c.db.run("UPDATE cards c SET status = 'owned' FROM auctions a WHERE a.bidder_id = $1 AND a.status = 'open' AND c.id = a.card_id", [id]);
    await c.db.run("DELETE FROM auctions WHERE (seller_id = $1 OR bidder_id = $1) AND status = 'open'", [id]);
    await c.db.run('DELETE FROM users WHERE id = $1', [id]);
    return { ok: true };
  }
  if (params.action === 'reset-packs') { await c.db.run('UPDATE users SET pack_stock = $1, pack_anchor = $2 WHERE id = $3', [CONFIG.packCap, Date.now(), id]); return { ok: true }; }
  throw new GameError('Action inconnue.', 404);
}));

route('POST', '/api/admin/bots/seed', admin(async ({ c, body }) => seedBots(c.db, c.game, Number(body.count) || 10_000)));
route('POST', '/api/admin/bots/tick', admin(async ({ c }) => runBots(c.db, c.game, { budgetMs: 20_000, force: true })));
route('POST', '/api/admin/bots/pause', admin(async ({ c, body }) => {
  await c.db.run("INSERT INTO meta (key, value) VALUES ('bots_paused', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [body.paused ? '1' : '0']);
  return { ok: true };
}));
route('POST', '/api/admin/bots/delete', admin(async ({ c }) => { await deleteBots(c.db); return { ok: true }; }));

// Tâche planifiée quotidienne (Vercel Cron) : grosse passe de bots.
route('GET', '/api/cron/bots', async ({ c, req }) => {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) throw new GameError('Interdit.', 403);
  const budget = Math.max(5, Math.min(250, Number(new URL(req.url, 'http://x').searchParams.get('budget')) || 250));
  const snaps = await snapshotDue(c.db, c.game).catch((e) => { console.error('snapshots', e.message); return 0; });
  const r = await runBots(c.db, c.game, { budgetMs: budget * 1000, batch: 40, force: true });
  return { ...r, snapshots: snaps };
}, { auth: false });

route('GET', '/api/health', async () => {
  try { await getContext(); return { ok: true, db: true }; } catch (e) { return { ok: true, db: false, error: e.message, code: e.code }; }
}, { auth: false, db: false });

// Initialisation manuelle de la base (protégée par SETUP_KEY) : utile si l'import du build a échoué.
route('POST', '/api/admin/setup', async ({ query }) => {
  if (!process.env.SETUP_KEY || query.key !== process.env.SETUP_KEY) throw new GameError('Interdit.', 403);
  const db = createDb(databaseUrl(query.db || undefined));
  if (!db) throw new GameError('DATABASE_URL manquant.', 503);
  try {
    let result = '';
    if (query.inspect === '1') {
      // Inventaire lecture seule : tables par schéma, colonnes et nombre de lignes estimé.
      const rows = await db.all(`SELECT n.nspname s, c.relname t, c.reltuples::bigint est,
          (SELECT string_agg(a.attname, ',' ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) cols
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_%'
        ORDER BY 1, 2`);
      return { ok: true, tables: rows };
    }
    if (query.copy) {
      // Copie intégrale d'une autre base branchée (ex. copy=neon) vers celle-ci.
      const src = createDb(databaseUrl(query.copy));
      try { result += 'copie : ' + JSON.stringify(await copyDatabase(src, db)) + ' · '; } finally { await src.close(); }
    }
    result += query.vacuum === '1' ? 'vacuum' : await setupDatabase(db, { force: query.force === '1' });
    if (query.tail === '1') { result += ' · ' + await setupTail(db); resetContext(); }
    if (query.cron) result += ' · cron : ' + JSON.stringify(await scheduleCron(db, query.cron, process.env.CRON_SECRET, query.schedule || '* * * * *'));
    if (query.pause !== undefined) {
      await db.run("INSERT INTO meta (key, value) VALUES ('bots_paused', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [query.pause === '1' ? '1' : '0']);
      result += ` · bots ${query.pause === '1' ? 'en pause' : 'actifs'}`;
    }
    result += ' · hôte ' + new URL(databaseUrl(query.db || undefined)).hostname;
    if (query.rebalance === '1') {
      // Retire aux bots les Mythiques de leur historique simulé (cartes et points).
      await db.run(`DELETE FROM cards c USING users u, sites s WHERE u.id = c.user_id AND u.is_bot AND s.id = c.site_id AND s.rarity = 5 AND c.status = 'owned'`);
      const r = await db.run(`UPDATE users SET dex_count = dex_count - dex_score / 40000, dex_score = dex_score % 40000 WHERE is_bot AND dex_score >= 40000`);
      result += ` · ${r} bots rééquilibrés`;
    }
    if (Number(query.bots) > 0) {
      const { game } = await getContext();
      const { n } = await db.one('SELECT COUNT(*) n FROM users WHERE is_bot');
      result += n ? ` · ${n} bots déjà présents` : ` · ${(await seedBots(db, game, Number(query.bots))).created} bots créés`;
    }
    // VACUUM FULL rend au disque la place des lignes mortes (ex. import interrompu) : utile sous un quota de stockage.
    if (query.vacuum === '1') for (const t of ['sites', 'cards', 'dex', 'notifications', 'trades', 'trade_items', 'auctions', 'sessions', 'users', 'friends']) await db.query(`VACUUM FULL ${t}`);
    const size = await db.one('SELECT pg_database_size(current_database()) b');
    const tables = await db.all("SELECT relname t, pg_total_relation_size(relid) b FROM pg_catalog.pg_statio_user_tables ORDER BY 2 DESC LIMIT 8");
    resetContext();
    return { ok: true, result, dbMb: Math.round(size.b / 1048576), tables: tables.map((r) => `${r.t}:${Math.round(r.b / 1048576)}MB`) };
  } catch (e) {
    return { ok: false, error: String(e?.stack || e) };
  } finally {
    await db.close();
  }
}, { auth: false, db: false });

// ---------- Transport ----------
function readBody(req) {
  // Vercel peut avoir déjà lu et parsé le corps.
  if (req.body !== undefined) return Promise.resolve(typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body));
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (ch) => { size += ch.length; if (size > 64 * 1024) { reject(new GameError('Requête trop grosse.', 413)); req.destroy(); } else chunks.push(ch); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(req, res, status, data) {
  let body = Buffer.from(JSON.stringify(data));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!process.env.VERCEL && body.length > 1024 && (req.headers['accept-encoding'] || '').includes('gzip')) {
    body = gzipSync(body, { level: 4 });
    res.setHeader('Content-Encoding', 'gzip');
  }
  res.statusCode = status;
  res.setHeader('Content-Length', body.length);
  res.end(body);
}

export async function handleApi(req, res, { db } = {}) {
  const url = new URL(req.url, 'http://x');
  // Vercel réécrit /api/... vers /api?path=... : on reconstitue le chemin d'origine.
  const path = url.searchParams.get('__path') ? '/api/' + url.searchParams.get('__path') : url.pathname.replace(/\/$/, '');
  url.searchParams.delete('__path');
  try {
    let match = null;
    let allowed = false;
    for (const r of routes) {
      const m = r.re.exec(path);
      if (!m) continue;
      allowed = true;
      if (r.method !== req.method) continue;
      match = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]])) };
      break;
    }
    if (!match) throw new GameError(allowed ? 'Méthode non autorisée.' : 'Route inconnue.', allowed ? 405 : 404);
    let body = {};
    if (req.method === 'POST') {
      // Exiger du JSON bloque les formulaires cross-site (protection CSRF avec SameSite=Lax).
      if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new GameError('JSON attendu.', 415);
      const raw = await readBody(req);
      try { body = raw ? JSON.parse(raw) : {}; } catch { throw new GameError('JSON invalide.'); }
      if (typeof body !== 'object' || body === null) body = {};
    }
    const c = match.r.db ? await getContext(db) : null;
    const me = c ? await getUser(c.db, req) : null;
    if (match.r.auth && !me) throw new GameError('Connecte-toi pour continuer.', 401);
    const query = Object.fromEntries(url.searchParams);
    const data = await match.r.handler({ c, req, res, me, body, query, params: match.params });
    sendJson(req, res, 200, data);
    // Les bots avancent pendant que de vrais joueurs sont connectés (après la réponse, sans la ralentir).
    if (me && c && !me.is_bot) {
      const work = runBots(c.db, c.game).catch((e) => console.error('bots', e.message));
      if (process.env.VERCEL) waitUntil(work);
    }
  } catch (e) {
    if (!(e instanceof GameError)) console.error(e);
    const status = e instanceof GameError ? e.status : e.code === '23514' ? 400 : 500;
    sendJson(req, res, status, {
      error: e instanceof GameError ? e.message : status === 400 ? 'Pas assez de bits.' : e.code === '53100' ? 'Base de données pleine : contacte l\'admin.' : 'Erreur serveur.',
      ...(status >= 500 && !(e instanceof GameError) ? { detail: String(e.message || e).slice(0, 300), code: e.code } : {}),
    });
  }
}
