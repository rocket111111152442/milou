// Serveur Netdex : Node.js pur (aucune dépendance), SQLite intégré, fichiers statiques en mémoire.
import http from 'node:http';
import { randomBytes, createHash, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { openDb, withStatementCache } from './db.js';
import { importSites, loadTrancoCsv, RARITIES } from './sites.js';
import { createGame, CONFIG, GameError } from './game.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || join(ROOT, 'data', 'netdex.db');
const SESSION_DAYS = 60;
const scrypt = promisify(scryptCb);

const db = withStatementCache(openDb(DB_FILE));

if (!db.q('SELECT COUNT(*) n FROM sites').get().n) {
  console.log('Import du classement des sites (Tranco top 1M)…');
  const csv = await loadTrancoCsv(process.env.TRANCO_FILE);
  console.log(`${importSites(db, csv)} sites importés.`);
}
const game = createGame(db);
console.log(`${game.totalSites} sites en jeu :`, game.tiers.map((t) => `${t.name} ${t.total}`).join(', '));

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
const sha = (s) => createHash('sha256').update(s).digest('hex');

function createSession(res, req, userId) {
  const token = randomBytes(32).toString('base64url');
  db.q('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha(token), userId, Date.now() + SESSION_DAYS * 86400e3);
  setCookie(res, req, token, SESSION_DAYS * 86400);
}
function setCookie(res, req, value, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  res.setHeader('Set-Cookie', `nd_sid=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}
function getUser(req) {
  const m = /(?:^|;\s*)nd_sid=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const u = db.q('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').get(sha(m[1]), Date.now());
  if (u && Date.now() - u.last_seen > 60_000) db.q('UPDATE users SET last_seen = ? WHERE id = ?').run(Date.now(), u.id);
  return u || null;
}

// Limiteur simple par IP pour l'authentification.
const hits = new Map();
function rateLimit(req, key, max, windowMs) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  const k = key + ip;
  const now = Date.now();
  const h = hits.get(k);
  if (!h || h.reset < now) { hits.set(k, { n: 1, reset: now + windowMs }); return; }
  if (++h.n > max) throw new GameError('Trop de tentatives, réessaie dans une minute.', 429);
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, 60_000).unref();

// ---------- Vues ----------
function meView(u) {
  const now = Date.now();
  return {
    user: { id: u.id, username: u.username, bits: u.bits, dexCount: u.dex_count, dexScore: u.dex_score, packsOpened: u.packs_opened, avatarSite: u.avatar_site, createdAt: u.created_at },
    packs: game.packState(u, now),
    daily: game.dailyState(u, now),
    counts: {
      notifications: db.q('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read = 0').get(u.id).n,
      trades: db.q("SELECT COUNT(*) n FROM trades WHERE to_id = ? AND status = 'pending'").get(u.id).n,
      friendRequests: db.q("SELECT COUNT(*) n FROM friends WHERE friend_id = ? AND status = 'pending'").get(u.id).n,
    },
    config: { premiumPrice: CONFIG.premiumPrice, holoMultiplier: CONFIG.holoMultiplier, auctionHours: CONFIG.auctionHours, auctionFee: CONFIG.auctionFee, maxTradeCards: CONFIG.maxTradeCards, totalSites: game.totalSites },
    serverTime: now,
  };
}

const COLLECTION_SORT = {
  rarity: 's.rarity DESC, s.id ASC',
  recent: 'last DESC',
  name: 's.domain ASC',
  count: 'n DESC, s.rarity DESC',
  rank: 's.id ASC',
};

function collection(userId, query) {
  const where = ['c.user_id = ?'];
  const args = [userId];
  if (query.rarity !== undefined && query.rarity !== '') { where.push('s.rarity = ?'); args.push(Number(query.rarity)); }
  if (query.q) { where.push('s.domain LIKE ?'); args.push('%' + String(query.q).toLowerCase().replace(/[%_]/g, '') + '%'); }
  const having = query.dupes === '1' ? 'HAVING n > 1' : query.holo === '1' ? 'HAVING holo > 0' : '';
  const limit = Math.min(200, Number(query.limit) || 120);
  const offset = Math.max(0, Number(query.offset) || 0);
  const rows = db.q(`SELECT s.id, s.domain, s.rarity, s.family, COUNT(*) n, SUM(c.holo) holo, MAX(c.obtained_at) last,
      GROUP_CONCAT(CASE WHEN c.status = 'owned' THEN c.id || CASE WHEN c.holo THEN 'h' ELSE '' END END) cards
    FROM cards c JOIN sites s ON s.id = c.site_id WHERE ${where.join(' AND ')}
    GROUP BY s.id ${having} ORDER BY ${COLLECTION_SORT[query.sort] || COLLECTION_SORT.rarity} LIMIT ? OFFSET ?`).all(...args, limit + 1, offset);
  return { items: rows.slice(0, limit), more: rows.length > limit };
}

function stats(userId) {
  const owned = db.q("SELECT COUNT(*) n, COUNT(DISTINCT site_id) d FROM cards WHERE user_id = ?").get(userId);
  const byRarity = db.q('SELECT s.rarity, COUNT(*) n FROM dex d JOIN sites s ON s.id = d.site_id WHERE d.user_id = ? GROUP BY s.rarity').all(userId);
  const found = Object.fromEntries(byRarity.map((r) => [r.rarity, r.n]));
  return {
    cards: owned.n, distinct: owned.d,
    tiers: game.tiers.map((t) => ({ id: t.id, name: t.name, key: t.key, total: t.total, lo: t.lo, hi: t.hi, found: found[t.id] || 0, value: t.value, chance: t.weight / 100 })),
  };
}

function publicProfile(meId, name) {
  const u = db.q('SELECT u.*, s.domain avatar_domain FROM users u LEFT JOIN sites s ON s.id = u.avatar_site WHERE u.username = ?').get(name);
  if (!u) throw new GameError('Joueur introuvable.', 404);
  const best = db.q(`SELECT s.id, s.domain, s.rarity, s.family, MAX(c.holo) holo, COUNT(*) n FROM cards c JOIN sites s ON s.id = c.site_id
    WHERE c.user_id = ? GROUP BY s.id ORDER BY s.rarity DESC, s.id ASC LIMIT 12`).all(u.id);
  const rank = db.q('SELECT COUNT(*) + 1 r FROM users WHERE dex_score > ?').get(u.dex_score).r;
  return {
    id: u.id, username: u.username, createdAt: u.created_at, lastSeen: u.last_seen, dexCount: u.dex_count, dexScore: u.dex_score,
    packsOpened: u.packs_opened, avatarSite: u.avatar_site, avatarDomain: u.avatar_domain, rank,
    relation: meId === u.id ? 'self' : game.relation(meId, u.id), best, stats: stats(u.id),
  };
}

function siteInfo(meId, id) {
  const site = db.q('SELECT * FROM sites WHERE id = ?').get(Number(id));
  if (!site) throw new GameError('Site inconnu.', 404);
  const circ = db.q('SELECT COUNT(*) n, SUM(holo) h, COUNT(DISTINCT user_id) owners FROM cards WHERE site_id = ?').get(site.id);
  const mine = db.q('SELECT id, holo, status, obtained_at FROM cards WHERE site_id = ? AND user_id = ? ORDER BY holo DESC, id').all(site.id, meId);
  const owners = db.q(`SELECT u.username, COUNT(*) n, SUM(c.holo) h FROM cards c JOIN users u ON u.id = c.user_id
    WHERE c.site_id = ? GROUP BY c.user_id ORDER BY n DESC LIMIT 15`).all(site.id);
  const found = db.q('SELECT found_at FROM dex WHERE user_id = ? AND site_id = ?').get(meId, site.id);
  return { site, circulation: circ.n, holos: circ.h || 0, owners: circ.owners, ownerList: owners, mine, foundAt: found?.found_at || null, value: RARITIES[site.rarity].value };
}

// ---------- Routes API ----------
const routes = [];
const route = (method, path, handler, opts = {}) => {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, auth: opts.auth !== false });
};

const USERNAME = /^[A-Za-z0-9_.-]{3,20}$/;

route('POST', '/api/register', async ({ req, res, body }) => {
  rateLimit(req, 'reg', 5, 60_000);
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!USERNAME.test(username)) throw new GameError('Pseudo : 3 à 20 caractères (lettres, chiffres, _ . -).');
  if (password.length < 8 || password.length > 200) throw new GameError('Mot de passe : 8 caractères minimum.');
  if (db.q('SELECT 1 FROM users WHERE username = ?').get(username)) throw new GameError('Ce pseudo est déjà pris.', 409);
  const hash = await hashPassword(password);
  const now = Date.now();
  let id;
  try {
    id = Number(db.q('INSERT INTO users (username, pass_hash, created_at, bits, pack_stock, pack_anchor, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(username, hash, now, CONFIG.startBits, CONFIG.startPacks, now, now).lastInsertRowid);
  } catch {
    throw new GameError('Ce pseudo est déjà pris.', 409);
  }
  game.notify(id, `Bienvenue sur Netdex, ${username} ! Tu as ${CONFIG.startPacks} boosters offerts.`, '#/');
  createSession(res, req, id);
  return meView(db.q('SELECT * FROM users WHERE id = ?').get(id));
}, { auth: false });

route('POST', '/api/login', async ({ req, res, body }) => {
  rateLimit(req, 'login', 10, 60_000);
  const u = db.q('SELECT * FROM users WHERE username = ?').get(String(body.username || '').trim());
  if (!u || !(await checkPassword(String(body.password || ''), u.pass_hash))) throw new GameError('Pseudo ou mot de passe incorrect.', 401);
  createSession(res, req, u.id);
  return meView(u);
}, { auth: false });

route('POST', '/api/logout', ({ req, res }) => {
  const m = /(?:^|;\s*)nd_sid=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '');
  if (m) db.q('DELETE FROM sessions WHERE token_hash = ?').run(sha(m[1]));
  setCookie(res, req, '', 0);
  return { ok: true };
}, { auth: false });

route('POST', '/api/account/password', async ({ me, body }) => {
  if (!(await checkPassword(String(body.current || ''), me.pass_hash))) throw new GameError('Mot de passe actuel incorrect.', 401);
  const pw = String(body.password || '');
  if (pw.length < 8 || pw.length > 200) throw new GameError('Mot de passe : 8 caractères minimum.');
  db.q('UPDATE users SET pass_hash = ? WHERE id = ?').run(await hashPassword(pw), me.id);
  return { ok: true };
});

route('POST', '/api/account/avatar', ({ me, body }) => {
  const siteId = Number(body.siteId);
  if (!db.q('SELECT 1 FROM cards WHERE user_id = ? AND site_id = ?').get(me.id, siteId)) throw new GameError('Tu dois posséder cette carte.');
  db.q('UPDATE users SET avatar_site = ? WHERE id = ?').run(siteId, me.id);
  return { ok: true };
});

route('GET', '/api/me', ({ me }) => meView(me));
route('POST', '/api/packs/open', ({ me, body }) => ({ cards: game.openPack(me.id, body.kind === 'premium' ? 'premium' : 'free'), me: meView(db.q('SELECT * FROM users WHERE id = ?').get(me.id)) }));
route('POST', '/api/daily', ({ me }) => game.claimDaily(me.id));

route('GET', '/api/collection', ({ me, query }) => {
  const owner = query.user ? db.q('SELECT id FROM users WHERE username = ?').get(query.user) : me;
  if (!owner) throw new GameError('Joueur introuvable.', 404);
  return collection(owner.id, query);
});
route('GET', '/api/stats', ({ me }) => stats(me.id));
route('POST', '/api/cards/recycle', ({ me, body }) => game.recycle(me.id, body.cardIds));
route('POST', '/api/cards/recycle-duplicates', ({ me, body }) => game.recycleDuplicates(me.id, body.maxRarity));

route('GET', '/api/dex', ({ me, query }) => {
  const rarity = Math.max(0, Math.min(5, Number(query.rarity) || 0));
  const offset = Math.max(0, Number(query.offset) || 0);
  const onlyMissing = query.missing === '1';
  const rows = db.q(`SELECT s.id, s.domain, s.rarity, s.family, d.found_at FROM sites s LEFT JOIN dex d ON d.site_id = s.id AND d.user_id = ?
    WHERE s.rarity = ? ${onlyMissing ? 'AND d.found_at IS NULL' : ''} ORDER BY s.id LIMIT 121 OFFSET ?`).all(me.id, rarity, offset);
  return { items: rows.slice(0, 120), more: rows.length > 120 };
});

route('GET', '/api/sites/search', ({ me, query }) => {
  const q = String(query.q || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (q.length < 2) return { items: [] };
  return { items: db.q(`SELECT s.id, s.domain, s.rarity, s.family, d.found_at FROM sites s LEFT JOIN dex d ON d.site_id = s.id AND d.user_id = ?
    WHERE s.domain >= ? AND s.domain < ? ORDER BY s.id LIMIT 30`).all(me.id, q, q + '\uffff') };
});
route('GET', '/api/sites/:id', ({ me, params }) => siteInfo(me.id, params.id));

route('GET', '/api/users/search', ({ me, query }) => {
  const q = String(query.q || '').trim().replace(/[%_]/g, '');
  if (q.length < 2) return { items: [] };
  return { items: db.q('SELECT id, username, dex_count, dex_score FROM users WHERE username LIKE ? AND id != ? ORDER BY dex_score DESC LIMIT 20').all(q + '%', me.id) };
});
route('GET', '/api/users/:name', ({ me, params }) => publicProfile(me.id, decodeURIComponent(params.name)));

route('GET', '/api/leaderboard', ({ me, query }) => {
  const by = query.by === 'count' ? 'dex_count' : query.by === 'packs' ? 'packs_opened' : 'dex_score';
  const scope = query.scope === 'friends'
    ? `WHERE u.id = ? OR u.id IN (SELECT friend_id FROM friends WHERE user_id = ? AND status = 'accepted')` : '';
  const args = query.scope === 'friends' ? [me.id, me.id] : [];
  const items = db.q(`SELECT u.id, u.username, u.dex_score, u.dex_count, u.packs_opened, s.domain avatar_domain FROM users u
    LEFT JOIN sites s ON s.id = u.avatar_site ${scope} ORDER BY u.${by} DESC, u.id ASC LIMIT 100`).all(...args);
  const myRank = db.q(`SELECT COUNT(*) + 1 r FROM users WHERE ${by} > ?`).get(me[by]).r;
  return { items, myRank };
});

route('GET', '/api/friends', ({ me }) => game.listFriends(me.id));
route('POST', '/api/friends/request', ({ me, body }) => game.requestFriend(me, body.username));
route('POST', '/api/friends/respond', ({ me, body }) => game.respondFriend(me, body.userId, !!body.accept));
route('POST', '/api/friends/remove', ({ me, body }) => game.removeFriend(me, body.userId));

route('GET', '/api/trades', ({ me }) => game.listTrades(me.id));
route('POST', '/api/trades', ({ me, body }) => game.createTrade(me, body));
route('POST', '/api/trades/:id/:action', ({ me, params }) => {
  if (!['accept', 'decline', 'cancel'].includes(params.action)) throw new GameError('Action inconnue.', 404);
  return game.resolveTrade(me, params.id, params.action);
});

route('GET', '/api/auctions', ({ me, query }) => ({ items: game.listAuctions(me.id, query) }));
route('POST', '/api/auctions', ({ me, body }) => game.createAuction(me, body));
route('POST', '/api/auctions/:id/bid', ({ me, params, body }) => game.bid(me, params.id, body.amount));
route('POST', '/api/auctions/:id/buyout', ({ me, params }) => game.bid(me, params.id, 0, true));
route('POST', '/api/auctions/:id/cancel', ({ me, params }) => game.cancelAuction(me, params.id));

route('GET', '/api/notifications', ({ me }) => ({ items: db.q('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(me.id) }));
route('POST', '/api/notifications/read', ({ me }) => { db.q('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(me.id); return { ok: true }; });

route('GET', '/api/health', () => ({ ok: true }), { auth: false });

// ---------- Fichiers statiques (préchargés et précompressés) ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const files = new Map();
(function load(dir, base = '') {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { load(full, base + '/' + name); continue; }
    const buf = readFileSync(full);
    const type = TYPES[extname(name)] || 'application/octet-stream';
    const compressible = /text|json|svg|manifest/.test(type);
    files.set(base + '/' + name, {
      buf, type, etag: '"' + sha(buf).slice(0, 16) + '"',
      gz: compressible ? gzipSync(buf, { level: 9 }) : null,
      br: compressible ? brotliCompressSync(buf) : null,
      cache: base.startsWith('/icons') ? 'public, max-age=604800' : 'no-cache',
    });
  }
})(join(ROOT, 'public'));

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https://www.google.com https://*.gstatic.com; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

function serveStatic(req, res, path) {
  const f = files.get(path === '/' ? '/index.html' : path) || (!extname(path) && files.get('/index.html'));
  if (!f) { res.writeHead(404, SECURITY_HEADERS).end('Not found'); return; }
  const headers = { ...SECURITY_HEADERS, 'Content-Type': f.type, ETag: f.etag, 'Cache-Control': f.cache, Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, headers).end(); return; }
  const ae = req.headers['accept-encoding'] || '';
  let body = f.buf;
  if (f.br && ae.includes('br')) { body = f.br; headers['Content-Encoding'] = 'br'; }
  else if (f.gz && ae.includes('gzip')) { body = f.gz; headers['Content-Encoding'] = 'gzip'; }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers).end(req.method === 'HEAD' ? undefined : body);
}

// ---------- Serveur ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 64 * 1024) { reject(new GameError('Requête trop grosse.', 413)); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(req, res, status, data) {
  let body = Buffer.from(JSON.stringify(data));
  const headers = { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (body.length > 1024 && (req.headers['accept-encoding'] || '').includes('gzip')) { body = gzipSync(body, { level: 4 }); headers['Content-Encoding'] = 'gzip'; }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers).end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;
  if (!path.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    serveStatic(req, res, path);
    return;
  }
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
    const me = getUser(req);
    if (match.r.auth && !me) throw new GameError('Connecte-toi pour continuer.', 401);
    const query = Object.fromEntries(url.searchParams);
    const data = await match.r.handler({ req, res, me, body, query, params: match.params });
    sendJson(req, res, 200, data);
  } catch (e) {
    if (!(e instanceof GameError)) console.error(e);
    sendJson(req, res, e instanceof GameError ? e.status : 500, { error: e instanceof GameError ? e.message : 'Erreur serveur.' });
  }
});

setInterval(() => { try { game.settleAuctions(); } catch (e) { console.error(e); } }, 5000).unref();
setInterval(() => db.q('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 3600e3).unref();

server.keepAliveTimeout = 65_000;
server.listen(PORT, () => console.log(`Netdex prêt sur http://localhost:${PORT}`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(); db.close(); process.exit(0); });
