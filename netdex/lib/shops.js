// Boutiques d'échange, boosters scellés, prêts et parts de boutiques.
//  - Un booster scellé a une « qualité » tirée au moment où on le scelle : elle multiplie les chances des raretés hautes.
//    Les probabilités affichées sont les vraies : le contenu n'est tiré qu'à l'ouverture, avec ces chances-là.
//  - Une boutique (25 000 bits) prend une commission sur chaque booster vendu chez elle ; la commission remplit son coffre.
//  - Le coffre sert à prêter aux joueurs (avec intérêts) et à verser des dividendes quotidiens aux détenteurs de parts.
//  - Bourse : chaque boutique a 1 000 parts. On les achète directement à la boutique, au prix fixé par le propriétaire ;
//    l'argent va dans le coffre. La boutique peut racheter les parts (à un pourcentage du prix choisi par le propriétaire).
import { GameError, QUALITIES, rollQuality } from './game.js';

export const SHOP_PRICE = 25_000;
// Boutique Premium : plus chère, commission jusqu'à 40 %, et les boosters achetés chez elle gagnent +15 % de chances (une seule fois par booster).
export const TIERS = {
  standard: { name: 'Standard', price: 25_000, maxFee: 25, packBonus: 1 },
  premium: { name: 'Premium', price: 30_000, maxFee: 40, packBonus: 1.15 },
};
export const TOTAL_SHARES = 1000;
export const SHOP_COLORS = ['#ff5b1f', '#3d8ee6', '#57b26a', '#9b5de5', '#e5484d', '#e0a100', '#14b8a6', '#ec4899'];
export const WITHDRAW_PCT = 25; // part du coffre que le propriétaire peut se verser par jour
export { QUALITIES };
const MAX_SEALED = 30;
const MAX_LISTINGS = 20;
const MAX_LOANS = 3;
const LOAN_PENDING_MS = 48 * 3600e3;
const OFFER_MS = 48 * 3600e3; // durée de vie d'une offre de parts
const MAX_OFFERS = 10;
const DAY = 24 * 3600e3;
const dayId = (t = Date.now()) => Math.floor(t / DAY);

