// Bourse des comptes animés : chacun a un profil d'investisseur stable (tiré de son id) et se comporte comme
// un joueur réel le ferait avec les mêmes informations que celles affichées dans l'onglet Bourse :
// cours, variation, carnet d'ordres, volume, dividendes, coffre de la boutique, et son propre prix de revient.
//
// Profils :
//  - fondamental : achète sous la valeur estimée de la boutique, revend nettement au-dessus, ordres patients ;
//  - rentier     : achète les boutiques qui versent des dividendes et les garde, ne vend que si elles s'arrêtent ;
//  - tendance    : suit le mouvement (achète ce qui monte, coupe ce qui baisse), passe des ordres au marché ;
//  - creux       : achète après une forte baisse, revend au rebond ;
//  - impulsif    : achète ce qui fait parler (forte hausse, gros volume), prix ronds, vend en panique ;
//  - teneur      : se place juste devant le meilleur acheteur / vendeur pour gagner l'écart, petites quantités.
// Communs à tous : prise de bénéfices et limite de perte personnelles (avec l'effet « je garde mes perdants »
// chez les moins expérimentés), mise proportionnée à leurs bits, pas plus d'une part de leur fortune sur une boutique,
// et ordres retirés ou repositionnés quand le marché s'éloigne.
import { randomInt } from 'node:crypto';
import { TIERS, TOTAL_SHARES } from './shops.js';

