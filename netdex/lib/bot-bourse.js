// Parts de boutiques pour les comptes animés. Ils raisonnent avec ce qu'affiche l'onglet Bourse :
// prix d'une part, dividende estimé par part et par jour (donc le rendement), parts restantes, rachat proposé.
//
// Profils (stables pour un même compte) :
//  - rentier  : achète dès que le rendement lui paraît correct et garde ses parts ; ne revend que si les dividendes s'arrêtent ;
//  - prudent  : exige un bon rendement ET un rachat garanti par la boutique ; achète peu ; revend si le rendement s'effondre ;
//  - chasseur : compare les boutiques et va au meilleur rendement ; change de boutique si une autre rapporte nettement plus ;
//  - impulsif : achète un peu au hasard, plutôt dans les boutiques populaires ; revend dès qu'il manque de bits.
// Tous : jamais plus d'une part raisonnable de leur fortune dans une même boutique, et revente quand ils sont à court.
import { randomInt } from 'node:crypto';
import { divPerShare } from './shops.js';

const rnd = () => randomInt(1_000_000) / 1_000_000;
const between = (a, b) => a + rnd() * (b - a);
const hash32 = (x) => { let h = 2166136261; for (const c of String(x)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const unit = (seed) => (hash32(seed) % 100000) / 100000;

export const STYLES = {
  rentier: { minYield: [0.006, 0.015], risk: 0.3, cap: 0.4, needBuyback: 0 },
  prudent: { minYield: [0.012, 0.03], risk: 0.15, cap: 0.25, needBuyback: 70 },
  chasseur: { minYield: [0.01, 0.02], risk: 0.35, cap: 0.5, needBuyback: 0 },
  impulsif: { minYield: [0, 0.004], risk: 0.2, cap: 0.6, needBuyback: 0 },
};
const MIX = {
  trader: [['chasseur', 0.6], ['prudent', 0.2], ['rentier', 0.2]],
  collector: [['rentier', 0.5], ['prudent', 0.3], ['chasseur', 0.2]],
  grinder: [['impulsif', 0.4], ['chasseur', 0.3], ['rentier', 0.3]],
  regular: [['rentier', 0.4], ['impulsif', 0.35], ['prudent', 0.25]],
  casual: [['impulsif', 0.6], ['rentier', 0.4]],
};
// Fréquence à laquelle il ouvre l'onglet Bourse pendant une session.
const LOOKS = { trader: 0.6, collector: 0.3, grinder: 0.2, regular: 0.18, casual: 0.08 };

export function investorOf(bot, p) {
  let name = p.bourse;
  if (!STYLES[name]) {
    let x = unit('style' + bot.id);
    for (const [s, w] of MIX[p.type] || MIX.regular) { name = s; if ((x -= w) < 0) break; }
  }
  const st = STYLES[name];
  const [lo, hi] = st.minYield;
  return { name, ...st, minYield: lo + unit('yield' + bot.id) * (hi - lo), risk: st.risk * (0.6 + unit('risk' + bot.id) * 0.8) };
}

// Ce qu'une boutique rapporte par part et par jour, rapporté au prix d'une part.
export const yieldOf = (s) => (s.share_price > 0 ? divPerShare(s) / s.share_price : 0);

// Décision pour une boutique : { side: 'buy' | 'sell', qty, why } ou null.
//  s : ligne shops (+ sold), held : ses parts ici, bits, wealth : bits + valeur de ses parts, best : meilleur rendement ailleurs.
export function decide(inv, s, held, bits, wealth, best = 0) {
  const y = yieldOf(s);
  const resale = s.buyback_pct > 0 ? Math.floor((s.share_price * s.buyback_pct) / 100) : 0;
  // 1. Revendre (seulement si la boutique rachète, et si le coffre peut payer).
  if (held > 0 && resale > 0 && Number(s.balance) >= resale) {
    const max = Math.min(held, Math.floor(Number(s.balance) / resale));
    if (bits < 100 && rnd() < 0.6) return { side: 'sell', qty: Math.max(1, Math.round(max * between(0.2, 0.5))), why: 'besoin de bits' };
    if (inv.name === 'rentier' && !(s.div_pct > 0) && rnd() < 0.75) return { side: 'sell', qty: max, why: 'plus de dividendes' };
    if (inv.name === 'prudent' && y < inv.minYield / 2) return { side: 'sell', qty: max, why: 'rendement en chute' };
    if (inv.name === 'chasseur' && best > y * 2 && s.buyback_pct >= 80) return { side: 'sell', qty: max, why: 'mieux ailleurs' };
  }
  // 2. Acheter.
  if (s.owner_id === inv.botId || s.is_open === false) return null;
  const left = Math.min(s.shares_max - Number(s.sold || 0), s.max_per_player - held);
  if (left < 1 || s.buyback_pct < inv.needBuyback) return null;
  const wants = inv.name === 'impulsif' ? rnd() < 0.3 || y >= 0.01 : y >= inv.minYield;
  if (!wants) return null;
  const room = Math.max(0, wealth * inv.cap - held * s.share_price);
  const budget = Math.min(bits * inv.risk, room);
  const qty = Math.min(left, Math.floor(budget / s.share_price), inv.name === 'impulsif' ? randomInt(1, 6) : 200);
  if (qty < 1) return null;
  const why = inv.name === 'impulsif' ? 'coup de cœur' : inv.name === 'prudent' ? 'rendement sûr' : inv.name === 'chasseur' ? 'meilleur rendement' : 'pour les dividendes';
  return { side: 'buy', qty, why };
}

// Combien il estime qu'une part vaut : au moins son prix, et ce qu'elle rapportera sur l'horizon qu'il a en tête.
const HORIZON = { rentier: 150, prudent: 100, chasseur: 60, impulsif: 40 };
export const partValue = (inv, s) => Math.max(s.share_price, divPerShare(s) * (HORIZON[inv.name] || 80));

// Une offre reçue : il accepte si le prix dépasse sa propre estimation (plus facilement s'il manque de bits),
// et jamais à perte sauf besoin de bits.
export function judgeOffer(inv, s, offer, avgPaid, bits) {
  const want = partValue(inv, s) * (bits < 100 ? 0.8 : between(1.0, 1.2));
  if (offer.price < want) return false;
  return !(avgPaid && offer.price < avgPaid && bits >= 100);
}

export function createBotBourse(db, shops) {
  async function answerOffers(bot, me, inv, tryDo) {
    const offers = await db.all(`SELECT o.*, s.share_price, s.div_mode, s.div_pct, s.balance, s.total_shares, h.qty held, h.paid
      FROM share_offers o JOIN shops s ON s.id = o.shop_id LEFT JOIN shares h ON h.shop_id = o.shop_id AND h.user_id = o.seller_id
      WHERE o.seller_id = $1 AND o.status = 'pending' ORDER BY o.id LIMIT 5`, [bot.id]);
    if (!offers.length) return;
    const bits = (await db.one('SELECT bits FROM users WHERE id = $1', [bot.id])).bits;
    for (const o of offers) {
      const ok = o.held >= o.qty && judgeOffer(inv, o, o, o.held ? Number(o.paid) / o.held : 0, bits);
      await tryDo(ok ? 'offre de parts acceptée' : 'offre de parts refusée', () => shops.respondOffer(me, o.id, ok));
    }
  }

  // Une boutique rentable n'a plus de parts à vendre : il fait une offre à un détenteur, un peu au-dessus du prix.
  async function makeOffer(bot, me, inv, rows, held, bits, tryDo) {
    if (inv.name === 'impulsif' || rnd() > 0.15) return;
    if (await db.one("SELECT 1 FROM share_offers WHERE buyer_id = $1 AND status = 'pending' LIMIT 1", [bot.id])) return;
    const s = rows.find((x) => x.owner_id !== bot.id && x.is_open !== false && x.shares_max - Number(x.sold) <= 0 && yieldOf(x) >= inv.minYield && (held.get(x.id) || 0) < x.max_per_player);
    if (!s) return;
    // Pas plus d'une offre de compte animé à la fois pour un même joueur.
    const seller = await db.one(`SELECT h.user_id, h.qty FROM shares h JOIN users u ON u.id = h.user_id WHERE h.shop_id = $1 AND h.qty > 0 AND h.user_id != $2
      AND NOT EXISTS (SELECT 1 FROM share_offers o JOIN users b ON b.id = o.buyer_id WHERE o.seller_id = h.user_id AND o.status = 'pending' AND b.is_bot)
      ORDER BY random() LIMIT 1`, [s.id, bot.id]);
    if (!seller) return;
    const price = Math.max(1, Math.round(Math.min(partValue(inv, s), s.share_price * between(1.05, 1.3))));
    const qty = Math.min(seller.qty, s.max_per_player - (held.get(s.id) || 0), Math.floor((bits * inv.risk) / price), randomInt(1, 30));
    if (qty < 1) return;
    await tryDo('offre de parts', () => shops.makeOffer(me, s.id, { sellerId: seller.user_id, qty, price }));
  }

  async function session(bot, me, p, tryDo, list) {
    // Les offres reçues passent avant tout : un joueur attend sa réponse.
    await answerOffers(bot, me, { ...investorOf(bot, p), botId: bot.id }, tryDo);
    const holding = await db.all('SELECT shop_id, qty FROM shares WHERE user_id = $1 AND qty > 0', [bot.id]);
    // Quelqu'un qui détient des parts regarde plus souvent son portefeuille.
    const look = (LOOKS[p.type] ?? 0.15) * (holding.length ? 1.6 : 1);
    if (!list.length || rnd() > look) return;
    const inv = { ...investorOf(bot, p), botId: bot.id };
    const rows = await db.all(`SELECT s.*, (SELECT COALESCE(SUM(qty), 0) FROM shares h WHERE h.shop_id = s.id) sold,
        (SELECT COUNT(*) FROM shares h WHERE h.shop_id = s.id AND h.qty > 0) holders FROM shops s WHERE s.id = ANY($1::int[])`, [list.map((s) => s.id)]);
    const held = new Map(holding.map((h) => [h.shop_id, h.qty]));
    let bits = (await db.one('SELECT bits FROM users WHERE id = $1', [bot.id])).bits;
    const wealth = bits + rows.reduce((a, s) => a + (held.get(s.id) || 0) * s.share_price, 0);
    const best = Math.max(0, ...rows.filter((s) => s.owner_id !== bot.id).map(yieldOf));
    // Ses lignes d'abord, puis une ou deux boutiques : la plus rentable pour le chasseur, la plus populaire pour l'impulsif.
    const others = rows.filter((s) => !held.has(s.id));
    const score = (s) => (inv.name === 'chasseur' ? yieldOf(s) : inv.name === 'impulsif' ? Number(s.holders) + 1 : yieldOf(s) + rnd() * 0.01) * between(0.8, 1.2);
    others.sort((a, b) => score(b) - score(a));
    const watch = [...rows.filter((s) => held.has(s.id)), ...others.slice(0, 1 + randomInt(2))];
    for (const s of watch) {
      const d = decide(inv, s, held.get(s.id) || 0, bits, wealth, best);
      if (!d) continue;
      const r = await tryDo(`${d.side === 'buy' ? 'achat' : 'revente'} de parts (${d.why})`, () => (d.side === 'buy' ? shops.buyShares(me, s.id, d.qty) : shops.sellShares(me, s.id, d.qty)));
      if (r) bits += d.side === 'buy' ? -r.cost : r.amount;
    }
    await makeOffer(bot, me, inv, rows, held, bits, tryDo);
  }
  return { session };
}