// Dividende versé chaque jour pour une part (en bits, avec décimales).
//  - mode « coffre » : div_pct % du coffre, partagé entre les 1 000 parts ;
//  - mode « fixe »   : div_pct % du prix d'une part.
export function divPerShare(s) {
  if (!(s.div_pct > 0)) return 0;
  return s.div_mode === 'fixe' ? (s.share_price * s.div_pct) / 100 : (Number(s.balance) * s.div_pct) / 100 / (s.total_shares || TOTAL_SHARES);
}
// Somme à rembourser : montant × (1 + taux de base + taux par jour × durée) + frais de dossier.
export function loanDue(s, amount, days) {
  return Math.ceil(amount * (1 + (s.loan_rate + (s.loan_daily || 0) * days) / 100)) + (s.loan_fee || 0);
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
      const { boost, quality } = await game.takeNextPack(q, u); // il garde la qualité affichée sur l'accueil
      await game.consumeFreePack(q, u);
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
      (SELECT COALESCE(SUM(qty), 0) FROM shares h WHERE h.shop_id = s.id) sold,
      (SELECT COUNT(*) FROM shares h WHERE h.shop_id = s.id AND h.qty > 0) holders
    FROM shops s JOIN users u ON u.id = s.owner_id`;
  const tierOf = (s) => TIERS[s.tier] || TIERS.standard;
  const shopView = (s) => {
    const sold = Number(s.sold || 0);
    return {
      tier: s.tier || 'standard', tierName: tierOf(s).name, maxFee: tierOf(s).maxFee, packBonus: tierOf(s).packBonus,
      id: s.id, name: s.name, description: s.description, ownerId: s.owner_id, owner: s.owner_name, isOpen: s.is_open !== false,
      color: s.color || '', emoji: s.emoji || '', accepts: s.accepts, balance: Number(s.balance),
      // Ventes de boosters
      feePct: s.fee_pct, listingFee: s.listing_fee, minPrice: s.min_price, maxPrice: s.max_price, sellerMax: s.seller_max, holderDiscount: s.holder_discount,
      // Parts
      sharePrice: s.share_price, sharesMax: s.shares_max, sharesSold: sold, sharesLeft: Math.max(0, s.shares_max - sold), maxPerPlayer: s.max_per_player,
      buybackPct: s.buyback_pct, transferFee: s.transfer_fee, divMode: s.div_mode, divPct: s.div_pct, totalShares: s.total_shares, sharesRaised: Number(s.shares_raised), holders: Number(s.holders || 0),
      divPerShare: divPerShare(s),
      // Prêts
      loanRate: s.loan_rate, loanDaily: s.loan_daily, loanFee: s.loan_fee, loanLate: s.loan_late, loanMin: s.loan_min, loanMax: s.loan_max,
      loanMinDays: s.loan_min_days, loanMaxDays: s.loan_max_days, loanAuto: s.loan_auto,
      withdrawnTotal: Number(s.withdrawn_total), listings: Number(s.listings || 0), salesCount: s.sales_count, feesTotal: Number(s.fees_total), createdAt: s.created_at,
    };
  };

  async function listShops() {
    const rows = await db.all(`${shopSelect} ORDER BY s.sales_count DESC, s.id`);
    return { items: rows.map(shopView), price: SHOP_PRICE, tiers: TIERS, colors: SHOP_COLORS };
  }

  // Tous les réglages modifiables par le propriétaire, avec leurs bornes.
  function cleanSettings(b, cur = {}, tier = cur.tier || 'standard') {
    const pick = (k, ck) => (b[k] !== undefined ? b[k] : cur[ck]);
    const num = (k, ck, lo, hi, def, label, int = false) => {
      const v = pick(k, ck);
      if (v === undefined || v === null || v === '') return def;
      const n = Number(v);
      if (!(n >= lo && n <= hi)) throw new GameError(`${label} : entre ${lo} et ${hi}.`);
      return int ? Math.floor(n) : Math.round(n * 10) / 10;
    };
    const name = String(pick('name', 'name') ?? '').replace(/\s+/g, ' ').trim();
    if (name.length < 3 || name.length > 30) throw new GameError('Nom de boutique : 3 à 30 caractères.');
    const accepts = b.accepts !== undefined ? [...new Set((b.accepts || []).filter((x) => QUALITIES[x]))] : cur.accepts;
    if (!accepts?.length) throw new GameError('La boutique doit accepter au moins une qualité de booster.');
    const color = String(pick('color', 'color') ?? '');
    if (color && !SHOP_COLORS.includes(color)) throw new GameError('Couleur invalide.');
    const emoji = String(pick('emoji', 'emoji') ?? '').replace(/[<>&"'\s]/g, '').slice(0, 8);
    const divMode = (pick('divMode', 'div_mode') || 'coffre') === 'fixe' ? 'fixe' : 'coffre';
    const c = {
      name, accepts, color, emoji, div_mode: divMode,
      description: String(pick('description', 'description') ?? '').trim().slice(0, 280),
      is_open: b.isOpen !== undefined ? !!b.isOpen : cur.is_open !== false,
      fee_pct: num('feePct', 'fee_pct', 0, TIERS[tier].maxFee, 5, 'Commission (%)'),
      listing_fee: num('listingFee', 'listing_fee', 0, 100_000, 0, 'Frais de dépôt', true),
      min_price: num('minPrice', 'min_price', 0, 10_000_000, 0, 'Prix minimum', true),
      max_price: num('maxPrice', 'max_price', 0, 10_000_000, 0, 'Prix maximum', true),
      seller_max: num('sellerMax', 'seller_max', 0, MAX_LISTINGS, 0, 'Annonces par vendeur', true),
      holder_discount: num('holderDiscount', 'holder_discount', 0, 100, 0, 'Réduction actionnaires (%)'),
      share_price: num('sharePrice', 'share_price', 1, 1_000_000, 10, 'Prix d\'une part', true),
      shares_max: num('sharesMax', 'shares_max', 0, TOTAL_SHARES, TOTAL_SHARES, 'Parts à vendre', true),
      max_per_player: num('maxPerPlayer', 'max_per_player', 1, TOTAL_SHARES, TOTAL_SHARES, 'Parts maximum par joueur', true),
      buyback_pct: num('buybackPct', 'buyback_pct', 0, 100, 0, 'Rachat des parts (%)'),
      transfer_fee: num('transferFee', 'transfer_fee', 0, 20, 0, 'Taxe sur les reventes entre joueurs (%)'),
      div_pct: num('divPct', 'div_pct', 0, divMode === 'fixe' ? 20 : 50, 0, divMode === 'fixe' ? 'Dividende (% du prix d\'une part par jour)' : 'Dividende (% du coffre par jour)'),
      loan_rate: num('loanRate', 'loan_rate', 0, 200, 10, 'Intérêts de base (%)'),
      loan_daily: num('loanDaily', 'loan_daily', 0, 20, 0, 'Intérêts par jour (%)'),
      loan_fee: num('loanFee', 'loan_fee', 0, 100_000, 0, 'Frais de dossier', true),
      loan_late: num('loanLate', 'loan_late', 0, 20, 0, 'Pénalité de retard (% par jour)'),
      loan_min: num('loanMin', 'loan_min', 1, 1_000_000, 1, 'Prêt minimum', true),
      loan_max: num('loanMax', 'loan_max', 0, 1_000_000, 1000, 'Prêt maximum', true),
      loan_min_days: num('loanMinDays', 'loan_min_days', 1, 30, 1, 'Durée minimum', true),
      loan_max_days: num('loanMaxDays', 'loan_max_days', 1, 30, 14, 'Durée maximum', true),
      loan_auto: num('loanAuto', 'loan_auto', 0, 1_000_000, 0, 'Acceptation automatique', true),
    };
    if (c.max_price && c.min_price > c.max_price) throw new GameError('Le prix minimum dépasse le prix maximum.');
    if (c.loan_min_days > c.loan_max_days) throw new GameError('La durée minimum des prêts dépasse la durée maximum.');
    if (c.loan_max && c.loan_min > c.loan_max) throw new GameError('Le prêt minimum dépasse le prêt maximum.');
    return c;
  }
  const COLS = ['name', 'description', 'accepts', 'color', 'emoji', 'is_open', 'fee_pct', 'listing_fee', 'min_price', 'max_price', 'seller_max', 'holder_discount',
    'share_price', 'shares_max', 'max_per_player', 'buyback_pct', 'transfer_fee', 'div_mode', 'div_pct', 'loan_rate', 'loan_daily', 'loan_fee', 'loan_late', 'loan_min', 'loan_max',
    'loan_min_days', 'loan_max_days', 'loan_auto'];

  async function createShop(me, body) {
    const tier = TIERS[body.tier] ? body.tier : 'standard';
    const c = cleanSettings({ accepts: Object.keys(QUALITIES), ...body }, {}, tier);
    const price = TIERS[tier].price;
    return db.tx(async (q) => {
      if (await q.one('SELECT 1 FROM shops WHERE lower(name) = lower($1)', [c.name])) throw new GameError('Ce nom de boutique est déjà pris.');
      await game.debit(q, me.id, price, `Il faut ${price.toLocaleString('fr-FR')} bits pour ouvrir une boutique ${TIERS[tier].name}.`);
      const s = await q.one(`INSERT INTO shops (owner_id, total_shares, div_day, created_at, tier, ${COLS.join(', ')})
        VALUES ($1, $2, $3, $4, $5, ${COLS.map((_, i) => '$' + (i + 6)).join(', ')}) RETURNING id`,
      [me.id, TOTAL_SHARES, dayId(), Date.now(), tier, ...COLS.map((k) => c[k])]);
      return { id: s.id };
    });
  }

  const ownShop = async (q, me, shopId, msg = 'Seul le propriétaire peut faire ça.') => {
    const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [Number(shopId)]);
    if (!s) throw new GameError('Boutique introuvable.', 404);
    if (s.owner_id !== me.id) throw new GameError(msg, 403);
    return s;
  };
  const soldOf = async (q, shopId) => Number((await q.one('SELECT COALESCE(SUM(qty), 0) n FROM shares WHERE shop_id = $1', [shopId])).n);
  const log = (q, shopId, userId, kind, qty, amount) => q.run('INSERT INTO shop_log (shop_id, user_id, kind, qty, amount, at) VALUES ($1, $2, $3, $4, $5, $6)', [shopId, userId, kind, qty, amount, Date.now()]);

  // Une boutique Standard passe Premium en payant la différence.
  async function upgradeShop(me, shopId) {
    return db.tx(async (q) => {
      const s = await ownShop(q, me, shopId, 'Seul le propriétaire peut faire évoluer la boutique.');
      if (s.tier === 'premium') throw new GameError('Cette boutique est déjà Premium.');
      const cost = TIERS.premium.price - TIERS.standard.price;
      await game.debit(q, me.id, cost, `Il faut ${cost.toLocaleString('fr-FR')} bits.`);
      await q.run("UPDATE shops SET tier = 'premium' WHERE id = $1", [s.id]);
      return { ok: true, cost };
    });
  }

  async function updateShop(me, shopId, body) {
    return db.tx(async (q) => {
      const s = await ownShop(q, me, shopId, 'Seul le propriétaire peut modifier la boutique.');
      const c = cleanSettings(body, s);
      if (c.name.toLowerCase() !== s.name.toLowerCase() && await q.one('SELECT 1 FROM shops WHERE lower(name) = lower($1)', [c.name])) throw new GameError('Ce nom de boutique est déjà pris.');
      const sold = await soldOf(q, s.id);
      if (c.shares_max < sold) throw new GameError(`${sold} parts sont déjà vendues : tu ne peux pas en proposer moins.`);
      await q.run(`UPDATE shops SET ${COLS.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [s.id, ...COLS.map((k) => c[k])]);
      return { ok: true };
    });
  }

  async function deposit(me, shopId, amount) {
    const n = intIn(amount, 1, 10_000_000, 'Montant invalide.');
    return db.tx(async (q) => {
      const s = await ownShop(q, me, shopId, 'Seul le propriétaire peut alimenter le coffre.');
      await game.debit(q, me.id, n);
      await q.run('UPDATE shops SET balance = balance + $1 WHERE id = $2', [n, s.id]);
      return { ok: true };
    });
  }

  // Le propriétaire peut se verser une partie du coffre : 25 % au plus par jour, et c'est affiché publiquement.
  function withdrawRoom(s, day = dayId()) {
    const today = s.withdraw_day === day ? Number(s.withdraw_today) : 0;
    return Math.max(0, Math.floor((Number(s.balance) + today) * WITHDRAW_PCT / 100) - today);
  }
  async function withdraw(me, shopId, amount) {
    const n = intIn(amount, 1, 10_000_000, 'Montant invalide.');
    return db.tx(async (q) => {
      const s = await ownShop(q, me, shopId, 'Seul le propriétaire peut retirer du coffre.');
      const day = dayId(), room = withdrawRoom(s, day);
      if (n > room) throw new GameError(`Tu peux retirer au plus ${room} bits aujourd'hui (${WITHDRAW_PCT} % du coffre par jour).`);
      const today = (s.withdraw_day === day ? Number(s.withdraw_today) : 0) + n;
      await q.run('UPDATE shops SET balance = balance - $1, withdraw_day = $2, withdraw_today = $3, withdrawn_total = withdrawn_total + $1 WHERE id = $4', [n, day, today, s.id]);
      await game.credit(q, me.id, n);
      await log(q, s.id, me.id, 'retrait', 0, n);
      return { ok: true, left: room - n };
    });
  }

  // Fermeture définitive : boosters rendus aux vendeurs, prêts annulés, actionnaires remboursés au prix d'une part
  // (au prorata si le coffre ne suffit pas), le reste du coffre revient au propriétaire.
  async function deleteShop(me, shopId) {
    return db.tx(async (q) => {
      const s = await ownShop(q, me, shopId, 'Seul le propriétaire peut supprimer la boutique.');
      const listings = await q.all("SELECT * FROM shop_listings WHERE shop_id = $1 AND status = 'open'", [s.id]);
      for (const l of listings) {
        await q.run("UPDATE sealed_packs SET status = 'owned' WHERE id = $1", [l.pack_id]);
        await game.notify(q, l.seller_id, `${s.name} a fermé : ton booster scellé t'a été rendu.`, '#/');
      }
      const loans = await q.all("SELECT * FROM shop_loans WHERE shop_id = $1 AND status IN ('pending', 'active', 'defaulted')", [s.id]);
      for (const l of loans) {
        await game.notify(q, l.borrower_id, l.status === 'pending' ? `${s.name} a fermé : ta demande de prêt est annulée.` : `${s.name} a fermé : ton prêt est annulé, tu n'as plus rien à rembourser.`, '#/loans');
      }
      const offers = await q.all("SELECT * FROM share_offers WHERE shop_id = $1 AND status = 'pending'", [s.id]);
      for (const o of offers) await game.credit(q, o.buyer_id, o.qty * o.price); // bits bloqués rendus
      let balance = Number(s.balance);
      const holders = await q.all('SELECT user_id, qty FROM shares WHERE shop_id = $1 AND qty > 0', [s.id]);
      const owed = holders.reduce((a, h) => a + h.qty * s.share_price, 0);
      const ratio = owed > balance ? balance / owed : 1;
      let refunded = 0;
      for (const h of holders) {
        const amount = Math.floor(h.qty * s.share_price * ratio);
        if (amount > 0) await game.credit(q, h.user_id, amount);
        refunded += amount;
        await game.notify(q, h.user_id, `${s.name} a fermé : tes ${h.qty} part${h.qty > 1 ? 's' : ''} t'ont été remboursée${h.qty > 1 ? 's' : ''} ${amount} bits.`, '#/bourse');
      }
      balance -= refunded;
      if (balance > 0) await game.credit(q, me.id, balance);
      await q.run('DELETE FROM shops WHERE id = $1', [s.id]);
      return { ok: true, listings: listings.length, loans: loans.length, holders: holders.length, refunded, toOwner: Math.max(0, balance) };
    });
  }

  async function shopDetail(meId, shopId) {
    const s = await db.one(`${shopSelect} WHERE s.id = $1`, [Number(shopId)]);
    if (!s) throw new GameError('Boutique introuvable.', 404);
    const owner = s.owner_id === meId;
    const [listings, myLoans, pending, active, myShares, payouts] = await Promise.all([
      db.all(`SELECT l.id, l.price, l.created_at, l.seller_id, u.username seller, p.id pack_id, p.boost, p.quality, p.status, p.created_at pack_created, p.shop_boosted
        FROM shop_listings l JOIN sealed_packs p ON p.id = l.pack_id JOIN users u ON u.id = l.seller_id
        WHERE l.shop_id = $1 AND l.status = 'open' ORDER BY p.boost DESC, l.price ASC LIMIT 100`, [s.id]),
      db.all("SELECT * FROM shop_loans WHERE shop_id = $1 AND borrower_id = $2 AND status IN ('pending', 'active', 'defaulted') ORDER BY id DESC", [s.id, meId]),
      owner ? db.all(`SELECT l.*, u.username, u.dex_score, u.created_at user_created,
          (SELECT COUNT(*) FROM shop_loans x WHERE x.borrower_id = l.borrower_id AND x.status = 'repaid') repaid_count,
          (SELECT COUNT(*) FROM shop_loans x WHERE x.borrower_id = l.borrower_id AND x.status = 'defaulted') default_count
        FROM shop_loans l JOIN users u ON u.id = l.borrower_id WHERE l.shop_id = $1 AND l.status = 'pending' ORDER BY l.id`, [s.id]) : [],
      owner ? db.all(`SELECT l.*, u.username FROM shop_loans l JOIN users u ON u.id = l.borrower_id
        WHERE l.shop_id = $1 AND l.status IN ('active', 'defaulted') ORDER BY l.due_at`, [s.id]) : [],
      db.one('SELECT qty FROM shares WHERE shop_id = $1 AND user_id = $2', [s.id, meId]),
      db.all('SELECT day, amount, per_share FROM shop_payouts WHERE shop_id = $1 ORDER BY day DESC LIMIT 7', [s.id]),
    ]);
    return {
      shop: shopView(s), owner, qualities: QUALITIES, colors: SHOP_COLORS,
      holderFee: myShares?.qty > 0 ? +(s.fee_pct * (1 - s.holder_discount / 100)).toFixed(2) : null,
      withdrawRoom: owner ? withdrawRoom(s) : null, withdrawPct: WITHDRAW_PCT,
      // En boutique Premium, on affiche les chances que le booster aura une fois acheté (+15 %).
      listings: listings.map((l) => {
        const bonus = !l.shop_boosted ? tierOf(s).packBonus || 1 : 1;
        return { id: l.id, price: l.price, seller: l.seller, mine: l.seller_id === meId, bonus: bonus > 1,
          pack: packView({ id: l.pack_id, boost: +(l.boost * bonus).toFixed(2), quality: l.quality, status: l.status, created_at: l.pack_created }) };
      }),
      myLoans, pendingLoans: pending, activeLoans: active, myShares: myShares?.qty || 0, payouts,
    };
  }

  // ---------- Vente de boosters en boutique ----------
  async function listPack(me, body) {
    const price = intIn(body.price, 1, 10_000_000, 'Prix invalide.');
    return db.tx(async (q) => {
      const p = await q.one("SELECT * FROM sealed_packs WHERE id = $1 AND owner_id = $2 AND status = 'owned' FOR UPDATE", [Number(body.packId), me.id]);
      if (!p) throw new GameError('Booster indisponible.');
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [Number(body.shopId)]);
      if (!s) throw new GameError('Boutique introuvable.', 404);
      if (!s.is_open) throw new GameError(`${s.name} est fermée pour le moment.`);
      if (!s.accepts.includes(p.quality)) throw new GameError(`${s.name} n'accepte pas les boosters ${QUALITIES[p.quality].name}.`);
      if (s.min_price && price < s.min_price) throw new GameError(`${s.name} demande un prix d'au moins ${s.min_price} bits.`);
      if (s.max_price && price > s.max_price) throw new GameError(`${s.name} n'accepte pas de prix au-dessus de ${s.max_price} bits.`);
      const n = (await q.one("SELECT COUNT(*) n FROM shop_listings WHERE seller_id = $1 AND status = 'open'", [me.id])).n;
      if (n >= MAX_LISTINGS) throw new GameError(`Maximum ${MAX_LISTINGS} boosters en vente.`);
      if (s.seller_max && s.owner_id !== me.id) {
        const here = (await q.one("SELECT COUNT(*) n FROM shop_listings WHERE seller_id = $1 AND shop_id = $2 AND status = 'open'", [me.id, s.id])).n;
        if (here >= s.seller_max) throw new GameError(`${s.name} limite à ${s.seller_max} booster${s.seller_max > 1 ? 's' : ''} en vente par vendeur.`);
      }
      // Frais de dépôt : payés tout de suite, ils vont dans le coffre (même si le booster ne se vend pas).
      if (s.listing_fee && s.owner_id !== me.id) {
        await game.debit(q, me.id, s.listing_fee, `${s.name} demande ${s.listing_fee} bits de frais de dépôt.`);
        await q.run('UPDATE shops SET balance = balance + $1, fees_total = fees_total + $1 WHERE id = $2', [s.listing_fee, s.id]);
      }
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
      if (!s.is_open) throw new GameError(`${s.name} est fermée pour le moment.`);
      await game.debit(q, me.id, l.price);
      // Les actionnaires de la boutique paient une commission réduite.
      const holder = s.holder_discount > 0 && (await q.one('SELECT qty FROM shares WHERE shop_id = $1 AND user_id = $2 AND qty > 0', [s.id, me.id]));
      const pct = s.fee_pct * (holder ? 1 - s.holder_discount / 100 : 1);
      const fee = Math.floor((l.price * pct) / 100);
      await game.credit(q, l.seller_id, l.price - fee);
      await q.run('UPDATE shops SET balance = balance + $1, fees_total = fees_total + $1, sales_count = sales_count + 1 WHERE id = $2', [fee, s.id]);
      // Boutique Premium : +15 % de chances sur le booster, une seule fois dans sa vie.
      const bonus = tierOf(s).packBonus || 1;
      const boosted = await q.one(`UPDATE sealed_packs SET owner_id = $1, status = 'owned',
          boost = CASE WHEN $3::real > 1 AND NOT shop_boosted THEN round((boost * $3::real)::numeric, 2) ELSE boost END,
          shop_boosted = shop_boosted OR $3::real > 1
        WHERE id = $2 RETURNING boost`, [me.id, l.pack_id, bonus]);
      await q.run("UPDATE shop_listings SET status = 'sold', buyer_id = $1, sold_at = $2 WHERE id = $3", [me.id, Date.now(), l.id]);
      await game.notify(q, l.seller_id, `Ton booster a été vendu ${l.price} bits chez ${s.name} (−${fee} de commission).`, `#/shop/${s.id}`);
      return { ok: true, fee, boost: boosted.boost };
    });
  }

  // ---------- Prêts ----------
  // Intérêts : un taux de base + un taux par jour de durée (plus le prêt est long, plus il coûte) + des frais de dossier.
  async function requestLoan(me, shopId, body) {
    const amount = intIn(body.amount, 1, 1_000_000, 'Montant invalide.');
    return db.tx(async (q) => {
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [Number(shopId)]);
      if (!s) throw new GameError('Boutique introuvable.', 404);
      if (!s.is_open) throw new GameError(`${s.name} est fermée pour le moment.`);
      if (s.owner_id === me.id) throw new GameError('Tu ne peux pas emprunter à ta propre boutique.');
      if (!s.loan_max) throw new GameError(`${s.name} ne fait pas de prêts.`);
      const days = intIn(body.days, s.loan_min_days, s.loan_max_days, `Durée : de ${s.loan_min_days} à ${s.loan_max_days} jours.`);
      if (amount < s.loan_min) throw new GameError(`Cette boutique prête au minimum ${s.loan_min} bits.`);
      if (amount > s.loan_max) throw new GameError(`Cette boutique prête au maximum ${s.loan_max} bits.`);
      const mine = await q.all("SELECT shop_id, status FROM shop_loans WHERE borrower_id = $1 AND status IN ('pending', 'active', 'defaulted')", [me.id]);
      if (mine.some((x) => x.status === 'defaulted')) throw new GameError('Tu as un prêt impayé : rembourse-le d\'abord.');
      if (mine.some((x) => x.shop_id === s.id)) throw new GameError('Tu as déjà une demande ou un prêt en cours avec cette boutique.');
      if (mine.length >= MAX_LOANS) throw new GameError(`Maximum ${MAX_LOANS} prêts en même temps.`);
      const rate = +(s.loan_rate + s.loan_daily * days).toFixed(2);
      const due = loanDue(s, amount, days);
      const l = await q.one(`INSERT INTO shop_loans (shop_id, borrower_id, amount, rate, days, due_amount, created_at, late_pct)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [s.id, me.id, amount, rate, days, due, Date.now(), s.loan_late]);
      // Acceptation automatique pour les petits montants, si l'emprunteur n'a jamais fait défaut.
      if (s.loan_auto >= amount && Number(s.balance) >= amount) {
        const bad = await q.one("SELECT 1 FROM shop_loans WHERE borrower_id = $1 AND status = 'defaulted' LIMIT 1", [me.id]);
        if (!bad) { await grantLoan(q, l, s); return { id: l.id, due, status: 'active' }; }
      }
      await game.notify(q, s.owner_id, `${me.username} demande un prêt de ${amount} bits à ${s.name} (${days} j, à rembourser ${due}).`, `#/shop/${s.id}`);
      return { id: l.id, due, status: 'pending' };
    });
  }

  async function grantLoan(q, l, s) {
    const now = Date.now();
    if (Number(s.balance) < l.amount) throw new GameError(`Le coffre ne contient que ${s.balance} bits.`);
    await q.run('UPDATE shops SET balance = balance - $1 WHERE id = $2', [l.amount, s.id]);
    await game.credit(q, l.borrower_id, l.amount);
    await q.run("UPDATE shop_loans SET status = 'active', accepted_at = $1, due_at = $2 WHERE id = $3", [now, now + l.days * DAY, l.id]);
    await game.notify(q, l.borrower_id, `${s.name} t'a prêté ${l.amount} bits. À rembourser : ${l.due_amount} bits dans ${l.days} j.`, '#/loans');
  }

  async function respondLoan(me, loanId, accept) {
    return db.tx(async (q) => {
      const l = await q.one("SELECT * FROM shop_loans WHERE id = $1 AND status = 'pending' FOR UPDATE", [Number(loanId)]);
      if (!l) throw new GameError('Demande introuvable.', 404);
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [l.shop_id]);
      if (s.owner_id !== me.id) throw new GameError('Seul le propriétaire décide.', 403);
      if (!accept) {
        await q.run("UPDATE shop_loans SET status = 'refused' WHERE id = $1", [l.id]);
        await game.notify(q, l.borrower_id, `${s.name} a refusé ta demande de prêt.`, `#/shop/${s.id}`);
        return { status: 'refused' };
      }
      await grantLoan(q, l, s);
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

  // ---------- Bourse : parts achetées directement à la boutique ----------
  // Le prix d'une part est fixé par le propriétaire. L'argent va dans le coffre ; chaque jour, la boutique verse
  // des dividendes à chaque détenteur selon son nombre de parts. Si le propriétaire l'autorise, la boutique
  // rachète les parts à un pourcentage de leur prix.
  async function buyShares(me, shopId, qtyIn) {
    const qty = intIn(qtyIn, 1, TOTAL_SHARES, 'Nombre de parts invalide.');
    return db.tx(async (q) => {
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [Number(shopId)]);
      if (!s) throw new GameError('Boutique introuvable.', 404);
      if (!s.is_open) throw new GameError(`${s.name} est fermée pour le moment.`);
      if (s.owner_id === me.id) throw new GameError('Tu ne peux pas acheter des parts de ta propre boutique.');
      const left = s.shares_max - await soldOf(q, s.id);
      if (left <= 0) throw new GameError(`${s.name} n'a plus de parts à vendre.`);
      if (qty > left) throw new GameError(`Il ne reste que ${left} part${left > 1 ? 's' : ''} à vendre.`);
      const mine = Number((await q.one('SELECT qty FROM shares WHERE shop_id = $1 AND user_id = $2', [s.id, me.id]))?.qty || 0);
      if (mine + qty > s.max_per_player) throw new GameError(`${s.name} limite à ${s.max_per_player} parts par joueur (tu en as ${mine}).`);
      const cost = qty * s.share_price;
      await game.debit(q, me.id, cost, `Il te faut ${cost} bits pour ${qty} part${qty > 1 ? 's' : ''}.`);
      await q.run('UPDATE shops SET balance = balance + $1, shares_raised = shares_raised + $1 WHERE id = $2', [cost, s.id]);
      await q.run(`INSERT INTO shares (shop_id, user_id, qty, paid) VALUES ($1, $2, $3, $4)
        ON CONFLICT (shop_id, user_id) DO UPDATE SET qty = shares.qty + EXCLUDED.qty, paid = shares.paid + EXCLUDED.paid`, [s.id, me.id, qty, cost]);
      await log(q, s.id, me.id, 'achat', qty, cost);
      await game.notify(q, s.owner_id, `${me.username} a acheté ${qty} part${qty > 1 ? 's' : ''} de ${s.name} (${cost} bits dans le coffre).`, `#/bourse/${s.id}`);
      return { qty: mine + qty, cost };
    });
  }

  async function sellShares(me, shopId, qtyIn) {
    const qty = intIn(qtyIn, 1, TOTAL_SHARES, 'Nombre de parts invalide.');
    return db.tx(async (q) => {
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [Number(shopId)]);
      if (!s) throw new GameError('Boutique introuvable.', 404);
      if (!(s.buyback_pct > 0)) throw new GameError(`${s.name} ne rachète pas ses parts.`);
      const h = await q.one('SELECT * FROM shares WHERE shop_id = $1 AND user_id = $2 FOR UPDATE', [s.id, me.id]);
      if (!h || h.qty < qty) throw new GameError(`Tu n'as que ${h?.qty || 0} part${h?.qty > 1 ? 's' : ''}.`);
      const amount = Math.floor((qty * s.share_price * s.buyback_pct) / 100);
      if (Number(s.balance) < amount) throw new GameError(`Le coffre de ${s.name} ne contient que ${s.balance} bits : pas assez pour te racheter ces parts.`);
      await q.run('UPDATE shops SET balance = balance - $1 WHERE id = $2', [amount, s.id]);
      await game.credit(q, me.id, amount);
      const paidPart = Math.round((Number(h.paid) * qty) / h.qty);
      await q.run('UPDATE shares SET qty = qty - $3, paid = GREATEST(0, paid - $4) WHERE shop_id = $1 AND user_id = $2', [s.id, me.id, qty, paidPart]);
      await log(q, s.id, me.id, 'revente', qty, amount);
      return { qty: h.qty - qty, amount };
    });
  }

  async function stock(meId, shopId) {
    const id = Number(shopId);
    const s = await db.one(`${shopSelect} WHERE s.id = $1`, [id]);
    if (!s) throw new GameError('Boutique introuvable.', 404);
    const [holding, holders, payouts, recent, me] = await Promise.all([
      db.one('SELECT qty, paid, received FROM shares WHERE shop_id = $1 AND user_id = $2', [id, meId]),
      db.all('SELECT u.id, u.username, h.qty FROM shares h JOIN users u ON u.id = h.user_id WHERE h.shop_id = $1 AND h.qty > 0 ORDER BY h.qty DESC LIMIT 30', [id]),
      db.all('SELECT day, amount, per_share FROM shop_payouts WHERE shop_id = $1 ORDER BY day DESC LIMIT 14', [id]),
      db.all('SELECT g.kind, g.qty, g.amount, g.at, u.username FROM shop_log g LEFT JOIN users u ON u.id = g.user_id WHERE g.shop_id = $1 ORDER BY g.id DESC LIMIT 12', [id]),
      db.one('SELECT bits FROM users WHERE id = $1', [meId]),
    ]);
    const offers = await offersFor(meId, id);
    return { shop: shopView(s), owner: s.owner_id === meId, offers, holding: holding ? { qty: holding.qty, paid: Number(holding.paid), received: Number(holding.received) } : { qty: 0, paid: 0, received: 0 },
      holders, payouts, recent, bits: me.bits,
      bids: [], asks: [], trades: [], history: [], myOrders: [] }; // vides : compatibilité avec l'ancienne page encore ouverte
  }

  async function portfolio(userId) {
    const rows = await db.all(`SELECT h.qty, h.paid, h.received, s.id, s.name, s.emoji, s.share_price, s.div_mode, s.div_pct, s.balance, s.total_shares, s.buyback_pct
      FROM shares h JOIN shops s ON s.id = h.shop_id WHERE h.user_id = $1 AND h.qty > 0 ORDER BY h.paid DESC`, [userId]);
    const items = rows.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, qty: r.qty, paid: Number(r.paid), received: Number(r.received),
      perDay: +(divPerShare(r) * r.qty).toFixed(2), buyback: r.buyback_pct > 0 ? Math.floor((r.qty * r.share_price * r.buyback_pct) / 100) : null }));
    // orders : vide, gardé pour les onglets encore ouverts sur l'ancienne page Bourse.
    return { items, orders: [], offers: await offersFor(userId), paid: items.reduce((a, x) => a + x.paid, 0), received: items.reduce((a, x) => a + x.received, 0), perDay: +items.reduce((a, x) => a + x.perDay, 0).toFixed(2) };
  }

  // ---------- Offres d'achat de parts entre joueurs ----------
  // L'acheteur propose un prix par part à un détenteur ; ses bits sont bloqués jusqu'à la réponse (48 h au plus).
  // Si le détenteur accepte, les parts changent de main ; la boutique peut prélever une taxe sur le prix de vente.
  async function offersFor(userId, shopId = null) {
    const rows = await db.all(`SELECT o.*, s.name shop_name, s.transfer_fee, ub.username buyer, us.username seller,
        (SELECT qty FROM shares h WHERE h.shop_id = o.shop_id AND h.user_id = o.seller_id) seller_qty
      FROM share_offers o JOIN shops s ON s.id = o.shop_id JOIN users ub ON ub.id = o.buyer_id JOIN users us ON us.id = o.seller_id
      WHERE o.status = 'pending' AND (o.buyer_id = $1 OR o.seller_id = $1) ${shopId ? 'AND o.shop_id = $2' : ''} ORDER BY o.id DESC LIMIT 50`,
    shopId ? [userId, shopId] : [userId]);
    const view = (o) => ({ id: o.id, shopId: o.shop_id, shopName: o.shop_name, buyer: o.buyer, seller: o.seller, qty: o.qty, price: o.price,
      total: o.qty * o.price, tax: Math.floor((o.qty * o.price * o.transfer_fee) / 100), sellerQty: o.seller_qty || 0, createdAt: o.created_at,
      expiresAt: Number(o.created_at) + OFFER_MS });
    return { received: rows.filter((o) => o.seller_id === userId).map(view), sent: rows.filter((o) => o.buyer_id === userId).map(view) };
  }

  async function makeOffer(me, shopId, body) {
    const qty = intIn(body.qty, 1, TOTAL_SHARES, 'Nombre de parts invalide.');
    const price = intIn(body.price, 1, 1_000_000, 'Prix par part invalide.');
    return db.tx(async (q) => {
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [Number(shopId)]);
      if (!s) throw new GameError('Boutique introuvable.', 404);
      if (s.owner_id === me.id) throw new GameError('Tu ne peux pas acheter des parts de ta propre boutique.');
      const seller = await q.one('SELECT u.id, u.username, h.qty FROM shares h JOIN users u ON u.id = h.user_id WHERE h.shop_id = $1 AND h.user_id = $2',
        [s.id, Number(body.sellerId)]);
      if (!seller || seller.id === me.id) throw new GameError('Ce joueur n\'a pas de parts de cette boutique.');
      if (qty > seller.qty) throw new GameError(`${seller.username} n'a que ${seller.qty} part${seller.qty > 1 ? 's' : ''}.`);
      const mine = Number((await q.one('SELECT qty FROM shares WHERE shop_id = $1 AND user_id = $2', [s.id, me.id]))?.qty || 0);
      if (mine + qty > s.max_per_player) throw new GameError(`${s.name} limite à ${s.max_per_player} parts par joueur (tu en as ${mine}).`);
      const open = (await q.one("SELECT COUNT(*) n FROM share_offers WHERE buyer_id = $1 AND status = 'pending'", [me.id])).n;
      if (open >= MAX_OFFERS) throw new GameError(`Maximum ${MAX_OFFERS} offres en attente.`);
      if (await q.one("SELECT 1 FROM share_offers WHERE buyer_id = $1 AND seller_id = $2 AND shop_id = $3 AND status = 'pending'", [me.id, seller.id, s.id])) {
        throw new GameError('Tu as déjà une offre en attente pour ce joueur : annule-la pour en faire une autre.');
      }
      const total = qty * price;
      await game.debit(q, me.id, total, `Il te faut ${total} bits pour cette offre (ils sont bloqués jusqu'à la réponse).`);
      const o = await q.one('INSERT INTO share_offers (shop_id, buyer_id, seller_id, qty, price, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [s.id, me.id, seller.id, qty, price, Date.now()]);
      await game.notify(q, seller.id, `${me.username} te propose ${total} bits pour ${qty} part${qty > 1 ? 's' : ''} de ${s.name} (${price} par part).`, `#/bourse/${s.id}`);
      await game.wakeBot(q, seller.id); // un compte animé répond à sa prochaine session
      return { id: o.id, total };
    });
  }

  async function respondOffer(me, offerId, accept) {
    return db.tx(async (q) => {
      const o = await q.one("SELECT * FROM share_offers WHERE id = $1 AND status = 'pending' FOR UPDATE", [Number(offerId)]);
      if (!o || o.seller_id !== me.id) throw new GameError('Offre introuvable.', 404);
      const s = await q.one('SELECT * FROM shops WHERE id = $1 FOR UPDATE', [o.shop_id]);
      const total = o.qty * o.price;
      const close = (status) => q.run('UPDATE share_offers SET status = $1, resolved_at = $2 WHERE id = $3', [status, Date.now(), o.id]);
      if (!accept) {
        await close('refused');
        await game.credit(q, o.buyer_id, total);
        await game.notify(q, o.buyer_id, `${me.username} a refusé ton offre sur ${s.name} : ${total} bits rendus.`, `#/bourse/${s.id}`);
        return { status: 'refused' };
      }
      const h = await q.one('SELECT * FROM shares WHERE shop_id = $1 AND user_id = $2 FOR UPDATE', [s.id, me.id]);
      if (!h || h.qty < o.qty) throw new GameError(`Tu n'as plus que ${h?.qty || 0} part${h?.qty > 1 ? 's' : ''} : impossible d'accepter.`);
      const buyerQty = Number((await q.one('SELECT qty FROM shares WHERE shop_id = $1 AND user_id = $2', [s.id, o.buyer_id]))?.qty || 0);
      if (buyerQty + o.qty > s.max_per_player) throw new GameError(`L'acheteur dépasserait la limite de ${s.max_per_player} parts par joueur.`);
      const tax = Math.floor((total * s.transfer_fee) / 100);
      await game.credit(q, me.id, total - tax);
      if (tax) await q.run('UPDATE shops SET balance = balance + $1, fees_total = fees_total + $1 WHERE id = $2', [tax, s.id]);
      const paidPart = Math.round((Number(h.paid) * o.qty) / h.qty);
      await q.run('UPDATE shares SET qty = qty - $3, paid = GREATEST(0, paid - $4) WHERE shop_id = $1 AND user_id = $2', [s.id, me.id, o.qty, paidPart]);
      await q.run(`INSERT INTO shares (shop_id, user_id, qty, paid) VALUES ($1, $2, $3, $4)
        ON CONFLICT (shop_id, user_id) DO UPDATE SET qty = shares.qty + EXCLUDED.qty, paid = shares.paid + EXCLUDED.paid`, [s.id, o.buyer_id, o.qty, total]);
      await close('accepted');
      await log(q, s.id, o.buyer_id, 'cession', o.qty, total);
      await game.notify(q, o.buyer_id, `${me.username} a accepté ton offre : tu as ${o.qty} part${o.qty > 1 ? 's' : ''} de plus dans ${s.name}.`, `#/bourse/${s.id}`);
      return { status: 'accepted', received: total - tax, tax };
    });
  }

  async function cancelOffer(me, offerId) {
    return db.tx(async (q) => {
      const o = await q.one("SELECT * FROM share_offers WHERE id = $1 AND status = 'pending' FOR UPDATE", [Number(offerId)]);
      if (!o || o.buyer_id !== me.id) throw new GameError('Offre introuvable.', 404);
      await q.run("UPDATE share_offers SET status = 'cancelled', resolved_at = $1 WHERE id = $2", [Date.now(), o.id]);
      await game.credit(q, me.id, o.qty * o.price);
      return { ok: true };
    });
  }

  // ---------- Tâches périodiques (appelées par la tâche planifiée) ----------
  async function dailyJobs() {
    const now = Date.now(), today = dayId(now);
    const out = { dividends: 0, collected: 0, expired: 0 };
    // Dividendes : une fois par jour et par boutique, selon le nombre de parts de chacun.
    // Les fractions de bit sont gardées de côté et versées dès qu'elles font un bit entier.
    const due = await db.all('SELECT id FROM shops WHERE div_day < $1 ORDER BY id LIMIT 50', [today]);
    for (const { id } of due) {
      await db.tx(async (q) => {
        const s = await q.one('SELECT * FROM shops WHERE id = $1 AND div_day < $2 FOR UPDATE', [id, today]);
        if (!s) return;
        await q.run('UPDATE shops SET div_day = $1 WHERE id = $2', [today, s.id]);
        const per = divPerShare(s);
        if (!(per > 0)) return;
        const holders = await q.all('SELECT user_id, qty, carry FROM shares WHERE shop_id = $1 AND qty > 0', [s.id]);
        const want = holders.reduce((a, h) => a + per * h.qty, 0);
        const scale = want > Number(s.balance) ? Number(s.balance) / want : 1; // jamais plus que le coffre
        let paid = 0;
        for (const h of holders) {
          const exact = per * h.qty * scale + h.carry;
          const amount = Math.floor(exact);
          await q.run('UPDATE shares SET carry = $3, received = received + $4 WHERE shop_id = $1 AND user_id = $2', [s.id, h.user_id, exact - amount, amount]);
          if (amount < 1) continue;
          await game.credit(q, h.user_id, amount);
          await game.notify(q, h.user_id, `Dividende de ${s.name} : +${amount} bits (${h.qty} part${h.qty > 1 ? 's' : ''}).`, `#/bourse/${s.id}`);
          paid += amount;
        }
        await q.run('UPDATE shops SET balance = balance - $1 WHERE id = $2', [paid, s.id]);
        await q.run('INSERT INTO shop_payouts (shop_id, day, amount, per_share) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [s.id, today, paid, per * scale]);
        out.dividends++;
      });
    }
    // Échéances de prêts : prélèvement automatique ; s'il manque des bits, le prêt passe en défaut, la pénalité de retard
    // s'ajoute au reste chaque jour (au plus le triple du montant prêté) et on réessaie le lendemain.
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
          const penalty = l.late_pct > 0 ? Math.min(Math.ceil(((l.due_amount - paid) * l.late_pct) / 100), Math.max(0, l.amount * 3 - l.due_amount)) : 0;
          await q.run("UPDATE shop_loans SET status = 'defaulted', due_at = $1, due_amount = due_amount + $2 WHERE id = $3", [now + DAY, penalty, l.id]);
          await game.notify(q, u.id, `Prêt de ${s.name} : il manque ${l.due_amount - paid} bits${penalty ? ` (+${penalty} de pénalité de retard)` : ''}. Nouveau prélèvement demain.`, '#/loans');
          if (l.status !== 'defaulted') await game.notify(q, s.owner_id, `${u.username} n'a pas pu rembourser son prêt (${l.due_amount - paid} bits manquants).`, `#/shop/${s.id}`);
        }
        out.collected++;
      });
    }
    out.expired = await db.run("UPDATE shop_loans SET status = 'expired' WHERE status = 'pending' AND created_at < $1", [now - LOAN_PENDING_MS]);
    // Offres de parts sans réponse après 48 h : annulées, bits rendus à l'acheteur.
    out.offers = await db.tx(async (q) => {
      const old = await q.all("UPDATE share_offers SET status = 'expired', resolved_at = $1 WHERE status = 'pending' AND created_at < $2 RETURNING buyer_id, qty, price",
        [now, now - OFFER_MS]);
      for (const o of old) {
        await game.credit(q, o.buyer_id, o.qty * o.price);
        await game.notify(q, o.buyer_id, `Ton offre de parts n'a pas eu de réponse en 48 h : ${o.qty * o.price} bits rendus.`, '#/bourse');
      }
      return old.length;
    });
    return out;
  }

  return {
    sealPack, myPacks, openSealed, listShops, createShop, upgradeShop, updateShop, deposit, withdraw, deleteShop, shopDetail, listPack, cancelListing, buyListing,
    requestLoan, respondLoan, repayLoan, myLoans, buyShares, sellShares, stock, portfolio, makeOffer, respondOffer, cancelOffer, offersFor, dailyJobs, odds,
  };
}