const rnd = () => randomInt(1_000_000) / 1_000_000;
const between = (a, b) => a + rnd() * (b - a);
const HOUR = 3600e3, DAY = 24 * HOUR;
const MAX_BOOK_SHARE = 12; // ordres ouverts des comptes animés par boutique, pour laisser de la place aux joueurs
const hash32 = (x) => { let h = 2166136261; for (const c of String(x)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const unit = (seed) => (hash32(seed) % 100000) / 100000;

export const STYLES = {
  fondamental: { ttl: [12, 48], risk: 0.2, maxOrders: 2, tp: [0.3, 0.7], sl: [0.25, 0.4], round: false, market: 0.05 },
  rentier: { ttl: [12, 36], risk: 0.3, maxOrders: 2, tp: [1.0, 2.0], sl: [0.6, 0.8], round: true, market: 0.05 },
  tendance: { ttl: [2, 5], risk: 0.25, maxOrders: 2, tp: [0.15, 0.35], sl: [0.08, 0.15], round: false, market: 0.5 },
  creux: { ttl: [6, 16], risk: 0.2, maxOrders: 2, tp: [0.1, 0.25], sl: [0.3, 0.45], round: false, market: 0.15 },
  impulsif: { ttl: [1, 4], risk: 0.3, maxOrders: 2, tp: [0.08, 0.2], sl: [0.4, 0.6], round: true, market: 0.6 },
  teneur: { ttl: [0.5, 2], risk: 0.1, maxOrders: 3, tp: [0.05, 0.12], sl: [0.1, 0.2], round: false, market: 0 },
};
// Répartition des profils selon la personnalité de jeu.
const MIX = {
  trader: [['teneur', 0.3], ['tendance', 0.3], ['fondamental', 0.25], ['creux', 0.15]],
  collector: [['fondamental', 0.4], ['rentier', 0.4], ['creux', 0.2]],
  grinder: [['tendance', 0.4], ['impulsif', 0.3], ['creux', 0.3]],
  regular: [['rentier', 0.3], ['impulsif', 0.3], ['fondamental', 0.2], ['tendance', 0.2]],
  casual: [['impulsif', 0.6], ['rentier', 0.4]],
};
// Fréquence à laquelle il ouvre l'onglet Bourse pendant une session.
const LOOKS = { trader: 0.75, collector: 0.3, grinder: 0.25, regular: 0.2, casual: 0.08 };

// Profil et réglages personnels, stables d'une session à l'autre.
export function investorOf(bot, p) {
  let name = p.bourse;
  if (!STYLES[name]) {
    let x = unit('style' + bot.id);
    for (const [s, w] of MIX[p.type] || MIX.regular) { name = s; if ((x -= w) < 0) break; }
  }
  const st = STYLES[name];
  const at = (k, [lo, hi]) => lo + unit(k + bot.id) * (hi - lo);
  return { name, ...st, tp: at('tp', st.tp), sl: at('sl', st.sl), risk: st.risk * (0.6 + unit('risk' + bot.id) * 0.8) };
}

// Valeur estimée d'une action d'après ce qu'affiche la boutique (coffre, dividendes, commissions encaissées).
export function fundamental(s) {
  const tierPrice = (TIERS[s.tier] || TIERS.standard).price;
  const book = Number(s.balance) * (1 + Math.min(0.5, s.div_pct / 100) * 20);
  return Math.max(3, (0.4 * tierPrice + book + Number(s.fees_total) * 0.3) / TOTAL_SHARES);
}

// Prix « rond » comme le tape un joueur peu expérimenté.
const nice = (x, up) => {
  const step = x >= 200 ? 10 : x >= 40 ? 5 : 1;
  return Math.max(1, (up ? Math.ceil : Math.floor)(x / step) * step);
};

export function createBotBourse(db, shops) {
  // Ce que montre l'onglet Bourse pour une boutique.
  async function quote(s) {
    const now = Date.now();
    const r = await db.one(`SELECT
        (SELECT MAX(price) FROM stock_orders WHERE shop_id = $1 AND side = 'buy' AND status = 'open') bid,
        (SELECT MIN(price) FROM stock_orders WHERE shop_id = $1 AND side = 'sell' AND status = 'open') ask,
        (SELECT price FROM stock_trades WHERE shop_id = $1 AND at <= $2 ORDER BY at DESC LIMIT 1) p24,
        (SELECT price FROM stock_trades WHERE shop_id = $1 AND at <= $3 ORDER BY at DESC LIMIT 1) p6,
        (SELECT COALESCE(SUM(qty), 0) FROM stock_trades WHERE shop_id = $1 AND at > $2) vol,
        (SELECT per_share FROM shop_payouts WHERE shop_id = $1 AND day >= $4 ORDER BY day DESC LIMIT 1) div`,
    [s.id, now - DAY, now - 6 * HOUR, Math.floor(now / DAY) - 3]);
    const fair = fundamental(s);
    const last = s.last_price || null;
    const ref = last || fair;
    return {
      ...r, fair, last, ref, vol: Number(r.vol),
      trend24: last && r.p24 ? last / r.p24 - 1 : 0,
      trend6: last && r.p6 ? last / r.p6 - 1 : 0,
      yld: r.div && ref ? r.div / ref : 0, // rendement quotidien
    };
  }

  async function position(botId, shopId) {
    const [h, c] = await Promise.all([
      db.one('SELECT qty, locked FROM shares WHERE shop_id = $1 AND user_id = $2', [shopId, botId]),
      db.one('SELECT SUM(price * qty)::float / NULLIF(SUM(qty), 0) avg FROM stock_trades WHERE shop_id = $1 AND buyer_id = $2', [shopId, botId]),
    ]);
    return { qty: h?.qty || 0, free: h ? h.qty - h.locked : 0, locked: h?.locked || 0, avg: c?.avg || null };
  }

  // Ce qu'il décide pour une boutique : un ordre, ou rien.
  function decide(inv, q, pos, wealth, bits, s) {
    const out = (side, qty, price, type, why) => ({ side, qty: Math.max(1, Math.floor(qty)), price: price && Math.max(1, Math.round(price)), type, why });
    const sellPx = (target) => {
      const px = q.bid && q.bid >= target * 0.97 ? q.bid : target;
      return inv.round ? nice(px, true) : px;
    };
    const buyPx = (target) => {
      const px = q.ask && q.ask <= target * 1.03 ? q.ask : target;
      return inv.round ? nice(px, false) : px;
    };
    const mkt = () => rnd() < inv.market;

    // 1. Sa position : bénéfices, pertes, panique.
    if (pos.free > 0 && q.last) {
      const gain = pos.avg ? q.last / pos.avg - 1 : 0;
      if (inv.name === 'impulsif' && q.trend6 < -0.15 && rnd() < 0.7) {
        return q.bid ? out('sell', pos.free, null, 'market', 'vente panique') : out('sell', pos.free, nice(q.last * 0.85, false), 'limit', 'vente panique');
      }
      if (pos.avg && gain >= inv.tp) {
        // Un débutant vend tout dès qu'il gagne ; les autres prennent une partie.
        const part = inv.name === 'impulsif' ? 1 : between(0.3, 0.7);
        return out('sell', pos.free * part, sellPx(q.last * between(0.98, 1.03)), 'limit', 'prise de bénéfices');
      }
      // Effet « je garde mes perdants » : les moins aguerris attendent souvent que ça remonte.
      const holdsLosers = inv.name === 'impulsif' || inv.name === 'rentier' ? 0.7 : 0.2;
      if (pos.avg && gain <= -inv.sl && rnd() > holdsLosers) {
        return out('sell', pos.free * between(0.5, 1), q.bid ? null : sellPx(q.last * 0.97), q.bid ? 'market' : 'limit', 'limite de perte');
      }
      if (inv.name === 'tendance' && q.trend6 < -0.05) return out('sell', pos.free * between(0.5, 1), q.bid ? null : q.last * 0.97, q.bid ? 'market' : 'limit', 'retournement');
      if (inv.name === 'fondamental' && q.last > q.fair * between(1.25, 1.5)) return out('sell', pos.free * between(0.3, 0.6), sellPx(q.last), 'limit', 'trop cher');
      if (inv.name === 'rentier' && s.div_pct === 0 && rnd() < 0.5) return out('sell', pos.free, sellPx(q.last * 0.98), 'limit', 'plus de dividendes');
      if (inv.name === 'creux' && pos.avg && q.last >= pos.avg * 1.12) return out('sell', pos.free, sellPx(q.last), 'limit', 'rebond');
      if (inv.name === 'teneur') {
        if (q.ask && q.bid && q.ask - q.bid >= 2) return out('sell', Math.min(pos.free, between(5, 25)), q.ask - 1, 'limit', 'devant le vendeur');
        if (!q.ask && rnd() < 0.6) return out('sell', Math.min(pos.free, between(5, 25)), q.ref * between(1.03, 1.08), 'limit', 'devant le vendeur');
      }
      // Besoin de bits pour jouer : il revend une partie, au prix du moment.
      if (bits < 100 && rnd() < 0.5) {
        return q.bid ? out('sell', pos.free * between(0.2, 0.5), null, 'market', 'besoin de bits') : out('sell', pos.free * between(0.2, 0.5), sellPx(q.ref * 0.95), 'limit', 'besoin de bits');
      }
      // Un acheteur propose un bon prix : il en profite.
      if (q.bid && pos.avg && q.bid >= pos.avg * (1 + inv.tp * 0.6) && rnd() < 0.5) return out('sell', pos.free * between(0.3, 0.8), null, 'market', 'offre intéressante');
      // Ordre de vente à objectif posé à l'avance (comme on le fait en vrai), s'il n'en a pas déjà un.
      if (!pos.locked && rnd() < (inv.name === 'rentier' ? 0.1 : 0.35)) {
        return out('sell', pos.free * between(0.3, 0.7), sellPx(Math.max(pos.avg || q.ref, q.ref) * (1 + inv.tp)), 'limit', 'objectif de vente');
      }
    }

    // 2. Achat : il ne met jamais plus d'une part de sa fortune sur une même boutique (sauf l'impulsif).
    if (s.owner_id === inv.botId) return null;
    const cap = inv.name === 'impulsif' ? 0.7 : 0.35;
    const room = Math.max(0, wealth * cap - pos.qty * q.ref);
    const budget = Math.min(bits * inv.risk, room);
    const size = (px) => Math.min(150, Math.floor(budget / px));
    let want = null;
    switch (inv.name) {
      case 'fondamental': if (q.ref < q.fair * 0.9 || (!q.last && rnd() < 0.3)) want = [buyPx(Math.min(q.ref, q.fair) * between(0.8, 0.95)), 'sous sa valeur']; break;
      case 'rentier': if (s.div_pct >= 3 && (q.yld >= 0.004 || !q.div) && q.ref <= q.fair * 1.3) want = [buyPx(q.ref * between(0.92, 1.0)), 'pour les dividendes']; break;
      case 'tendance': if (q.trend6 > 0.04 && q.trend24 >= 0 && q.vol > 0) want = [buyPx((q.ask || q.ref) * 1.01), 'tendance haussière']; break;
      case 'creux': if (q.trend24 < -0.12 && q.ref > q.fair * 0.5) want = [buyPx(q.ref * between(0.95, 1.0)), 'achat sur repli']; break;
      case 'impulsif': if (q.trend24 > 0.15 || q.vol >= 50 || rnd() < 0.15) want = [buyPx((q.ask || q.ref) * between(1.0, 1.08)), q.trend24 > 0.15 ? 'ça monte !' : 'coup de cœur']; break;
      case 'teneur':
        if (q.bid && q.ask && q.ask - q.bid >= 2) want = [q.bid + 1, 'devant l\'acheteur'];
        else if (!q.bid && q.ref) want = [Math.max(1, Math.round(q.ref * 0.95)), 'devant l\'acheteur'];
        break;
    }
    if (!want) return null;
    const [px, why] = want;
    const qty = inv.name === 'teneur' ? Math.min(size(px), Math.round(between(5, 25))) : size(px);
    if (qty < 1) return null;
    // Au marché seulement s'il y a des vendeurs à un prix qu'il trouve acceptable.
    const market = mkt() && q.ask && q.ask <= px * 1.05;
    return out('buy', qty, market ? null : px, market ? 'market' : 'limit', why);
  }

  // Ses ordres en cours : retirés quand ils ont trop attendu, repositionnés quand le marché s'est éloigné.
  async function manageOrders(bot, me, inv, tryDo) {
    const now = Date.now();
    const open = await db.all("SELECT * FROM stock_orders WHERE user_id = $1 AND status = 'open' ORDER BY id", [bot.id]);
    let left = open.length;
    for (const o of open) {
      const ttl = between(inv.ttl[0], inv.ttl[1]) * HOUR;
      let stale = now - o.created_at > ttl;
      if (!stale && (inv.name === 'teneur' || inv.name === 'tendance')) {
        const best = await db.one(`SELECT ${o.side === 'buy' ? 'MAX' : 'MIN'}(price) p FROM stock_orders WHERE shop_id = $1 AND side = $2 AND status = 'open' AND user_id != $3`,
          [o.shop_id, o.side, bot.id]);
        stale = !!best?.p && (o.side === 'buy' ? best.p > o.price : best.p < o.price); // quelqu'un est passé devant
      }
      if (stale && await tryDo('ordre retiré', () => shops.cancelOrder(me, o.id))) left--;
    }
    return left;
  }

  async function session(bot, me, p, tryDo, list) {
    const holding = await db.all('SELECT shop_id FROM shares WHERE user_id = $1 AND qty > 0', [bot.id]);
    // Quelqu'un qui détient des actions regarde plus souvent son portefeuille.
    const look = (LOOKS[p.type] ?? 0.15) * (holding.length ? 1.6 : 1);
    if (!list.length || rnd() > look) return;
    const inv = { ...investorOf(bot, p), botId: bot.id };
    const openLeft = await manageOrders(bot, me, inv, tryDo);
    if (openLeft >= inv.maxOrders) return;

    // Il regarde d'abord ses lignes, puis une ou deux boutiques qui attirent l'œil (volume, dividendes ou hasard).
    const held = new Set(holding.map((h) => h.shop_id));
    const others = list.filter((s) => !held.has(s.id));
    const score = (s) => (inv.name === 'rentier' ? s.div_pct : inv.name === 'fondamental' ? rnd() * 10 : Number(s.sales_count) + 1) * between(0.5, 1.5);
    others.sort((a, b) => score(b) - score(a));
    const watch = [...list.filter((s) => held.has(s.id)).sort(() => rnd() - 0.5).slice(0, 2), ...others.slice(0, 1 + randomInt(2))];

    const bits = (await db.one('SELECT bits FROM users WHERE id = $1', [bot.id])).bits;
    const pf = await db.one('SELECT COALESCE(SUM(h.qty * COALESCE(s.last_price, 0)), 0)::float v FROM shares h JOIN shops s ON s.id = h.shop_id WHERE h.user_id = $1', [bot.id]);
    const wealth = bits + pf.v;
    let placed = openLeft;
    for (const s of watch) {
      if (placed >= inv.maxOrders) break;
      const crowd = (await db.one(`SELECT COUNT(*) n FROM stock_orders o JOIN users u ON u.id = o.user_id WHERE o.shop_id = $1 AND o.status = 'open' AND u.is_bot`, [s.id])).n;
      const [q, pos] = await Promise.all([quote(s), position(bot.id, s.id)]);
      const d = decide(inv, q, pos, wealth, bits, s);
      if (!d) continue;
      if (d.type === 'limit' && crowd >= MAX_BOOK_SHARE) continue;
      const body = d.type === 'market' ? { side: d.side, type: 'market', qty: d.qty } : { side: d.side, type: 'limit', qty: d.qty, price: d.price };
      const r = await tryDo(`${d.side === 'buy' ? 'achat' : 'vente'} d'actions (${d.why})`, () => shops.placeOrder(me, s.id, body));
      if (r && r.resting) placed++;
    }
  }

  return { session, quote, decide, investorOf };
}
