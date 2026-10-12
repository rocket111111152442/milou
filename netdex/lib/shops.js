// Boutiques d'échange, boosters scellés, prêts et bourse des boutiques.
//  - Un booster scellé a une « qualité » tirée au moment où on le scelle : elle multiplie les chances des raretés hautes.
//    Les probabilités affichées sont les vraies : le contenu n'est tiré qu'à l'ouverture, avec ces chances-là.
//  - Une boutique (25 000 bits) prend une commission sur chaque booster vendu chez elle ; la commission remplit son coffre.
//  - Le coffre sert à prêter aux joueurs (avec intérêts) et à verser des dividendes quotidiens aux actionnaires.
//  - Chaque boutique a 1 000 actions échangées sur un carnet d'ordres (priorité prix puis ancienneté).
import { randomInt } from 'node:crypto';
import { GameError } from './game.js';

export const SHOP_PRICE = 25_000;
export const TOTAL_SHARES = 1000;
export const QUALITIES = {
  standard: { name: 'Standard' },
  chanceux: { name: 'Chanceux' },
  brillant: { name: 'Brillant' },
  prestige: { name: 'Prestige' },
};
const MAX_SEALED = 30;
const MAX_LISTINGS = 20;
const MAX_LOANS = 3;
const LOAN_PENDING_MS = 48 * 3600e3;
const DAY = 24 * 3600e3;
const dayId = (t = Date.now()) => Math.floor(t / DAY);
const rnd = () => randomInt(1_000_000) / 1_000_000;

export function rollQuality() {
  const x = rnd();
  if (x < 0.70) return { boost: 1, quality: 'standard' };
  if (x < 0.90) return { boost: +(1.5 + rnd() * 1.5).toFixed(2), quality: 'chanceux' };
  if (x < 0.98) return { boost: +(3 + rnd() * 5).toFixed(2), quality: 'brillant' };
  return { boost: +(8 + rnd() * 17).toFixed(2), quality: 'prestige' };
}

