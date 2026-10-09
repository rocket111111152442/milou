// Règles du jeu : boosters, cartes, dex, échanges, enchères, amis (Postgres, sûr en concurrence).
import { randomInt } from 'node:crypto';
import { RARITIES } from './sites.js';

export const CONFIG = {
  packInterval: 3 * 60 * 1000, // un booster toutes les 3 minutes
  packCap: 10,                 // stock max accumulé hors ligne
  packSize: 5,
  startBits: 150,
  startPacks: 3,
  premiumPrice: 300,
  holoChance: 100,             // sur 10 000 (1 %)
  premiumHoloChance: 300,      // 3 %
  holoMultiplier: 5,
  auctionFee: 0.05,
  auctionHours: [1, 3, 6, 12, 24, 72],
  maxOpenAuctions: 20,
  maxTradeCards: 10,
  maxPendingTrades: 20,
  dailyBase: 30,
  dailyStep: 10,
  dailyMaxStreak: 7,
};

export class GameError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const DAY = 24 * 3600 * 1000;

export async function createGame(db) {
  const row = await db.one("SELECT value FROM meta WHERE key = 'tiers'");
  if (!row) throw new GameError('Le classement des sites n\'est pas encore importé.', 503);
  const tiers = JSON.parse(row.value).map((t) => ({ ...RARITIES[t.id], ...t }));
  const totalSites = tiers.reduce((a, t) => a + t.total, 0);
  const tierOf = (siteId) => tiers.find((t) => siteId >= t.lo && siteId <= t.hi);

  const value = (rarity, holo) => RARITIES[rarity].value * (holo ? CONFIG.holoMultiplier : 1);

  // Les bots ne reçoivent pas de notifications (économie de stockage).
  const notify = (q, userId, text, link = null) =>
    q.run('INSERT INTO notifications (user_id, text, link, created_at) SELECT $1, $2, $3, $4 FROM users WHERE id = $1 AND NOT is_bot', [userId, text, link, Date.now()]);

  // Débit conditionnel : impossible de passer en négatif même avec des requêtes simultanées.
  async function debit(q, userId, amount, msg = 'Pas assez de bits.') {
    if (amount <= 0) return;
    if (!(await q.run('UPDATE users SET bits = bits - $1 WHERE id = $2 AND bits >= $1', [amount, userId]))) throw new GameError(msg);
  }
  const credit = (q, userId, amount) => amount > 0 && q.run('UPDATE users SET bits = bits + $1 WHERE id = $2', [amount, userId]);

  // Fil « En direct » : grosses ouvertures, ventes, échanges, arrivées.
  const logEvent = (q, kind, userId, { other = null, siteId = null, holo = 0, amount = null } = {}) =>
    q.run('INSERT INTO events (at, kind, user_id, other_id, site_id, holo, amount) VALUES ($1, $2, $3, $4, $5, $6, $7)', [Date.now(), kind, userId, other, siteId, holo ? 1 : 0, amount]);

  // Un bot sollicité par quelqu'un « passe voir » dans les minutes qui suivent, comme un vrai joueur.
  const wakeBot = (q, userId) => q.run('UPDATE users SET bot_next_at = LEAST(bot_next_at, $1) WHERE id = $2 AND is_bot',
    [Date.now() + (1 + randomInt(9)) * 60_000, userId]);

  async function discover(q, userId, siteId, now = Date.now()) {
    // Pas de pokédex détaillé pour les bots : seuls leurs compteurs bougent (voir drawCards).
    const r = await q.run('INSERT INTO dex (user_id, site_id, found_at) SELECT $1, $2, $3 FROM users WHERE id = $1 AND NOT is_bot ON CONFLICT DO NOTHING', [userId, siteId, now]);
    if (!r) return false;
    await q.run('UPDATE users SET dex_score = dex_score + $1, dex_count = dex_count + 1 WHERE id = $2', [tierOf(siteId).value, userId]);
    return true;
  }

  // ---------- Boosters (chrono calculé côté serveur : tourne même app fermée) ----------
  function packState(u, now = Date.now()) {
    const gained = Math.floor((now - u.pack_anchor) / CONFIG.packInterval);
    // Les boosters offerts par un admin peuvent dépasser le plafond.
    const available = Math.max(u.pack_stock, Math.min(CONFIG.packCap, u.pack_stock + gained));
    const nextAt = available >= CONFIG.packCap ? null : u.pack_anchor + (gained + 1) * CONFIG.packInterval;
    return { available, cap: CONFIG.packCap, interval: CONFIG.packInterval, nextAt, gained };
  }

  function rollTier(minRarity) {
    const pool = tiers.filter((t) => t.id >= minRarity && t.total > 0);
    const sum = pool.reduce((a, t) => a + t.weight, 0);
    let x = randomInt(sum);
    for (const t of pool) { if ((x -= t.weight) < 0) return t; }
    return pool[0];
  }

  async function drawCards(q, userId, premium, isBot = false) {
    const now = Date.now();
    const picks = [];
    for (let i = 0; i < CONFIG.packSize; i++) {
      const last = i === CONFIG.packSize - 1;
      const tier = rollTier(premium ? (last ? 2 : 1) : (last ? 1 : 0)); // 5e carte Peu commune+ (Rare+ en premium)
      picks.push({
        siteId: tier.lo + randomInt(tier.hi - tier.lo + 1),
        holo: randomInt(10000) < (premium ? CONFIG.premiumHoloChance : CONFIG.holoChance) ? 1 : 0,
      });
    }
    const sites = await q.all('SELECT id, domain, rarity, family FROM sites WHERE id = ANY($1::int[])', [picks.map((p) => p.siteId)]);
    const byId = new Map(sites.map((s) => [s.id, s]));
    const ownedBefore = isBot
      ? new Set((await q.all('SELECT DISTINCT site_id FROM cards WHERE user_id = $1 AND site_id = ANY($2::int[])', [userId, picks.map((p) => p.siteId)])).map((r) => r.site_id))
      : null;
    const ids = await q.all(`INSERT INTO cards (user_id, site_id, holo, obtained_at)
      SELECT $1, s, h, $4 FROM unnest($2::int[], $3::smallint[]) AS x(s, h) RETURNING id`, [userId, picks.map((p) => p.siteId), picks.map((p) => p.holo), now]);
    const out = [];
    for (let i = 0; i < picks.length; i++) {
      let isNew;
      if (isBot) {
        isNew = !ownedBefore.has(picks[i].siteId);
        ownedBefore.add(picks[i].siteId);
        if (isNew) await q.run('UPDATE users SET dex_score = dex_score + $1, dex_count = dex_count + 1 WHERE id = $2', [tierOf(picks[i].siteId).value, userId]);
      } else {
        isNew = await discover(q, userId, picks[i].siteId, now);
      }
      out.push({ cardId: ids[i].id, holo: picks[i].holo, isNew, site: byId.get(picks[i].siteId) });
      const r = byId.get(picks[i].siteId).rarity;
      if (r >= 3 || (r >= 2 && !isBot) || picks[i].holo) await logEvent(q, 'pull', userId, { siteId: picks[i].siteId, holo: picks[i].holo });
    }
    await q.run('UPDATE users SET packs_opened = packs_opened + 1 WHERE id = $1', [userId]);
    return out;
  }

  function openPack(userId, kind, { free = false } = {}) {
    return db.tx(async (q) => {
      const u = await q.one('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
      // Admin : boosters illimités, sans toucher au stock ni aux bits.
      if (free && u.is_admin) return drawCards(q, userId, kind === 'premium', false);
      if (kind === 'premium') {
        await debit(q, userId, CONFIG.premiumPrice, `Il te faut ${CONFIG.premiumPrice} bits.`);
        return drawCards(q, userId, true, u.is_bot);
      }
      const now = Date.now();
      const st = packState(u, now);
      if (st.available < 1) throw new GameError('Aucun booster disponible, patiente encore un peu.');
      const full = u.pack_stock + st.gained >= CONFIG.packCap;
      const anchor = full ? now : u.pack_anchor + st.gained * CONFIG.packInterval;
      await q.run('UPDATE users SET pack_stock = $1, pack_anchor = $2 WHERE id = $3', [st.available - 1, anchor, userId]);
      return drawCards(q, userId, false, u.is_bot);
    });
  }

  // ---------- Bonus quotidien ----------
  function dailyState(u, now = Date.now()) {
    const nextAt = u.daily_at + 20 * 3600 * 1000;
    const streak = now - u.daily_at < 2 * DAY ? u.daily_streak : 0;
    const nextStreak = Math.min(CONFIG.dailyMaxStreak, streak + 1);
    return { available: now >= nextAt, nextAt, streak, reward: CONFIG.dailyBase + CONFIG.dailyStep * (nextStreak - 1) };
  }

  function claimDaily(userId) {
    return db.tx(async (q) => {
      const u = await q.one('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const st = dailyState(u);
      if (!st.available) throw new GameError('Bonus déjà récupéré, reviens plus tard.');
      const streak = Math.min(CONFIG.dailyMaxStreak, st.streak + 1);
      await q.run('UPDATE users SET bits = bits + $1, daily_at = $2, daily_streak = $3 WHERE id = $4', [st.reward, Date.now(), streak, userId]);
      return { reward: st.reward, streak };
    });
  }

  // ---------- Recyclage ----------
  function recycle(userId, cardIds) {
    if (!Array.isArray(cardIds) || !cardIds.length || cardIds.length > 500) throw new GameError('Sélection invalide.');
    const ids = cardIds.map(Number).filter(Number.isInteger);
    return db.tx(async (q) => {
      const gone = await q.all(`DELETE FROM cards c USING sites s WHERE s.id = c.site_id AND c.id = ANY($1::int[])
        AND c.user_id = $2 AND c.status = 'owned' RETURNING c.holo, s.rarity`, [ids, userId]);
      if (!gone.length) throw new GameError('Aucune carte recyclable.');
      const gained = gone.reduce((a, c) => a + value(c.rarity, c.holo), 0);
      await credit(q, userId, gained);
      return { gained, count: gone.length };
    });
  }

  // Recycle les doublons non holo jusqu'à une rareté donnée en gardant toujours un exemplaire.
  async function recycleDuplicates(userId, maxRarity) {
    const max = Math.max(0, Math.min(5, Number(maxRarity) || 0));
    const rows = await db.all(`SELECT c.site_id, array_agg(c.id ORDER BY c.id) ids,
        EXISTS (SELECT 1 FROM cards h WHERE h.user_id = c.user_id AND h.site_id = c.site_id AND h.holo = 1) has_holo
      FROM cards c WHERE c.user_id = $1 AND c.status = 'owned' AND c.holo = 0 AND c.site_id >= $2
      GROUP BY c.user_id, c.site_id`, [userId, tiers[max].lo]);
    const ids = [];
    for (const r of rows) ids.push(...(r.has_holo ? r.ids : r.ids.slice(1)));
    if (!ids.length) throw new GameError('Aucun doublon à recycler.');
    return recycle(userId, ids.slice(0, 500));
  }

  // ---------- Amis ----------
  async function relation(q, a, b) {
    const rows = await q.all('SELECT user_id, status FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)', [a, b]);
    const ab = rows.find((r) => r.user_id === a);
    const ba = rows.find((r) => r.user_id === b);
    if (ab?.status === 'accepted') return 'friends';
    if (ab) return 'sent';
    if (ba) return 'received';
    return 'none';
  }

  async function requestFriend(me, username) {
    const target = await db.one('SELECT id, username FROM users WHERE lower(username) = lower($1)', [String(username || '').trim()]);
    if (!target) throw new GameError('Joueur introuvable.', 404);
    if (target.id === me.id) throw new GameError("Tu ne peux pas t'ajouter toi-même.");
    return db.tx(async (q) => {
      const rel = await relation(q, me.id, target.id);
      if (rel === 'friends') throw new GameError('Vous êtes déjà amis.');
      if (rel === 'sent') throw new GameError('Demande déjà envoyée.');
      if (rel === 'received') return acceptFriendTx(q, me, target.id);
      await q.run("INSERT INTO friends (user_id, friend_id, status, created_at) VALUES ($1, $2, 'pending', $3) ON CONFLICT DO NOTHING", [me.id, target.id, Date.now()]);
      await wakeBot(q, target.id);
      await notify(q, target.id, `${me.username} veut devenir ton ami.`, '#/social');
      return { status: 'sent' };
    });
  }

  async function acceptFriendTx(q, me, otherId) {
    const r = await q.run("UPDATE friends SET status = 'accepted' WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'", [otherId, me.id]);
    if (!r) throw new GameError('Aucune demande de ce joueur.');
    await q.run(`INSERT INTO friends (user_id, friend_id, status, created_at) VALUES ($1, $2, 'accepted', $3)
      ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`, [me.id, otherId, Date.now()]);
    await notify(q, otherId, `${me.username} a accepté ta demande d'ami.`, '#/social');
    return { status: 'friends' };
  }

  function respondFriend(me, otherId, accept) {
    otherId = Number(otherId);
    return db.tx(async (q) => {
      if (accept) return acceptFriendTx(q, me, otherId);
      await q.run("DELETE FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'", [otherId, me.id]);
      return { status: 'none' };
    });
  }

  async function removeFriend(me, otherId) {
    otherId = Number(otherId);
    await db.run('DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)', [me.id, otherId]);
    return { status: 'none' };
  }

  async function listFriends(meId) {
    const sel = 'SELECT u.id, u.username, u.dex_count, u.dex_score, u.last_seen, u.avatar_site, s.domain avatar_domain FROM users u LEFT JOIN sites s ON s.id = u.avatar_site';
    const [friends, incoming, outgoing] = await Promise.all([
      db.all(`${sel} JOIN friends f ON f.friend_id = u.id WHERE f.user_id = $1 AND f.status = 'accepted' ORDER BY u.last_seen DESC`, [meId]),
      db.all(`${sel} JOIN friends f ON f.user_id = u.id WHERE f.friend_id = $1 AND f.status = 'pending' ORDER BY f.created_at DESC`, [meId]),
      db.all(`${sel} JOIN friends f ON f.friend_id = u.id WHERE f.user_id = $1 AND f.status = 'pending' ORDER BY f.created_at DESC`, [meId]),
    ]);
    return { friends, incoming, outgoing };
  }

  // ---------- Échanges ----------
  async function createTrade(me, body) {
    const toId = Number(body.toUserId);
    const offer = [...new Set((body.offerCards || []).map(Number))];
    const request = [...new Set((body.requestCards || []).map(Number))];
    const offerBits = Math.max(0, Math.floor(Number(body.offerBits) || 0));
    const requestBits = Math.max(0, Math.floor(Number(body.requestBits) || 0));
    if (offer.length > CONFIG.maxTradeCards || request.length > CONFIG.maxTradeCards) throw new GameError(`Maximum ${CONFIG.maxTradeCards} cartes de chaque côté.`);
    if (!offer.length && !request.length && !offerBits && !requestBits) throw new GameError('Échange vide.');
    return db.tx(async (q) => {
      if ((await relation(q, me.id, toId)) !== 'friends') throw new GameError('Tu ne peux échanger qu\'avec tes amis.');
      const pending = (await q.one("SELECT COUNT(*) n FROM trades WHERE from_id = $1 AND status = 'pending'", [me.id])).n;
      if (pending >= CONFIG.maxPendingTrades) throw new GameError('Trop de propositions en attente.');
      if (offerBits > (await q.one('SELECT bits FROM users WHERE id = $1', [me.id])).bits) throw new GameError('Pas assez de bits.');
      const owned = async (ids, uid) => ids.length === 0 ||
        (await q.one("SELECT COUNT(*) n FROM cards WHERE id = ANY($1::int[]) AND user_id = $2 AND status = 'owned'", [ids, uid])).n === ids.length;
      if (!(await owned(offer, me.id))) throw new GameError('Une de tes cartes n\'est plus disponible.');
      if (!(await owned(request, toId))) throw new GameError('Une des cartes demandées n\'est plus disponible.');
      const message = String(body.message || '').slice(0, 200) || null;
      const { id } = await q.one('INSERT INTO trades (from_id, to_id, offer_bits, request_bits, message, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [me.id, toId, offerBits, requestBits, message, Date.now()]);
      const items = [...offer.map((c) => [c, 'offer']), ...request.map((c) => [c, 'request'])];
      if (items.length) await q.run('INSERT INTO trade_items (trade_id, card_id, side) SELECT $1, c, s FROM unnest($2::int[], $3::text[]) AS x(c, s)', [id, items.map((i) => i[0]), items.map((i) => i[1])]);
      await notify(q, toId, `${me.username} te propose un échange.`, '#/social?tab=trades');
      await wakeBot(q, toId);
      return { id };
    });
  }

  async function tradeDetails(q, list) {
    if (!list.length) return [];
    const items = await q.all(`SELECT ti.trade_id, ti.card_id, ti.side, c.holo, c.user_id, c.status, s.id site_id, s.domain, s.rarity, s.family
      FROM trade_items ti LEFT JOIN cards c ON c.id = ti.card_id LEFT JOIN sites s ON s.id = c.site_id WHERE ti.trade_id = ANY($1::int[])`, [list.map((t) => t.id)]);
    return list.map((t) => ({
      ...t,
      offer: items.filter((i) => i.trade_id === t.id && i.side === 'offer'),
      request: items.filter((i) => i.trade_id === t.id && i.side === 'request'),
    }));
  }

  async function listTrades(meId) {
    const sel = `SELECT t.*, uf.username from_name, ut.username to_name FROM trades t
      JOIN users uf ON uf.id = t.from_id JOIN users ut ON ut.id = t.to_id WHERE (t.from_id = $1 OR t.to_id = $1)`;
    const [active, history] = await Promise.all([
      db.all(`${sel} AND t.status = 'pending' ORDER BY t.id DESC LIMIT 50`, [meId]),
      db.all(`${sel} AND t.status != 'pending' ORDER BY t.id DESC LIMIT 20`, [meId]),
    ]);
    return { active: await tradeDetails(db, active), history: await tradeDetails(db, history) };
  }

  async function resolveTrade(me, tradeId, action) {
    const res = await db.tx(async (q) => {
      const t = await q.one('SELECT * FROM trades WHERE id = $1 FOR UPDATE', [Number(tradeId)]);
      if (!t || t.status !== 'pending') throw new GameError('Échange introuvable ou terminé.', 404);
      const now = Date.now();
      if (action === 'cancel') {
        if (t.from_id !== me.id) throw new GameError('Action interdite.', 403);
        await q.run("UPDATE trades SET status = 'cancelled', resolved_at = $1 WHERE id = $2", [now, t.id]);
        return { status: 'cancelled' };
      }
      if (t.to_id !== me.id) throw new GameError('Action interdite.', 403);
      if (action === 'decline') {
        await q.run("UPDATE trades SET status = 'declined', resolved_at = $1 WHERE id = $2", [now, t.id]);
        await notify(q, t.from_id, `${me.username} a refusé ton échange.`, '#/social?tab=trades');
        return { status: 'declined' };
      }
      // Verrouille les deux joueurs (ordre fixe = pas d'interblocage) et les cartes concernées.
      await q.all('SELECT id FROM users WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [[t.from_id, t.to_id]]);
      const [d] = await tradeDetails(q, [t]);
      const cardIds = [...d.offer, ...d.request].map((i) => i.card_id);
      if (cardIds.length) await q.all('SELECT id FROM cards WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [cardIds]);
      const [d2] = await tradeDetails(q, [t]);
      const bits = Object.fromEntries((await q.all('SELECT id, bits FROM users WHERE id = ANY($1::int[])', [[t.from_id, t.to_id]])).map((u) => [u.id, u.bits]));
      if (bits[t.to_id] < t.request_bits) throw new GameError('Tu n\'as pas assez de bits.');
      let invalid = null;
      if (bits[t.from_id] < t.offer_bits) invalid = 'Ton ami n\'a plus assez de bits.';
      else if (d2.offer.some((i) => i.user_id !== t.from_id || i.status !== 'owned')) invalid = 'Une carte proposée n\'est plus disponible.';
      else if (d2.request.some((i) => i.user_id !== t.to_id || i.status !== 'owned')) invalid = 'Une de tes cartes demandées n\'est plus disponible.';
      if (invalid) {
        await q.run("UPDATE trades SET status = 'invalid', resolved_at = $1 WHERE id = $2", [now, t.id]);
        return { status: 'invalid', error: invalid + ' Échange annulé.' };
      }
      for (const i of d2.offer) {
        await q.run('UPDATE cards SET user_id = $1, obtained_at = $2 WHERE id = $3', [t.to_id, now, i.card_id]);
        await discover(q, t.to_id, i.site_id, now);
      }
      for (const i of d2.request) {
        await q.run('UPDATE cards SET user_id = $1, obtained_at = $2 WHERE id = $3', [t.from_id, now, i.card_id]);
        await discover(q, t.from_id, i.site_id, now);
      }
      await q.run('UPDATE users SET bits = bits - $1 + $2 WHERE id = $3', [t.offer_bits, t.request_bits, t.from_id]);
      await q.run('UPDATE users SET bits = bits + $1 - $2 WHERE id = $3', [t.offer_bits, t.request_bits, t.to_id]);
      await q.run("UPDATE trades SET status = 'accepted', resolved_at = $1 WHERE id = $2", [now, t.id]);
      await notify(q, t.from_id, `${me.username} a accepté ton échange !`, '#/social?tab=trades');
      await logEvent(q, 'trade', t.from_id, { other: t.to_id, amount: d2.offer.length + d2.request.length });
      return { status: 'accepted' };
    });
    if (res.error) throw new GameError(res.error, 409);
    return res;
  }

  // ---------- Enchères ----------
  const minBid = (a) => (a.current_bid == null ? a.start_price : a.current_bid + Math.max(1, Math.ceil(a.current_bid * 0.05)));

  function createAuction(me, body) {
    const cardId = Number(body.cardId);
    const start = Math.floor(Number(body.startPrice));
    const buyout = body.buyout ? Math.floor(Number(body.buyout)) : null;
    const hours = Number(body.hours);
    if (!CONFIG.auctionHours.includes(hours)) throw new GameError('Durée invalide.');
    if (!(start >= 1 && start <= 10_000_000)) throw new GameError('Prix de départ invalide.');
    if (buyout != null && !(buyout > start && buyout <= 10_000_000)) throw new GameError('Le prix d\'achat immédiat doit dépasser le prix de départ.');
    return db.tx(async (q) => {
      const open = (await q.one("SELECT COUNT(*) n FROM auctions WHERE seller_id = $1 AND status = 'open'", [me.id])).n;
      if (open >= CONFIG.maxOpenAuctions) throw new GameError('Trop d\'enchères en cours.');
      const c = await q.one("UPDATE cards SET status = 'auction' WHERE id = $1 AND user_id = $2 AND status = 'owned' RETURNING id, site_id", [cardId, me.id]);
      if (!c) throw new GameError('Carte indisponible.');
      const now = Date.now();
      return q.one('INSERT INTO auctions (seller_id, card_id, site_id, start_price, buyout, ends_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [me.id, c.id, c.site_id, start, buyout, now + hours * 3600e3, now]);
    });
  }

  function bid(me, auctionId, amount, isBuyout = false) {
    return db.tx(async (q) => {
      const a = await q.one('SELECT a.*, s.domain FROM auctions a JOIN sites s ON s.id = a.site_id WHERE a.id = $1 FOR UPDATE OF a', [Number(auctionId)]);
      const now = Date.now();
      if (!a || a.status !== 'open' || a.ends_at <= now) throw new GameError('Enchère terminée.', 409);
      if (a.seller_id === me.id) throw new GameError('Tu ne peux pas enchérir sur ta propre carte.');
      if (isBuyout) {
        if (!a.buyout) throw new GameError('Pas d\'achat immédiat sur cette enchère.');
        amount = a.buyout;
      } else {
        amount = Math.floor(Number(amount));
        if (a.bidder_id === me.id) throw new GameError('Tu es déjà le meilleur enchérisseur.');
        if (!(amount >= minBid(a))) throw new GameError(`Enchère minimum : ${minBid(a)} bits.`);
        if (a.buyout && amount >= a.buyout) { amount = a.buyout; isBuyout = true; }
      }
      // Si on mène déjà (achat immédiat), on ne repaie que la différence.
      const already = a.bidder_id === me.id ? a.current_bid : 0;
      await debit(q, me.id, amount - already);
      if (a.bidder_id && a.bidder_id !== me.id) {
        await credit(q, a.bidder_id, a.current_bid);
        await notify(q, a.bidder_id, `Ton enchère sur ${a.domain} a été dépassée.`, '#/market?scope=bids');
      }
      const endsAt = isBuyout ? now : Math.max(a.ends_at, now + 60_000); // anti-snipe
      await q.run('UPDATE auctions SET current_bid = $1, bidder_id = $2, bid_count = bid_count + 1, ends_at = $3 WHERE id = $4', [amount, me.id, endsAt, a.id]);
      if (isBuyout) await settleOne(q, a.id, now);
      return { ok: true, amount, bought: isBuyout };
    });
  }

  function cancelAuction(me, auctionId) {
    return db.tx(async (q) => {
      const a = await q.one('SELECT * FROM auctions WHERE id = $1 FOR UPDATE', [Number(auctionId)]);
      if (!a || a.seller_id !== me.id || a.status !== 'open') throw new GameError('Enchère introuvable.', 404);
      if (a.bidder_id) throw new GameError('Impossible d\'annuler : il y a déjà une enchère.');
      await q.run("UPDATE auctions SET status = 'cancelled' WHERE id = $1", [a.id]);
      await q.run("UPDATE cards SET status = 'owned' WHERE id = $1", [a.card_id]);
      return { ok: true };
    });
  }

  async function settleOne(q, id, now) {
    const a = await q.one('SELECT a.*, s.domain FROM auctions a JOIN sites s ON s.id = a.site_id WHERE a.id = $1', [id]);
    if (!a || a.status !== 'open') return;
    if (a.bidder_id) {
      const fee = Math.floor(a.current_bid * CONFIG.auctionFee);
      await q.run("UPDATE cards SET user_id = $1, status = 'owned', obtained_at = $2 WHERE id = $3", [a.bidder_id, now, a.card_id]);
      await credit(q, a.seller_id, a.current_bid - fee);
      await q.run("UPDATE auctions SET status = 'sold', ends_at = LEAST(ends_at, $1) WHERE id = $2", [now, a.id]);
      await discover(q, a.bidder_id, a.site_id, now);
      await notify(q, a.seller_id, `${a.domain} vendu ${a.current_bid} bits (−${fee} de commission).`, '#/market?scope=mine');
      await logEvent(q, 'sold', a.bidder_id, { other: a.seller_id, siteId: a.site_id, amount: a.current_bid });
      await notify(q, a.bidder_id, `Tu as remporté ${a.domain} pour ${a.current_bid} bits !`, '#/collection');
    } else {
      await q.run("UPDATE cards SET status = 'owned' WHERE id = $1", [a.card_id]);
      await q.run("UPDATE auctions SET status = 'expired' WHERE id = $1", [a.id]);
      await notify(q, a.seller_id, `Personne n'a enchéri sur ${a.domain}. La carte est revenue dans ta collection.`, '#/collection');
    }
  }

  // Pas de tâche de fond en serverless : les enchères échues sont clôturées à la volée par les requêtes.
  async function settleAuctions() {
    const now = Date.now();
    const due = await db.one("SELECT 1 FROM auctions WHERE status = 'open' AND ends_at <= $1 LIMIT 1", [now]);
    if (!due) return 0;
    return db.tx(async (q) => {
      const rows = await q.all("SELECT id FROM auctions WHERE status = 'open' AND ends_at <= $1 ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED", [now]);
      for (const { id } of rows) await settleOne(q, id, now);
      return rows.length;
    });
  }

  async function listAuctions(meId, { scope = 'all', rarity, q: search, sort = 'ending' } = {}) {
    await settleAuctions();
    const where = [];
    const args = [];
    const p = (v) => { args.push(v); return '$' + args.length; };
    if (scope === 'mine') where.push(`a.seller_id = ${p(meId)}`, `(a.status = 'open' OR a.created_at > ${p(Date.now() - 3 * DAY)})`);
    else if (scope === 'bids') where.push(`a.bidder_id = ${p(meId)}`, `(a.status = 'open' OR a.ends_at > ${p(Date.now() - 3 * DAY)})`);
    else where.push("a.status = 'open'");
    if (rarity !== undefined && rarity !== '') where.push(`s.rarity = ${p(Number(rarity))}`);
    if (search) where.push(`s.domain LIKE ${p('%' + String(search).toLowerCase().replace(/[%_\\]/g, '') + '%')}`);
    const order = { ending: "a.status = 'open' DESC, a.ends_at ASC", new: 'a.id DESC', price: 'COALESCE(a.current_bid, a.start_price) ASC', rarity: 's.rarity DESC, a.ends_at ASC' }[sort] || 'a.ends_at ASC';
    const rows = await db.all(`SELECT a.id, a.card_id, a.start_price, a.buyout, a.current_bid, a.bid_count, a.ends_at, a.status, a.seller_id, a.bidder_id,
        c.holo, s.id site_id, s.domain, s.rarity, s.family, us.username seller, ub.username bidder
      FROM auctions a JOIN sites s ON s.id = a.site_id JOIN cards c ON c.id = a.card_id
      JOIN users us ON us.id = a.seller_id LEFT JOIN users ub ON ub.id = a.bidder_id
      WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 80`, args);
    return rows.map((a) => ({ ...a, min_bid: minBid(a) }));
  }

  return {
    db, minBid, drawCards, debit, credit, discover, logEvent,
    tiers, totalSites, tierOf, value, notify, packState, openPack, dailyState, claimDaily, recycle, recycleDuplicates,
    relation, requestFriend, respondFriend, removeFriend, listFriends,
    createTrade, listTrades, resolveTrade,
    createAuction, bid, cancelAuction, settleAuctions, listAuctions,
  };
}
