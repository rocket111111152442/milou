// Règles du jeu : boosters, cartes, dex, échanges, enchères, amis.
import { randomInt } from 'node:crypto';
import { RARITIES } from './sites.js';

export const CONFIG = {
  packInterval: 3 * 60 * 1000, // un booster toutes les 3 minutes
  packCap: 10,                 // stock max accumulé hors ligne
  packSize: 5,
  startBits: 150,
  startPacks: 3,
  premiumPrice: 300,
  holoChance: 200,             // sur 10 000 (2 %)
  premiumHoloChance: 600,      // 6 %
  holoMultiplier: 5,
  auctionFee: 0.05,
  auctionHours: [1, 6, 24, 72],
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

export function createGame(db) {
  // Plages d'id par rareté : les id sont des rangs triés, donc chaque palier est contigu.
  const tiers = RARITIES.map((r) => {
    const row = db.q('SELECT MIN(id) lo, MAX(id) hi, COUNT(*) n FROM sites WHERE rarity = ?').get(r.id);
    return { ...r, lo: row.lo, hi: row.hi, total: row.n };
  });
  const totalSites = tiers.reduce((a, t) => a + t.total, 0);

  const value = (rarity, holo) => RARITIES[rarity].value * (holo ? CONFIG.holoMultiplier : 1);

  function notify(userId, text, link = null) {
    db.q('INSERT INTO notifications (user_id, text, link, created_at) VALUES (?, ?, ?, ?)').run(userId, text, link, Date.now());
  }

  // ---------- Boosters (chrono calculé côté serveur : tourne même app fermée) ----------
  function packState(u, now = Date.now()) {
    const gained = Math.floor((now - u.pack_anchor) / CONFIG.packInterval);
    const available = Math.min(CONFIG.packCap, u.pack_stock + gained);
    const nextAt = available >= CONFIG.packCap ? null : u.pack_anchor + (gained + 1) * CONFIG.packInterval;
    return { available, cap: CONFIG.packCap, interval: CONFIG.packInterval, nextAt, gained };
  }

  function rollRarity(minRarity) {
    const pool = tiers.filter((t) => t.id >= minRarity && t.total > 0);
    const sum = pool.reduce((a, t) => a + t.weight, 0);
    let x = randomInt(sum);
    for (const t of pool) { if ((x -= t.weight) < 0) return t; }
    return pool[0];
  }

  function drawCards(userId, premium) {
    const now = Date.now();
    const out = [];
    for (let i = 0; i < CONFIG.packSize; i++) {
      const last = i === CONFIG.packSize - 1;
      const min = premium ? (last ? 3 : 1) : (last ? 2 : 0); // dernière carte garantie Rare+ (Épique+ en premium)
      const tier = rollRarity(min);
      const siteId = tier.lo + randomInt(tier.hi - tier.lo + 1);
      const holo = randomInt(10000) < (premium ? CONFIG.premiumHoloChance : CONFIG.holoChance) ? 1 : 0;
      const site = db.q('SELECT id, domain, rarity, family FROM sites WHERE id = ?').get(siteId);
      const { lastInsertRowid } = db.q('INSERT INTO cards (user_id, site_id, holo, obtained_at) VALUES (?, ?, ?, ?)').run(userId, siteId, holo, now);
      const isNew = discover(userId, site, now);
      out.push({ cardId: Number(lastInsertRowid), holo, isNew, site });
    }
    db.q('UPDATE users SET packs_opened = packs_opened + 1 WHERE id = ?').run(userId);
    return out;
  }

  function discover(userId, site, now = Date.now()) {
    const r = db.q('INSERT OR IGNORE INTO dex (user_id, site_id, found_at) VALUES (?, ?, ?)').run(userId, site.id, now);
    if (r.changes) {
      db.q('UPDATE users SET dex_score = dex_score + ?, dex_count = dex_count + 1 WHERE id = ?').run(RARITIES[site.rarity].value, userId);
      return true;
    }
    return false;
  }

  function openPack(userId, kind) {
    return db.tx(() => {
      const u = db.q('SELECT * FROM users WHERE id = ?').get(userId);
      if (kind === 'premium') {
        if (u.bits < CONFIG.premiumPrice) throw new GameError(`Il te faut ${CONFIG.premiumPrice} bits.`);
        db.q('UPDATE users SET bits = bits - ? WHERE id = ?').run(CONFIG.premiumPrice, userId);
        return drawCards(userId, true);
      }
      const now = Date.now();
      const st = packState(u, now);
      if (st.available < 1) throw new GameError('Aucun booster disponible, patiente encore un peu.');
      const full = u.pack_stock + st.gained >= CONFIG.packCap;
      const anchor = full ? now : u.pack_anchor + st.gained * CONFIG.packInterval;
      db.q('UPDATE users SET pack_stock = ?, pack_anchor = ? WHERE id = ?').run(st.available - 1, anchor, userId);
      return drawCards(userId, false);
    });
  }

  // ---------- Bonus quotidien ----------
  function dailyState(u, now = Date.now()) {
    const nextAt = u.daily_at + 20 * 3600 * 1000;
    const streakAlive = now - u.daily_at < 2 * DAY;
    const streak = streakAlive ? u.daily_streak : 0;
    const nextStreak = Math.min(CONFIG.dailyMaxStreak, streak + 1);
    return { available: now >= nextAt, nextAt, streak, reward: CONFIG.dailyBase + CONFIG.dailyStep * (nextStreak - 1) };
  }

  function claimDaily(userId) {
    return db.tx(() => {
      const u = db.q('SELECT * FROM users WHERE id = ?').get(userId);
      const st = dailyState(u);
      if (!st.available) throw new GameError('Bonus déjà récupéré, reviens plus tard.');
      const streak = Math.min(CONFIG.dailyMaxStreak, st.streak + 1);
      db.q('UPDATE users SET bits = bits + ?, daily_at = ?, daily_streak = ? WHERE id = ?').run(st.reward, Date.now(), streak, userId);
      return { reward: st.reward, streak };
    });
  }

  // ---------- Recyclage ----------
  function recycle(userId, cardIds) {
    if (!Array.isArray(cardIds) || !cardIds.length || cardIds.length > 500) throw new GameError('Sélection invalide.');
    return db.tx(() => {
      let gained = 0, count = 0;
      for (const id of cardIds) {
        const c = db.q("SELECT c.id, c.holo, s.rarity FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.id = ? AND c.user_id = ? AND c.status = 'owned'").get(Number(id), userId);
        if (!c) continue;
        db.q('DELETE FROM cards WHERE id = ?').run(c.id);
        gained += value(c.rarity, c.holo);
        count++;
      }
      if (!count) throw new GameError('Aucune carte recyclable.');
      db.q('UPDATE users SET bits = bits + ? WHERE id = ?').run(gained, userId);
      return { gained, count };
    });
  }

  // Recycle les doublons non holo jusqu'à une rareté donnée en gardant toujours un exemplaire.
  function recycleDuplicates(userId, maxRarity) {
    const max = Math.max(0, Math.min(5, Number(maxRarity) || 0));
    const rows = db.q(`SELECT c.site_id, GROUP_CONCAT(c.id) ids, COUNT(*) n,
        EXISTS (SELECT 1 FROM cards h WHERE h.user_id = c.user_id AND h.site_id = c.site_id AND h.holo = 1) has_holo
      FROM cards c JOIN sites s ON s.id = c.site_id
      WHERE c.user_id = ? AND c.status = 'owned' AND c.holo = 0 AND s.rarity <= ?
      GROUP BY c.site_id HAVING n > 1 OR has_holo`).all(userId, max);
    const ids = [];
    for (const r of rows) {
      const list = String(r.ids).split(',');
      ids.push(...(r.has_holo ? list : list.slice(1)));
    }
    if (!ids.length) throw new GameError('Aucun doublon à recycler.');
    return recycle(userId, ids.slice(0, 500));
  }

  // ---------- Amis ----------
  function relation(a, b) {
    const ab = db.q('SELECT status FROM friends WHERE user_id = ? AND friend_id = ?').get(a, b);
    const ba = db.q('SELECT status FROM friends WHERE user_id = ? AND friend_id = ?').get(b, a);
    if (ab?.status === 'accepted') return 'friends';
    if (ab) return 'sent';
    if (ba) return 'received';
    return 'none';
  }

  function requestFriend(me, username) {
    const target = db.q('SELECT id, username FROM users WHERE username = ?').get(String(username || '').trim());
    if (!target) throw new GameError('Joueur introuvable.', 404);
    if (target.id === me.id) throw new GameError("Tu ne peux pas t'ajouter toi-même.");
    return db.tx(() => {
      const rel = relation(me.id, target.id);
      if (rel === 'friends') throw new GameError('Vous êtes déjà amis.');
      if (rel === 'sent') throw new GameError('Demande déjà envoyée.');
      if (rel === 'received') return acceptFriendTx(me, target.id);
      db.q("INSERT INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', ?)").run(me.id, target.id, Date.now());
      notify(target.id, `${me.username} veut devenir ton ami.`, '#/friends');
      return { status: 'sent' };
    });
  }

  function acceptFriendTx(me, otherId) {
    const now = Date.now();
    const r = db.q("UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ? AND status = 'pending'").run(otherId, me.id);
    if (!r.changes) throw new GameError('Aucune demande de ce joueur.');
    db.q("INSERT OR REPLACE INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, 'accepted', ?)").run(me.id, otherId, now);
    notify(otherId, `${me.username} a accepté ta demande d'ami.`, '#/friends');
    return { status: 'friends' };
  }

  function respondFriend(me, otherId, accept) {
    otherId = Number(otherId);
    return db.tx(() => {
      if (accept) return acceptFriendTx(me, otherId);
      db.q("DELETE FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'").run(otherId, me.id);
      return { status: 'none' };
    });
  }

  function removeFriend(me, otherId) {
    otherId = Number(otherId);
    db.tx(() => {
      db.q('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(me.id, otherId, otherId, me.id);
    });
    return { status: 'none' };
  }

  function listFriends(meId) {
    const sel = 'SELECT u.id, u.username, u.dex_count, u.dex_score, u.last_seen, u.avatar_site, s.domain avatar_domain FROM users u LEFT JOIN sites s ON s.id = u.avatar_site';
    return {
      friends: db.q(`${sel} JOIN friends f ON f.friend_id = u.id WHERE f.user_id = ? AND f.status = 'accepted' ORDER BY u.last_seen DESC`).all(meId),
      incoming: db.q(`${sel} JOIN friends f ON f.user_id = u.id WHERE f.friend_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`).all(meId),
      outgoing: db.q(`${sel} JOIN friends f ON f.friend_id = u.id WHERE f.user_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`).all(meId),
    };
  }

  // ---------- Échanges ----------
  function cardOwnedBy(cardId, userId) {
    return db.q("SELECT c.id, c.site_id, c.holo, s.domain, s.rarity FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.id = ? AND c.user_id = ? AND c.status = 'owned'").get(Number(cardId), userId);
  }

  function createTrade(me, body) {
    const toId = Number(body.toUserId);
    const offer = [...new Set((body.offerCards || []).map(Number))];
    const request = [...new Set((body.requestCards || []).map(Number))];
    const offerBits = Math.max(0, Math.floor(Number(body.offerBits) || 0));
    const requestBits = Math.max(0, Math.floor(Number(body.requestBits) || 0));
    if (offer.length > CONFIG.maxTradeCards || request.length > CONFIG.maxTradeCards) throw new GameError(`Maximum ${CONFIG.maxTradeCards} cartes de chaque côté.`);
    if (!offer.length && !request.length && !offerBits && !requestBits) throw new GameError('Échange vide.');
    return db.tx(() => {
      if (relation(me.id, toId) !== 'friends') throw new GameError('Tu ne peux échanger qu\'avec tes amis.');
      const pending = db.q("SELECT COUNT(*) n FROM trades WHERE from_id = ? AND status = 'pending'").get(me.id).n;
      if (pending >= CONFIG.maxPendingTrades) throw new GameError('Trop de propositions en attente.');
      if (offerBits > db.q('SELECT bits FROM users WHERE id = ?').get(me.id).bits) throw new GameError('Pas assez de bits.');
      for (const id of offer) if (!cardOwnedBy(id, me.id)) throw new GameError('Une de tes cartes n\'est plus disponible.');
      for (const id of request) if (!cardOwnedBy(id, toId)) throw new GameError('Une des cartes demandées n\'est plus disponible.');
      const message = String(body.message || '').slice(0, 200) || null;
      const { lastInsertRowid } = db.q('INSERT INTO trades (from_id, to_id, offer_bits, request_bits, message, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(me.id, toId, offerBits, requestBits, message, Date.now());
      const tid = Number(lastInsertRowid);
      for (const id of offer) db.q("INSERT INTO trade_items (trade_id, card_id, side) VALUES (?, ?, 'offer')").run(tid, id);
      for (const id of request) db.q("INSERT INTO trade_items (trade_id, card_id, side) VALUES (?, ?, 'request')").run(tid, id);
      notify(toId, `${me.username} te propose un échange.`, '#/trades');
      return { id: tid };
    });
  }

  function tradeDetails(t) {
    const items = db.q(`SELECT ti.card_id, ti.side, c.holo, c.user_id, c.status, s.id site_id, s.domain, s.rarity, s.family
      FROM trade_items ti LEFT JOIN cards c ON c.id = ti.card_id LEFT JOIN sites s ON s.id = c.site_id WHERE ti.trade_id = ?`).all(t.id);
    return {
      ...t,
      offer: items.filter((i) => i.side === 'offer'),
      request: items.filter((i) => i.side === 'request'),
    };
  }

  function listTrades(meId) {
    const sel = `SELECT t.*, uf.username from_name, ut.username to_name FROM trades t
      JOIN users uf ON uf.id = t.from_id JOIN users ut ON ut.id = t.to_id`;
    const active = db.q(`${sel} WHERE (t.from_id = ? OR t.to_id = ?) AND t.status = 'pending' ORDER BY t.id DESC LIMIT 50`).all(meId, meId);
    const history = db.q(`${sel} WHERE (t.from_id = ? OR t.to_id = ?) AND t.status != 'pending' ORDER BY t.id DESC LIMIT 20`).all(meId, meId);
    return { active: active.map(tradeDetails), history: history.map(tradeDetails) };
  }

  function resolveTrade(me, tradeId, action) {
    const res = db.tx(() => {
      const t = db.q('SELECT * FROM trades WHERE id = ?').get(Number(tradeId));
      if (!t || t.status !== 'pending') throw new GameError('Échange introuvable ou terminé.', 404);
      const now = Date.now();
      if (action === 'cancel') {
        if (t.from_id !== me.id) throw new GameError('Action interdite.', 403);
        db.q("UPDATE trades SET status = 'cancelled', resolved_at = ? WHERE id = ?").run(now, t.id);
        return { status: 'cancelled' };
      }
      if (t.to_id !== me.id) throw new GameError('Action interdite.', 403);
      if (action === 'decline') {
        db.q("UPDATE trades SET status = 'declined', resolved_at = ? WHERE id = ?").run(now, t.id);
        notify(t.from_id, `${me.username} a refusé ton échange.`, '#/trades');
        return { status: 'declined' };
      }
      const d = tradeDetails(t);
      const fromBits = db.q('SELECT bits FROM users WHERE id = ?').get(t.from_id).bits;
      const toBits = db.q('SELECT bits FROM users WHERE id = ?').get(t.to_id).bits;
      if (toBits < t.request_bits) throw new GameError('Tu n\'as pas assez de bits.');
      let invalid = null;
      if (fromBits < t.offer_bits) invalid = 'Ton ami n\'a plus assez de bits.';
      else if (d.offer.some((i) => i.user_id !== t.from_id || i.status !== 'owned')) invalid = 'Une carte proposée n\'est plus disponible.';
      else if (d.request.some((i) => i.user_id !== t.to_id || i.status !== 'owned')) invalid = 'Une de tes cartes demandées n\'est plus disponible.';
      if (invalid) {
        db.q("UPDATE trades SET status = 'invalid', resolved_at = ? WHERE id = ?").run(now, t.id);
        return { status: 'invalid', error: invalid + ' Échange annulé.' };
      }
      for (const i of d.offer) {
        db.q('UPDATE cards SET user_id = ?, obtained_at = ? WHERE id = ?').run(t.to_id, now, i.card_id);
        discover(t.to_id, { id: i.site_id, rarity: i.rarity }, now);
      }
      for (const i of d.request) {
        db.q('UPDATE cards SET user_id = ?, obtained_at = ? WHERE id = ?').run(t.from_id, now, i.card_id);
        discover(t.from_id, { id: i.site_id, rarity: i.rarity }, now);
      }
      const net = t.offer_bits - t.request_bits;
      db.q('UPDATE users SET bits = bits - ? WHERE id = ?').run(net, t.from_id);
      db.q('UPDATE users SET bits = bits + ? WHERE id = ?').run(net, t.to_id);
      db.q("UPDATE trades SET status = 'accepted', resolved_at = ? WHERE id = ?").run(now, t.id);
      notify(t.from_id, `${me.username} a accepté ton échange !`, '#/trades');
      return { status: 'accepted' };
    });
    if (res.error) throw new GameError(res.error, 409);
    return res;
  }

  // ---------- Enchères ----------
  function minBid(a) {
    if (a.current_bid == null) return a.start_price;
    return a.current_bid + Math.max(1, Math.ceil(a.current_bid * 0.05));
  }

  function createAuction(me, body) {
    const cardId = Number(body.cardId);
    const start = Math.floor(Number(body.startPrice));
    const buyout = body.buyout ? Math.floor(Number(body.buyout)) : null;
    const hours = Number(body.hours);
    if (!CONFIG.auctionHours.includes(hours)) throw new GameError('Durée invalide.');
    if (!(start >= 1 && start <= 10_000_000)) throw new GameError('Prix de départ invalide.');
    if (buyout != null && !(buyout > start && buyout <= 10_000_000)) throw new GameError('Le prix d\'achat immédiat doit dépasser le prix de départ.');
    return db.tx(() => {
      const c = cardOwnedBy(cardId, me.id);
      if (!c) throw new GameError('Carte indisponible.');
      const open = db.q("SELECT COUNT(*) n FROM auctions WHERE seller_id = ? AND status = 'open'").get(me.id).n;
      if (open >= CONFIG.maxOpenAuctions) throw new GameError('Trop d\'enchères en cours.');
      const now = Date.now();
      db.q("UPDATE cards SET status = 'auction' WHERE id = ?").run(c.id);
      const { lastInsertRowid } = db.q('INSERT INTO auctions (seller_id, card_id, site_id, start_price, buyout, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(me.id, c.id, c.site_id, start, buyout, now + hours * 3600 * 1000, now);
      return { id: Number(lastInsertRowid) };
    });
  }

  function bid(me, auctionId, amount, isBuyout = false) {
    return db.tx(() => {
      const a = db.q('SELECT a.*, s.domain FROM auctions a JOIN sites s ON s.id = a.site_id WHERE a.id = ?').get(Number(auctionId));
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
      // Si on surenchérit sur soi-même (achat immédiat), on ne repaie que la différence.
      const already = a.bidder_id === me.id ? a.current_bid : 0;
      const bits = db.q('SELECT bits FROM users WHERE id = ?').get(me.id).bits;
      if (bits + already < amount) throw new GameError('Pas assez de bits.');
      if (a.bidder_id && a.bidder_id !== me.id) {
        db.q('UPDATE users SET bits = bits + ? WHERE id = ?').run(a.current_bid, a.bidder_id);
        notify(a.bidder_id, `Ton enchère sur ${a.domain} a été dépassée.`, '#/market');
      }
      db.q('UPDATE users SET bits = bits - ? WHERE id = ?').run(amount - already, me.id);
      const endsAt = isBuyout ? now : Math.max(a.ends_at, now + 60_000); // anti-snipe
      db.q('UPDATE auctions SET current_bid = ?, bidder_id = ?, bid_count = bid_count + 1, ends_at = ? WHERE id = ?').run(amount, me.id, endsAt, a.id);
      if (isBuyout) settleOne(a.id, now);
      return { ok: true, amount, bought: isBuyout };
    });
  }

  function cancelAuction(me, auctionId) {
    return db.tx(() => {
      const a = db.q('SELECT * FROM auctions WHERE id = ?').get(Number(auctionId));
      if (!a || a.seller_id !== me.id || a.status !== 'open') throw new GameError('Enchère introuvable.', 404);
      if (a.bidder_id) throw new GameError('Impossible d\'annuler : il y a déjà une enchère.');
      db.q("UPDATE auctions SET status = 'cancelled' WHERE id = ?").run(a.id);
      db.q("UPDATE cards SET status = 'owned' WHERE id = ?").run(a.card_id);
      return { ok: true };
    });
  }

  function settleOne(id, now) {
    const a = db.q('SELECT a.*, s.domain, s.rarity FROM auctions a JOIN sites s ON s.id = a.site_id WHERE a.id = ?').get(id);
    if (!a || a.status !== 'open') return;
    if (a.bidder_id) {
      const fee = Math.floor(a.current_bid * CONFIG.auctionFee);
      db.q("UPDATE cards SET user_id = ?, status = 'owned', obtained_at = ? WHERE id = ?").run(a.bidder_id, now, a.card_id);
      db.q('UPDATE users SET bits = bits + ? WHERE id = ?').run(a.current_bid - fee, a.seller_id);
      db.q("UPDATE auctions SET status = 'sold', ends_at = ? WHERE id = ?").run(Math.min(a.ends_at, now), a.id);
      discover(a.bidder_id, { id: a.site_id, rarity: a.rarity }, now);
      notify(a.seller_id, `${a.domain} vendu ${a.current_bid} bits (−${fee} de commission).`, '#/market');
      notify(a.bidder_id, `Tu as remporté ${a.domain} pour ${a.current_bid} bits !`, '#/collection');
    } else {
      db.q("UPDATE cards SET status = 'owned' WHERE id = ?").run(a.card_id);
      db.q("UPDATE auctions SET status = 'expired' WHERE id = ?").run(a.id);
      notify(a.seller_id, `Personne n'a enchéri sur ${a.domain}. La carte est revenue dans ta collection.`, '#/collection');
    }
  }

  function settleAuctions() {
    const now = Date.now();
    const due = db.q("SELECT id FROM auctions WHERE status = 'open' AND ends_at <= ? LIMIT 200").all(now);
    if (!due.length) return 0;
    db.tx(() => { for (const { id } of due) settleOne(id, now); });
    return due.length;
  }

  function listAuctions(meId, { scope = 'all', rarity, q, sort = 'ending' } = {}) {
    settleAuctions();
    const where = [];
    const args = [];
    if (scope === 'mine') { where.push('a.seller_id = ?'); args.push(meId); where.push("(a.status = 'open' OR a.created_at > ?)"); args.push(Date.now() - 3 * DAY); }
    else if (scope === 'bids') { where.push("a.bidder_id = ?"); args.push(meId); where.push("(a.status = 'open' OR a.ends_at > ?)"); args.push(Date.now() - 3 * DAY); }
    else { where.push("a.status = 'open'"); }
    if (rarity !== undefined && rarity !== '') { where.push('s.rarity = ?'); args.push(Number(rarity)); }
    if (q) { where.push('s.domain LIKE ?'); args.push('%' + String(q).toLowerCase().replace(/[%_]/g, '') + '%'); }
    const order = { ending: 'a.status = \'open\' DESC, a.ends_at ASC', new: 'a.id DESC', price: 'COALESCE(a.current_bid, a.start_price) ASC', rarity: 's.rarity DESC, a.ends_at ASC' }[sort] || 'a.ends_at ASC';
    return db.q(`SELECT a.id, a.card_id, a.start_price, a.buyout, a.current_bid, a.bid_count, a.ends_at, a.status, a.seller_id, a.bidder_id,
        c.holo, s.id site_id, s.domain, s.rarity, s.family, us.username seller, ub.username bidder
      FROM auctions a JOIN sites s ON s.id = a.site_id JOIN cards c ON c.id = a.card_id
      JOIN users us ON us.id = a.seller_id LEFT JOIN users ub ON ub.id = a.bidder_id
      WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 80`).all(...args)
      .map((a) => ({ ...a, min_bid: minBid(a) }));
  }

  return {
    tiers, totalSites, value, notify, packState, openPack, dailyState, claimDaily, recycle, recycleDuplicates,
    relation, requestFriend, respondFriend, removeFriend, listFriends,
    createTrade, listTrades, resolveTrade,
    createAuction, bid, cancelAuction, settleAuctions, listAuctions,
  };
}