export function createShops(db, game) {
  const odds = (boost) => {
    const o = game.packOdds(boost);
    return Object.fromEntries(Object.entries(o).map(([r, p]) => [r, +(p * 100).toPrecision(3)]));
  };
  const packView = (p) => ({ id: p.id, quality: p.quality, qualityName: QUALITIES[p.quality].name, boost: p.boost, status: p.status, odds: odds(p.boost), createdAt: p.created_at });
  const intIn = (v, lo, hi, msg) => { const n = Math.floor(Number(v)); if (!(n >= lo && n <= hi)) throw new GameError(msg); return n; };
  const lockUser = (q, id) => q.one('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);

  // ---------- Boosters scellés ----------
  async function sealPack(userId) {
    return db.tx(async (q) => {
      const u = await lockUser(q, userId);
      const n = (await q.one("SELECT COUNT(*) n FROM sealed_packs WHERE owner_id = $1 AND status IN ('owned', 'listed')", [userId])).n;
      if (n >= MAX_SEALED) throw new GameError(`Maximum ${MAX_SEALED} boosters scellés.`);
      await game.consumeFreePack(q, u);
      const { boost, quality } = rollQuality();
      const p = await q.one('INSERT INTO sealed_packs (owner_id, boost, quality, created_at) VALUES ($1, $2, $3, $4) RETURNING *', [userId, boost, quality, Date.now()]);
      return packView(p);
    });
  }

  async function myPacks(userId) {
    const rows = await db.all(`SELECT p.*, l.id listing_id, l.price, l.shop_id, s.name shop_name FROM sealed_packs p
      LEFT JOIN shop_listings l ON l.pack_id = p.id AND l.status = 'open' LEFT JOIN shops s ON s.id = l.shop_id
      WHERE p.owner_id = $1 AND p.status IN ('owned', 'listed') ORDER BY p.boost DESC, p.id`, [userId]);
    return { items: rows.map((r) => ({ ...packView(r), listing: r.listing_id ? { id: r.listing_id, price: r.price, shopId: r.shop_id, shopName: r.shop_name } : null })), max: MAX_SEALED };
  }

  async function openSealed(userId, packId) {
    await game.refreshCustom();
    return db.tx(async (q) => {
      const u = await lockUser(q, userId);
      const p = await q.one("SELECT * FROM sealed_packs WHERE id = $1 AND owner_id = $2 AND status = 'owned' FOR UPDATE", [Number(packId), userId]);
      if (!p) throw new GameError('Booster introuvable (déjà ouvert ou en vente).');
      await q.run("UPDATE sealed_packs SET status = 'opened' WHERE id = $1", [p.id]);
      const cards = await game.drawCards(q, userId, false, u.is_bot, { pity: u.pity, boost: p.boost });
      return { cards, pack: packView(p) };
    });
  }

  // ---------- Boutiques ----------
  const shopSelect = `SELECT s.*, u.username owner_name,
      (SELECT COUNT(*) FROM shop_listings l WHERE l.shop_id = s.id AND l.status = 'open') listings,
      (SELECT price FROM stock_trades t WHERE t.shop_id = s.id AND t.at <= $1 ORDER BY t.at DESC LIMIT 1) price_24h,
      (SELECT COALESCE(SUM(qty), 0) FROM stock_trades t WHERE t.shop_id = s.id AND t.at > $1) volume_24h,
      (SELECT COUNT(*) FROM shares h WHERE h.shop_id = s.id AND h.qty > 0) holders
    FROM shops s JOIN users u ON u.id = s.owner_id`;
  const shopView = (s) => ({
    id: s.id, name: s.name, description: s.description, ownerId: s.owner_id, owner: s.owner_name, feePct: s.fee_pct, accepts: s.accepts,
    balance: s.balance, divPct: s.div_pct, loanRate: s.loan_rate, loanMax: s.loan_max, totalShares: s.total_shares,
    lastPrice: s.last_price, change24h: s.last_price && s.price_24h ? +(((s.last_price - s.price_24h) / s.price_24h) * 100).toFixed(1) : null,
    volume24h: s.volume_24h, marketCap: s.last_price ? s.last_price * s.total_shares : null, listings: s.listings, holders: s.holders,
    salesCount: s.sales_count, feesTotal: s.fees_total, createdAt: s.created_at,
  });

  async function listShops() {
    const rows = await db.all(`${shopSelect} ORDER BY s.sales_count DESC, s.id`, [Date.now() - DAY]);
    return { items: rows.map(shopView), price: SHOP_PRICE };
  }

  function cleanSettings(b, cur = {}) {
    const name = b.name !== undefined ? String(b.name).replace(/\s+/g, ' ').trim() : cur.name;
    if (!name || name.length < 3 || name.length > 30) throw new GameError('Nom de boutique : 3 à 30 caractères.');
    const accepts = b.accepts !== undefined ? [...new Set((b.accepts || []).filter((x) => QUALITIES[x]))] : cur.accepts;
    if (!accepts?.length) throw new GameError('La boutique doit accepter au moins une qualité de booster.');
    const num = (v, lo, hi, d, msg) => { if (v === undefined) return d; const n = Number(v); if (!(n >= lo && n <= hi)) throw new GameError(msg); return Math.round(n * 10) / 10; };
    return {
      name, accepts,
      description: b.description !== undefined ? String(b.description).trim().slice(0, 280) : cur.description ?? '',
      fee: num(b.feePct, 0, 25, cur.fee_pct ?? 5, 'Commission : entre 0 et 25 %.'),
      div: num(b.divPct, 0, 50, cur.div_pct ?? 0, 'Dividendes : entre 0 et 50 % du coffre par jour.'),
      rate: num(b.loanRate, 0, 100, cur.loan_rate ?? 10, 'Taux de prêt : entre 0 et 100 %.'),
      loanMax: b.loanMax !== undefined ? intIn(b.loanMax, 0, 1_000_000, 'Prêt maximum invalide.') : cur.loan_max ?? 1000,
    };
  }

  async function createShop(me, body) {
    const c = cleanSettings({ accepts: Object.keys(QUALITIES), ...body });
    return db.tx(async (q) => {
      if (await q.one('SELECT 1 FROM shops WHERE lower(name) = lower($1)', [c.name])) throw new GameError('Ce nom de boutique est déjà pris.');
      await game.debit(q, me.id, SHOP_PRICE, `Il faut ${SHOP_PRICE.toLocaleString('fr-FR')} bits pour ouvrir une boutique.`);
      const s = await q.one(`INSERT INTO shops (owner_id, name, description, fee_pct, accepts, div_pct, loan_rate, loan_max, total_shares, div_day, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [me.id, c.name, c.description, c.fee, c.accepts, c.div, c.rate, c.loanMax, TOTAL_SHARES, dayId(), Date.now()]);
      await q.run('INSERT INTO shares (shop_id, user_id, qty) VALUES ($1, $2, $3)', [s.id, me.id, TOTAL_SHARES]);
      return { id: s.id };
    });
  }

  async function updateShop(me, shopId, body) {
    return db.tx(async (q) => {
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [Number(shopId)]);
      if (!s || s.owner_id !== me.id) throw new GameError('Seul le propriétaire peut modifier la boutique.', 403);
      const c = cleanSettings(body, s);
      if (c.name.toLowerCase() !== s.name.toLowerCase() && await q.one('SELECT 1 FROM shops WHERE lower(name) = lower($1)', [c.name])) throw new GameError('Ce nom de boutique est déjà pris.');
      await q.run('UPDATE shops SET name = $2, description = $3, fee_pct = $4, accepts = $5, div_pct = $6, loan_rate = $7, loan_max = $8 WHERE id = $1',
        [s.id, c.name, c.description, c.fee, c.accepts, c.div, c.rate, c.loanMax]);
      return { ok: true };
    });
  }

  async function deposit(me, shopId, amount) {
    const n = intIn(amount, 1, 10_000_000, 'Montant invalide.');
    return db.tx(async (q) => {
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [Number(shopId)]);
      if (!s || s.owner_id !== me.id) throw new GameError('Seul le propriétaire peut alimenter le coffre.', 403);
      await game.debit(q, me.id, n);
      await q.run('UPDATE shops SET balance = balance + $1 WHERE id = $2', [n, s.id]);
      return { ok: true };
    });
  }

  async function shopDetail(meId, shopId) {
    const s = await db.one(`${shopSelect} WHERE s.id = $2`, [Date.now() - DAY, Number(shopId)]);
    if (!s) throw new GameError('Boutique introuvable.', 404);
    const owner = s.owner_id === meId;
    const [listings, myLoans, pending, active, myShares, payouts] = await Promise.all([
      db.all(`SELECT l.id, l.price, l.created_at, l.seller_id, u.username seller, p.id pack_id, p.boost, p.quality, p.status, p.created_at pack_created
        FROM shop_listings l JOIN sealed_packs p ON p.id = l.pack_id JOIN users u ON u.id = l.seller_id
        WHERE l.shop_id = $1 AND l.status = 'open' ORDER BY p.boost DESC, l.price ASC LIMIT 100`, [s.id]),
      db.all("SELECT * FROM shop_loans WHERE shop_id = $1 AND borrower_id = $2 AND status IN ('pending', 'active', 'defaulted') ORDER BY id DESC", [s.id, meId]),
      owner ? db.all(`SELECT l.*, u.username, u.dex_score, u.created_at user_created,
          (SELECT COUNT(*) FROM shop_loans x WHERE x.borrower_id = l.borrower_id AND x.status = 'repaid') repaid_count,
          (SELECT COUNT(*) FROM shop_loans x WHERE x.borrower_id = l.borrower_id AND x.status = 'defaulted') default_count
        FROM shop_loans l JOIN users u ON u.id = l.borrower_id WHERE l.shop_id = $1 AND l.status = 'pending' ORDER BY l.id`, [s.id]) : [],
      owner ? db.all(`SELECT l.*, u.username FROM shop_loans l JOIN users u ON u.id = l.borrower_id
        WHERE l.shop_id = $1 AND l.status IN ('active', 'defaulted') ORDER BY l.due_at`, [s.id]) : [],
      db.one('SELECT qty, locked FROM shares WHERE shop_id = $1 AND user_id = $2', [s.id, meId]),
      db.all('SELECT day, amount, per_share FROM shop_payouts WHERE shop_id = $1 ORDER BY day DESC LIMIT 7', [s.id]),
    ]);
    return {
      shop: shopView(s), owner, qualities: QUALITIES,
      listings: listings.map((l) => ({ id: l.id, price: l.price, seller: l.seller, mine: l.seller_id === meId, pack: packView({ id: l.pack_id, boost: l.boost, quality: l.quality, status: l.status, created_at: l.pack_created }) })),
      myLoans, pendingLoans: pending, activeLoans: active, myShares: myShares || { qty: 0, locked: 0 }, payouts,
    };
  }

  // ---------- Vente de boosters en boutique ----------
  async function listPack(me, body) {
    const price = intIn(body.price, 1, 10_000_000, 'Prix invalide.');
    return db.tx(async (q) => {
      const p = await q.one("SELECT * FROM sealed_packs WHERE id = $1 AND owner_id = $2 AND status = 'owned' FOR UPDATE", [Number(body.packId), me.id]);
      if (!p) throw new GameError('Booster indisponible.');
      const s = await q.one('SELECT * FROM shops WHERE id = $1', [Number(body.shopId)]);
      if (!s) throw new GameError('Boutique introuvable.', 404);
      if (!s.accepts.includes(p.quality)) throw new GameError(`${s.name} n'accepte pas les boosters ${QUALITIES[p.quality].name}.`);
      const n = (await q.one("SELECT COUNT(*) n FROM shop_listings WHERE seller_id = $1 AND status = 'open'", [me.id])).n;
      if (n >= MAX_LISTINGS) throw new GameError(`Maximum ${MAX_LISTINGS} boosters en vente.`);
      await q.run("UPDATE sealed_packs SET status = 'listed' WHERE id = $1", [p.id]);
      return q.one('INSERT INTO shop_listings (shop_id, pack_id, seller_id, price, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id', [s.id, p.id, me.id, price, Date.now()]);
    });
  }

  async function cancelListing(me, listingId) {
    return db.tx(async (q) => {
      const l = await q.one("SELECT * FROM shop_listings WHERE id = $1 AND status = 'open' FOR UPDATE", [Number(listingId)]);
      if (!l || l.seller_id !== me.id) throw new GameError('Annonce introuvable.', 404);
      await q.run("UPDATE shop_listings SET status = 'cancelled' WHERE id = $1", [l.id]);
      await q.run("UPDATE sealed_packs SET status = 'owned' WHERE id = $1", [l.pack_id]);
      return { ok: true };
    });
  }

  async function buyListing(me, listingId) {
    return db.tx(async (q) => {
      const l = await q.one("SELECT * FROM shop_listings WHERE id = $1 AND status = 'open' FOR UPDATE", [Number(listingId)]);
      if (!l) throw new GameError('Ce booster vient d\'être vendu.', 409);
      if (l.seller_id === me.id) throw new GameError('C\'est ton propre booster.');
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [l.shop_id]);
      await game.debit(q, me.id, l.price);
      const fee = Math.floor((l.price * s.fee_pct) / 100);
      await game.credit(q, l.seller_id, l.price - fee);
      await q.run('UPDATE shops SET balance = balance + $1, fees_total = fees_total + $1, sales_count = sales_count + 1 WHERE id = $2', [fee, s.id]);
      await q.run("UPDATE sealed_packs SET owner_id = $1, status = 'owned' WHERE id = $2", [me.id, l.pack_id]);
      await q.run("UPDATE shop_listings SET status = 'sold', buyer_id = $1, sold_at = $2 WHERE id = $3", [me.id, Date.now(), l.id]);
      await game.notify(q, l.seller_id, `Ton booster a été vendu ${l.price} bits chez ${s.name} (−${fee} de commission).`, `#/shop/${s.id}`);
      return { ok: true, fee };
    });
  }

  // ---------- Prêts ----------
  async function requestLoan(me, shopId, body) {
    const amount = intIn(body.amount, 1, 1_000_000, 'Montant invalide.');
    const days = intIn(body.days, 1, 14, 'Durée : de 1 à 14 jours.');
    return db.tx(async (q) => {
      const s = await q.one('SELECT * FROM shops WHERE id = $1', [Number(shopId)]);
      if (!s) throw new GameError('Boutique introuvable.', 404);
      if (s.owner_id === me.id) throw new GameError('Tu ne peux pas emprunter à ta propre boutique.');
      if (amount > s.loan_max) throw new GameError(`Cette boutique prête au maximum ${s.loan_max} bits.`);
      const mine = await q.all("SELECT shop_id, status FROM shop_loans WHERE borrower_id = $1 AND status IN ('pending', 'active', 'defaulted')", [me.id]);
      if (mine.some((x) => x.status === 'defaulted')) throw new GameError('Tu as un prêt impayé : rembourse-le d\'abord.');
      if (mine.some((x) => x.shop_id === s.id)) throw new GameError('Tu as déjà une demande ou un prêt en cours avec cette boutique.');
      if (mine.length >= MAX_LOANS) throw new GameError(`Maximum ${MAX_LOANS} prêts en même temps.`);
      const due = Math.ceil(amount * (1 + s.loan_rate / 100));
      const r = await q.one('INSERT INTO shop_loans (shop_id, borrower_id, amount, rate, days, due_amount, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [s.id, me.id, amount, s.loan_rate, days, due, Date.now()]);
      await game.notify(q, s.owner_id, `${me.username} demande un prêt de ${amount} bits à ${s.name} (${days} j, à rembourser ${due}).`, `#/shop/${s.id}`);
      return { id: r.id, due };
    });
  }

  async function respondLoan(me, loanId, accept) {
    return db.tx(async (q) => {
      const l = await q.one("SELECT * FROM shop_loans WHERE id = $1 AND status = 'pending' FOR UPDATE", [Number(loanId)]);
      if (!l) throw new GameError('Demande introuvable.', 404);
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [l.shop_id]);
      if (s.owner_id !== me.id) throw new GameError('Seul le propriétaire décide.', 403);
      const now = Date.now();
      if (!accept) {
        await q.run("UPDATE shop_loans SET status = 'refused' WHERE id = $1", [l.id]);
        await game.notify(q, l.borrower_id, `${s.name} a refusé ta demande de prêt.`, `#/shop/${s.id}`);
        return { status: 'refused' };
      }
      if (s.balance < l.amount) throw new GameError(`Le coffre ne contient que ${s.balance} bits.`);
      await q.run('UPDATE shops SET balance = balance - $1 WHERE id = $2', [l.amount, s.id]);
      await game.credit(q, l.borrower_id, l.amount);
      await q.run("UPDATE shop_loans SET status = 'active', accepted_at = $1, due_at = $2 WHERE id = $3", [now, now + l.days * DAY, l.id]);
      await game.notify(q, l.borrower_id, `${s.name} t'a prêté ${l.amount} bits. À rembourser : ${l.due_amount} bits dans ${l.days} j.`, '#/loans');
      return { status: 'active' };
    });
  }

  // Remboursement (total ou partiel) ; un prêt soldé passe en « remboursé ».
  async function payLoan(q, l, take) {
    if (take <= 0) return l.paid;
    await q.run('UPDATE shops SET balance = balance + $1 WHERE id = $2', [take, l.shop_id]);
    const paid = l.paid + take;
    await q.run(`UPDATE shop_loans SET paid = $1, status = CASE WHEN $1 >= due_amount THEN 'repaid' ELSE status END WHERE id = $2`, [paid, l.id]);
    return paid;
  }

  async function repayLoan(me, loanId, amount) {
    return db.tx(async (q) => {
      const l = await q.one("SELECT * FROM shop_loans WHERE id = $1 AND borrower_id = $2 AND status IN ('active', 'defaulted') FOR UPDATE", [Number(loanId), me.id]);
      if (!l) throw new GameError('Prêt introuvable.', 404);
      const left = l.due_amount - l.paid;
      const take = amount ? Math.min(left, intIn(amount, 1, left, 'Montant invalide.')) : left;
      await game.debit(q, me.id, take);
      const paid = await payLoan(q, l, take);
      return { paid, left: l.due_amount - paid };
    });
  }

  async function myLoans(userId) {
    return { items: await db.all(`SELECT l.*, s.name shop_name FROM shop_loans l JOIN shops s ON s.id = l.shop_id
      WHERE l.borrower_id = $1 ORDER BY (l.status IN ('active', 'defaulted', 'pending')) DESC, l.id DESC LIMIT 50`, [userId]) };
  }

  // ---------- Bourse : carnet d'ordres ----------
  async function placeOrder(me, shopId, body) {
    const side = body.side === 'sell' ? 'sell' : 'buy';
    const market = body.type === 'market';
    const qty = intIn(body.qty, 1, TOTAL_SHARES, 'Quantité invalide.');
    const limit = market ? null : intIn(body.price, 1, 10_000_000, 'Prix invalide.');
    return db.tx(async (q) => {
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [Number(shopId)]); // sérialise le carnet de cette boutique
      if (!s) throw new GameError('Boutique introuvable.', 404);
      const now = Date.now();
      let remaining = qty, filled = 0, cost = 0;
      const trade = async (buyerId, sellerId, price, n) => {
        await q.run(`INSERT INTO shares (shop_id, user_id, qty) VALUES ($1, $2, $3)
          ON CONFLICT (shop_id, user_id) DO UPDATE SET qty = shares.qty + EXCLUDED.qty`, [s.id, buyerId, n]);
        await q.run('UPDATE shares SET qty = qty - $3, locked = locked - $3 WHERE shop_id = $1 AND user_id = $2', [s.id, sellerId, n]);
        await game.credit(q, sellerId, price * n);
        await q.run('INSERT INTO stock_trades (shop_id, price, qty, buyer_id, seller_id, at) VALUES ($1, $2, $3, $4, $5, $6)', [s.id, price, n, buyerId, sellerId, now]);
        await q.run('UPDATE shops SET last_price = $1 WHERE id = $2', [price, s.id]);
        filled += n; cost += price * n; remaining -= n;
      };

      if (side === 'buy') {
        if (limit) await game.debit(q, me.id, limit * qty, `Il te faut ${limit * qty} bits pour cet ordre.`);
        const asks = await q.all(`SELECT * FROM stock_orders WHERE shop_id = $1 AND side = 'sell' AND status = 'open' AND user_id != $2
          ${limit ? 'AND price <= $3' : ''} ORDER BY price ASC, id ASC FOR UPDATE`, limit ? [s.id, me.id, limit] : [s.id, me.id]);
        for (const a of asks) {
          if (!remaining) break;
          let n = Math.min(remaining, a.qty - a.filled);
          if (!limit) {
            const bits = (await q.one('SELECT bits FROM users WHERE id = $1', [me.id])).bits;
            n = Math.min(n, Math.floor(bits / a.price));
            if (!n) break;
            await game.debit(q, me.id, n * a.price);
          } else if (limit > a.price) await game.credit(q, me.id, (limit - a.price) * n); // on paie le prix du vendeur, la différence revient
          await trade(me.id, a.user_id, a.price, n);
          await q.run(`UPDATE stock_orders SET filled = filled + $1, status = CASE WHEN filled + $1 >= qty THEN 'filled' ELSE status END WHERE id = $2`, [n, a.id]);
        }
      } else {
        const h = await q.one('SELECT qty, locked FROM shares WHERE shop_id = $1 AND user_id = $2 FOR UPDATE', [s.id, me.id]);
        if (!h || h.qty - h.locked < qty) throw new GameError(`Tu n'as que ${h ? h.qty - h.locked : 0} action(s) disponible(s).`);
        await q.run('UPDATE shares SET locked = locked + $3 WHERE shop_id = $1 AND user_id = $2', [s.id, me.id, qty]);
        const bids = await q.all(`SELECT * FROM stock_orders WHERE shop_id = $1 AND side = 'buy' AND status = 'open' AND user_id != $2
          ${limit ? 'AND price >= $3' : ''} ORDER BY price DESC, id ASC FOR UPDATE`, limit ? [s.id, me.id, limit] : [s.id, me.id]);
        for (const b of bids) {
          if (!remaining) break;
          const n = Math.min(remaining, b.qty - b.filled);
          await trade(b.user_id, me.id, b.price, n); // l'acheteur avait déjà bloqué ses bits au prix de son ordre
          await q.run(`UPDATE stock_orders SET filled = filled + $1, status = CASE WHEN filled + $1 >= qty THEN 'filled' ELSE status END WHERE id = $2`, [n, b.id]);
        }
        if (remaining && !limit) await q.run('UPDATE shares SET locked = locked - $3 WHERE shop_id = $1 AND user_id = $2', [s.id, me.id, remaining]);
      }

      let orderId = null;
      if (limit) {
        const st = remaining ? 'open' : 'filled';
        orderId = (await q.one('INSERT INTO stock_orders (shop_id, user_id, side, price, qty, filled, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
          [s.id, me.id, side, limit, qty, filled, st, now])).id;
      }
      return { filled, avgPrice: filled ? Math.round(cost / filled) : null, resting: limit ? remaining : 0, orderId };
    });
  }

  async function cancelOrder(me, orderId) {
    return db.tx(async (q) => {
      const head = await q.one('SELECT shop_id FROM stock_orders WHERE id = $1', [Number(orderId)]);
      if (!head) throw new GameError('Ordre introuvable.', 404);
      await q.one('SELECT id FROM shops WHERE id = $1 FOR UPDATE', [head.shop_id]);
      const o = await q.one("SELECT * FROM stock_orders WHERE id = $1 AND user_id = $2 AND status = 'open' FOR UPDATE", [Number(orderId), me.id]);
      if (!o) throw new GameError('Ordre introuvable ou déjà exécuté.', 404);
      const rem = o.qty - o.filled;
      if (o.side === 'buy') await game.credit(q, me.id, rem * o.price);
      else await q.run('UPDATE shares SET locked = locked - $3 WHERE shop_id = $1 AND user_id = $2', [o.shop_id, me.id, rem]);
      await q.run("UPDATE stock_orders SET status = 'cancelled' WHERE id = $1", [o.id]);
      return { ok: true };
    });
  }

  async function stock(meId, shopId) {
    const id = Number(shopId);
    const s = await db.one(`${shopSelect} WHERE s.id = $2`, [Date.now() - DAY, id]);
    if (!s) throw new GameError('Boutique introuvable.', 404);
    const level = (side) => db.all(`SELECT price, SUM(qty - filled)::int qty, COUNT(*)::int orders FROM stock_orders
      WHERE shop_id = $1 AND side = $2 AND status = 'open' GROUP BY price ORDER BY price ${side === 'buy' ? 'DESC' : 'ASC'} LIMIT 10`, [id, side]);
    const [bids, asks, trades, history, mine, holding, top] = await Promise.all([
      level('buy'), level('sell'),
      db.all('SELECT t.price, t.qty, t.at FROM stock_trades t WHERE t.shop_id = $1 ORDER BY t.id DESC LIMIT 20', [id]),
      db.all(`SELECT (at / 3600000) * 3600000 AS at, (array_agg(price ORDER BY id DESC))[1] AS price, SUM(qty)::int AS vol
        FROM stock_trades WHERE shop_id = $1 AND at > $2 GROUP BY 1 ORDER BY 1`, [id, Date.now() - 30 * DAY]),
      db.all("SELECT * FROM stock_orders WHERE shop_id = $1 AND user_id = $2 AND status = 'open' ORDER BY id DESC", [id, meId]),
      db.one('SELECT qty, locked FROM shares WHERE shop_id = $1 AND user_id = $2', [id, meId]),
      db.all(`SELECT u.username, h.qty FROM shares h JOIN users u ON u.id = h.user_id WHERE h.shop_id = $1 AND h.qty > 0 ORDER BY h.qty DESC LIMIT 10`, [id]),
    ]);
    const me = await db.one('SELECT bits FROM users WHERE id = $1', [meId]);
    return { shop: shopView(s), bids, asks, trades, history, myOrders: mine, holding: holding || { qty: 0, locked: 0 }, holders: top, bits: me.bits };
  }

  async function portfolio(userId) {
    const rows = await db.all(`SELECT h.qty, h.locked, s.id, s.name, s.last_price, s.total_shares, s.div_pct, s.balance,
        (SELECT per_share FROM shop_payouts p WHERE p.shop_id = s.id ORDER BY day DESC LIMIT 1) last_div
      FROM shares h JOIN shops s ON s.id = h.shop_id WHERE h.user_id = $1 AND h.qty > 0 ORDER BY h.qty * COALESCE(s.last_price, 0) DESC`, [userId]);
    const orders = await db.all(`SELECT o.*, s.name shop_name FROM stock_orders o JOIN shops s ON s.id = o.shop_id
      WHERE o.user_id = $1 AND o.status = 'open' ORDER BY o.id DESC`, [userId]);
    return { items: rows, orders, value: rows.reduce((a, r) => a + r.qty * (r.last_price || 0), 0) };
  }

  // ---------- Tâches périodiques (appelées par la tâche planifiée) ----------
  async function dailyJobs() {
    const now = Date.now(), today = dayId(now);
    const out = { dividends: 0, collected: 0, expired: 0 };
    // Dividendes : une fois par jour et par boutique, une part du coffre répartie selon les actions.
    const due = await db.all('SELECT id FROM shops WHERE div_day < $1 ORDER BY id LIMIT 50', [today]);
    for (const { id } of due) {
      await db.tx(async (q) => {
        const s = await q.one('SELECT * FROM shops WHERE id = $1 AND div_day < $2 FOR UPDATE', [id, today]);
        if (!s) return;
        await q.run('UPDATE shops SET div_day = $1 WHERE id = $2', [today, s.id]);
        const pot = Math.floor((s.balance * s.div_pct) / 100);
        if (pot < 1) return;
        const holders = await q.all('SELECT user_id, qty FROM shares WHERE shop_id = $1 AND qty > 0', [s.id]);
        let paid = 0;
        for (const h of holders) {
          const amount = Math.floor((pot * h.qty) / s.total_shares);
          if (amount < 1) continue;
          await game.credit(q, h.user_id, amount);
          await game.notify(q, h.user_id, `Dividende de ${s.name} : +${amount} bits (${h.qty} action${h.qty > 1 ? 's' : ''}).`, `#/bourse/${s.id}`);
          paid += amount;
        }
        await q.run('UPDATE shops SET balance = balance - $1 WHERE id = $2', [paid, s.id]);
        await q.run('INSERT INTO shop_payouts (shop_id, day, amount, per_share) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [s.id, today, paid, pot / s.total_shares]);
        out.dividends++;
      });
    }
    // Échéances de prêts : prélèvement automatique ; s'il manque des bits, le prêt passe en défaut et on réessaie chaque jour.
    const loans = await db.all("SELECT id FROM shop_loans WHERE status IN ('active', 'defaulted') AND due_at <= $1 ORDER BY due_at LIMIT 50", [now]);
    for (const { id } of loans) {
      await db.tx(async (q) => {
        const l = await q.one("SELECT * FROM shop_loans WHERE id = $1 AND status IN ('active', 'defaulted') AND due_at <= $2 FOR UPDATE", [id, now]);
        if (!l) return;
        const u = await lockUser(q, l.borrower_id);
        const s = await q.one('SELECT id, name, owner_id FROM shops WHERE id = $1 FOR UPDATE', [l.shop_id]);
        const left = l.due_amount - l.paid;
        const take = Math.min(left, u.bits);
        if (take > 0) await game.debit(q, u.id, take);
        const paid = await payLoan(q, l, take);
        if (paid >= l.due_amount) {
          await game.notify(q, u.id, `Prêt de ${s.name} remboursé (${l.due_amount} bits).`, '#/loans');
        } else {
          await q.run("UPDATE shop_loans SET status = 'defaulted', due_at = $1 WHERE id = $2", [now + DAY, l.id]);
          await game.notify(q, u.id, `Prêt de ${s.name} : il manque ${l.due_amount - paid} bits. Nouveau prélèvement demain.`, '#/loans');
          if (l.status !== 'defaulted') await game.notify(q, s.owner_id, `${u.username} n'a pas pu rembourser son prêt (${l.due_amount - paid} bits manquants).`, `#/shop/${s.id}`);
        }
        out.collected++;
      });
    }
    out.expired = await db.run("UPDATE shop_loans SET status = 'expired' WHERE status = 'pending' AND created_at < $1", [now - LOAN_PENDING_MS]);
    return out;
  }

  return {
    sealPack, myPacks, openSealed, listShops, createShop, updateShop, deposit, shopDetail, listPack, cancelListing, buyListing,
    requestLoan, respondLoan, repayLoan, myLoans, placeOrder, cancelOrder, stock, portfolio, dailyJobs, odds,
  };
}
