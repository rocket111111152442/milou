// Ce que les comptes animés font des fonctions récentes, avec les mêmes règles et les mêmes prix que les joueurs :
// coffre/roue/ticket du jour, mini-jeux, forge, boosters scellés vendus et achetés en boutique,
// bourse des boutiques (lib/bot-bourse.js), prêts, et quelques boutiques tenues par les plus riches.
// Tout passe par les fonctions du jeu (lib/fun.js, lib/shops.js) : aucun raccourci, aucun bit créé à part.
import { randomInt } from 'node:crypto';
import { RARITIES } from './sites.js';
import { CONFIG } from './game.js';
import { TIERS, QUALITIES, WITHDRAW_PCT, loanDue } from './shops.js';
import { dayId } from './fun.js';
import { createBotBourse, yieldOf } from './bot-bourse.js';

const rnd = () => randomInt(1_000_000) / 1_000_000;
const pick = (arr) => arr[randomInt(arr.length)];
const between = (a, b) => a + rnd() * (b - a);
const HOUR = 3600e3;
const MAX_ANIM_SHOPS = 20;     // boutiques tenues par des comptes animés, au total (pour laisser la place aux joueurs)
const SAVE_FROM = 5000;        // au-delà, celui qui veut une boutique met ses bits de côté
const hash32 = (x) => { let h = 2166136261; for (const c of String(x)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
// Certains comptes rêvent d'avoir leur boutique (plus souvent les marchands), les autres non : c'est stable pour un même compte.
const WANTS_SHOP = { trader: 0.6, collector: 0.4, grinder: 0.25, regular: 0.15, casual: 0.05 };
export const wantsShop = (bot, p) => p.wantsShop ?? (hash32('boutique' + bot.id) % 1000) / 1000 < (WANTS_SHOP[p.type] ?? 0.1);

// Valeur de recyclage moyenne d'un booster pour un multiplicateur de chances donné.
export function packWorth(game, boost) {
  const o = game.packOdds(boost);
  let v = CONFIG.packSize * RARITIES[0].value;
  for (let r = 2; r <= 5; r++) v += o[r] * RARITIES[r].value;
  return v;
}

const SHOP_A = ['Le Comptoir', 'La Halle', 'Le Bazar', 'L\'Échoppe', 'Le Repaire', 'La Boutique', 'Le Marché', 'La Cave', 'L\'Atelier', 'Le Kiosque'];
const SHOP_B = ['des Boosters', 'du Pixel', 'des Raretés', 'Holo', 'du Web', 'des Sites', 'Prestige', 'du Coin', 'Brillant', 'des Cartes'];
const SHOP_DESC = ['Boosters triés, prix honnêtes.', 'Que des bons boosters, venez voir.', 'Achat / vente de boosters, commission réduite.', 'Boutique de quartier, prêts possibles.', ''];

export function createBotEconomy(db, game, shops, fun) {
  const bourse = createBotBourse(db, shops);
  // Petite enveloppe : une règle du jeu qui refuse l'action n'est pas une erreur.
  const bitsOf = async (id) => (await db.one('SELECT bits FROM users WHERE id = $1', [id])).bits;

  // ---------- Activités du jour ----------
  async function daily(bot, p, tryDo) {
    const day = dayId();
    const f = bot.fun || {};
    // Pas tous les jours pour tout le monde : les occasionnels oublient souvent.
    const diligent = { casual: 0.55, regular: 0.8, grinder: 0.97, collector: 0.9, trader: 0.75 }[p.type] ?? 0.7;
    if (f.chest !== day && rnd() < diligent) await tryDo('coffre', () => fun.openChest(bot.id));
    if (f.wheel !== day && rnd() < diligent) await tryDo('roue', () => fun.spinWheel(bot.id));
    if (f.scratch !== day && rnd() < diligent * 0.8) await tryDo('ticket', () => fun.scratch(bot.id));
    if (f.cotd !== day && rnd() < diligent) await tryDo('carte du jour', () => fun.claimCotd(bot.id));
  }

  // Plus ou moins : il joue quelques manches, avec son propre niveau (il connaît plus ou moins les sites).
  async function miniGames(bot, p, tryDo) {
    const day = dayId();
    if (bot.fun?.gb?.day === day && bot.fun.gb.n >= 200) return;
    const skill = { casual: 0.55, regular: 0.62, grinder: 0.72, collector: 0.68, trader: 0.6 }[p.type] ?? 0.6;
    const rounds = randomInt(1, p.type === 'grinder' ? 6 : 4);
    if (!(await tryDo('mini-jeu', () => fun.higherLower(bot.id)))) return;
    for (let k = 0; k < rounds; k++) {
      const hl = (await db.one('SELECT fun FROM users WHERE id = $1', [bot.id])).fun?.hl;
      if (!hl?.a) break;
      const right = hl.a < hl.b ? 'a' : 'b';
      const r = await tryDo('mini-jeu', () => fun.higherLowerAnswer(bot.id, rnd() < skill ? right : (right === 'a' ? 'b' : 'a')));
      if (!r || (!r.ok && rnd() < 0.6)) break; // après une erreur il s'arrête souvent
    }
  }

  async function forgeAndHolo(bot, p, tryDo) {
    if (rnd() < (p.type === 'collector' ? 0.35 : 0.12)) {
      const info = await fun.forgeInfo(bot.id);
      const ok = info.items.filter((x) => x.rarity <= 2 && x.available >= x.cost);
      if (ok.length) await tryDo('forge', () => fun.forge(bot.id, pick(ok).rarity));
    }
    // Holo : tentative coûteuse (25 % de réussite), seulement s'il a de la marge.
    if (rnd() < 0.02) {
      const bits = await bitsOf(bot.id);
      const c = await db.one(`SELECT c.id, s.rarity FROM cards c JOIN sites s ON s.id = c.site_id
        WHERE c.user_id = $1 AND c.status = 'owned' AND c.holo = 0 AND s.rarity BETWEEN 1 AND 3 ORDER BY s.rarity DESC, random() LIMIT 1`, [bot.id]);
      if (c && bits > fun.holofyCost(c.rarity) * 6) await tryDo('holo', () => fun.holofy(bot.id, c.id));
    }
  }

  // ---------- Boosters scellés et boutiques ----------
  async function openShops() {
    return db.all('SELECT * FROM shops ORDER BY random() LIMIT 20');
  }

  // Il scelle un booster au lieu de l'ouvrir ; s'il est bon, il le met en vente dans une boutique qui l'accepte.
  async function sealAndSell(bot, me, p, tryDo, list, opts) {
    const chance = { trader: 0.35, collector: 0.08, grinder: 0.12, regular: 0.07, casual: 0.03 }[p.type] ?? 0.05;
    if (!list.length || rnd() > chance) return;
    const open = (await db.one("SELECT COUNT(*) n FROM shop_listings WHERE seller_id = $1 AND status = 'open'", [bot.id])).n;
    if (open >= Math.max(1, p.stall || 1)) return;
    const pack = await tryDo('booster scellé', () => shops.sealPack(bot.id));
    if (!pack) return;
    // Un booster terne se vend mal : souvent il l'ouvre directement.
    if (pack.quality === 'terne' && rnd() < 0.7) {
      if (!opts.dbFull) await tryDo('booster', () => shops.openSealed(bot.id, pack.id));
      return;
    }
    await listPack(bot, me, p, tryDo, pack, list);
  }

  async function listPack(bot, me, p, tryDo, pack, list, markup = 1) {
    const want = Math.max(5, Math.round(packWorth(game, pack.boost) * p.eye * p.greed * between(0.85, 1.25) * markup));
    // Boutiques ouvertes qui acceptent ce booster à ce prix, sans frais de dépôt trop lourds.
    const ok = list.filter((s) => s.is_open !== false && s.accepts.includes(pack.quality) && s.owner_id !== bot.id
      && (!s.max_price || s.max_price >= 5) && s.listing_fee <= want * 0.1);
    if (!ok.length) return;
    // Il préfère les boutiques à faible commission (et les Premium pour les bons boosters, qui s'y vendent mieux).
    const cost = (s) => s.fee_pct + (s.listing_fee / want) * 100 - (s.tier === 'premium' ? 8 : 0);
    ok.sort((a, b) => cost(a) - cost(b));
    const shop = rnd() < 0.7 ? ok[0] : pick(ok);
    const price = Math.max(shop.min_price || 1, Math.min(shop.max_price || Infinity, want));
    return tryDo('booster en vente', () => shops.listPack(me, { packId: pack.id, shopId: shop.id, price }));
  }

  // Il parcourt les boosters en vente et achète ceux qui lui paraissent bon marché.
  async function buyPacks(bot, me, p, tryDo, list, opts) {
    if (!list.length || rnd() > p.market * 0.55) return;
    const rows = await db.all(`SELECT l.id, l.price, l.seller_id, l.shop_id, p.boost, p.quality, p.shop_boosted, s.tier
      FROM shop_listings l JOIN sealed_packs p ON p.id = l.pack_id JOIN shops s ON s.id = l.shop_id
      WHERE l.status = 'open' AND l.seller_id != $1 AND s.is_open ORDER BY random() LIMIT 25`, [bot.id]);
    let bits = await bitsOf(bot.id);
    let bought = 0;
    for (const l of rows) {
      if (bought >= 2) break;
      const boost = l.shop_boosted ? l.boost : l.boost * ((TIERS[l.tier] || TIERS.standard).packBonus || 1);
      const want = packWorth(game, boost) * p.eye * between(0.9, 1.3) * (p.type === 'collector' && boost >= 3 ? 1.3 : 1);
      if (l.price > want || l.price > bits * 0.5) continue;
      if (!(await tryDo('booster acheté', () => shops.buyListing(me, l.id)))) continue;
      bought++;
      bits -= l.price;
      // Un marchand revend parfois plus cher ; les autres l'ouvrent (ou le gardent si la base est pleine).
      const packId = (await db.one("SELECT pack_id FROM shop_listings WHERE id = $1", [l.id])).pack_id;
      if (p.type === 'trader' && rnd() < 0.5) {
        const pack = await db.one('SELECT id, boost, quality FROM sealed_packs WHERE id = $1', [packId]);
        await listPack(bot, me, p, tryDo, pack, list, between(1.1, 1.4));
      } else if (!opts.dbFull) {
        await tryDo('booster', () => shops.openSealed(bot.id, packId));
      }
    }
  }

  // Ses boosters scellés restés sans acheteur : il baisse le prix, ou il finit par les ouvrir.
  async function manageListings(bot, me, p, tryDo, list, opts) {
    const stale = await db.all(`SELECT l.id, l.price, p.id pack_id, p.boost, p.quality FROM shop_listings l JOIN sealed_packs p ON p.id = l.pack_id
      WHERE l.seller_id = $1 AND l.status = 'open' AND l.created_at < $2 LIMIT 3`, [bot.id, Math.round(Date.now() - between(6, 30) * HOUR)]);
    for (const l of stale) {
      if (!(await tryDo('annonce retirée', () => shops.cancelListing(me, l.id)))) continue;
      if (rnd() < 0.6) await listPack(bot, me, p, tryDo, { id: l.pack_id, boost: l.boost, quality: l.quality }, list, between(0.7, 0.9));
      else if (!opts.dbFull) await tryDo('booster', () => shops.openSealed(bot.id, l.pack_id));
    }
    // Boosters scellés qui dorment chez lui (achetés pour être gardés) : il en ouvre un de temps en temps.
    if (!opts.dbFull && rnd() < 0.3) {
      const own = await db.one("SELECT id FROM sealed_packs WHERE owner_id = $1 AND status = 'owned' ORDER BY boost DESC LIMIT 1", [bot.id]);
      if (own) await tryDo('booster', () => shops.openSealed(bot.id, own.id));
    }
  }

  // ---------- Prêts ----------
  async function loans(bot, me, p, tryDo, list) {
    const mine = await db.all("SELECT * FROM shop_loans WHERE borrower_id = $1 AND status IN ('pending', 'active', 'defaulted')", [bot.id]);
    let bits = await bitsOf(bot.id);
    // Il rembourse dès qu'il a de la marge (avant l'échéance la plupart du temps).
    for (const l of mine.filter((x) => x.status !== 'pending')) {
      const left = l.due_amount - l.paid;
      if (bits > left * 1.3 && (l.status === 'defaulted' || rnd() < 0.5)) {
        if (await tryDo('prêt remboursé', () => shops.repayLoan(me, l.id))) bits -= left;
      }
    }
    // Emprunt, pour une raison qu'un joueur aurait aussi :
    //  - il est à court de bits ;
    //  - un marchand voit une boutique dont les parts rapportent plus par jour que ce que coûte le prêt (effet de levier) ;
    //  - de temps en temps, un achat qu'il veut faire tout de suite.
    if (!list.length || mine.length >= 2 || mine.some((l) => l.status === 'defaulted')) return;
    const broke = bits < 300 && rnd() < 0.25;
    const lever = ['trader', 'collector'].includes(p.type) && rnd() < 0.12;
    const whim = rnd() < 0.03;
    if (!broke && !lever && !whim) return;
    // Comme un joueur, il ne voit pas le coffre des autres boutiques : il demande, le propriétaire décide.
    const taken = new Set(mine.map((l) => l.shop_id));
    const cands = list.filter((s) => s.is_open !== false && s.owner_id !== bot.id && !taken.has(s.id) && s.loan_max >= Math.max(20, s.loan_min));
    if (!cands.length) return;
    // Il compare le coût total des boutiques pour la durée qu'il vise, et préfère celles qui accordent tout de suite.
    const want = broke ? between(100, 600) : lever ? between(300, 2000) : between(100, 1000);
    const offerFor = (s) => {
      const days = Math.max(s.loan_min_days, Math.min(s.loan_max_days, pick([2, 3, 5, 7, 7, 10, 14])));
      const amount = Math.max(s.loan_min, Math.min(s.loan_max, Math.round(want / 10) * 10));
      const cost = (loanDue(s, amount, days) - amount) / amount; // part d'intérêts et de frais
      return { s, days, amount, cost, score: cost - (s.loan_auto >= amount ? 0.03 : 0) + rnd() * 0.04 };
    };
    const best = cands.map(offerFor).sort((x, y) => x.score - y.score)[0];
    // Trop cher : il renonce (un joueur à court accepte de payer plus).
    if (best.cost > (broke ? 0.6 : 0.3)) return;
    // Effet de levier : seulement si une part rapporte plus par jour que le prêt ne coûte par jour.
    if (lever && !broke && !whim) {
      const y = Math.max(0, ...list.filter((s) => s.owner_id !== bot.id).map(yieldOf));
      if (y <= best.cost / best.days) return;
    }
    // Pas plus de 3 demandes de comptes animés par boutique et par jour (le propriétaire doit pouvoir suivre).
    const recent = (await db.one(`SELECT COUNT(*) n FROM shop_loans l JOIN users u ON u.id = l.borrower_id WHERE l.shop_id = $1 AND u.is_bot AND l.created_at > $2`,
      [best.s.id, Date.now() - 24 * HOUR])).n;
    if (recent >= 3) return;
    await tryDo(broke ? 'demande de prêt (à court)' : lever ? 'demande de prêt (pour investir)' : 'demande de prêt', () => shops.requestLoan(me, best.s.id, { amount: best.amount, days: best.days }));
  }

  // ---------- Boutiques tenues par des comptes animés ----------
  async function ownShop(bot, me, p, tryDo) {
    let s = await db.one('SELECT * FROM shops WHERE owner_id = $1 LIMIT 1', [bot.id]);
    if (!s) {
      // Il ouvre sa boutique dès qu'il en a les moyens, en gardant 10 % de réserve.
      if (!wantsShop(bot, p) || rnd() > 0.5) return;
      const bits = await bitsOf(bot.id);
      const tier = bits >= TIERS.premium.price * 1.1 && (p.type === 'trader' || rnd() < 0.4) ? 'premium' : bits >= TIERS.standard.price * 1.1 ? 'standard' : null;
      if (!tier) return;
      if ((await db.one('SELECT COUNT(*) n FROM shops s JOIN users u ON u.id = s.owner_id WHERE u.is_bot')).n >= MAX_ANIM_SHOPS) return;
      // Un nom libre (le nom d'une boutique est unique).
      let name = null;
      for (let k = 0; k < 5 && !name; k++) {
        const n = rnd() < 0.3 ? `Chez ${bot.username}`.slice(0, 30) : `${pick(SHOP_A)} ${pick(SHOP_B)}`;
        if (!(await db.one('SELECT 1 FROM shops WHERE lower(name) = lower($1)', [n]))) name = n;
      }
      if (!name) return;
      const accepts = rnd() < 0.5 ? Object.keys(QUALITIES) : Object.keys(QUALITIES).filter((q) => q !== 'terne');
      const r = await tryDo('boutique ouverte', () => shops.createShop(me, {
        name, tier, description: pick(SHOP_DESC), accepts,
        feePct: Math.round(between(3, tier === 'premium' ? 22 : 15)), listingFee: pick([0, 0, 0, 2, 5]),
        sharePrice: pick([5, 10, 10, 15, 20, 25, 50]), sharesMax: pick([300, 500, 1000]), maxPerPlayer: pick([50, 100, 200, 1000]),
        buybackPct: pick([0, 50, 70, 80, 90]), ...(rnd() < 0.5 ? { divMode: 'coffre', divPct: Math.round(between(1, 6)) } : { divMode: 'fixe', divPct: +between(0.5, 2.5).toFixed(1) }),
        loanRate: Math.round(between(3, 15)), loanDaily: +between(0, 2).toFixed(1), loanFee: pick([0, 0, 5, 10]), loanLate: pick([0, 1, 2, 5]),
        loanMax: pick([200, 300, 500, 800, 1000]), loanMaxDays: pick([7, 10, 14, 21]),
      }));
      if (!r) return;
      s = await db.one('SELECT * FROM shops WHERE id = $1', [r.id]);
    }
    // Demandes de prêt : il regarde l'historique de l'emprunteur et ce que contient le coffre.
    const pending = await db.all(`SELECT l.*, (SELECT COUNT(*) FROM shop_loans x WHERE x.borrower_id = l.borrower_id AND x.status = 'defaulted') bad,
        (SELECT COUNT(*) FROM shop_loans x WHERE x.borrower_id = l.borrower_id AND x.status = 'repaid') good
      FROM shop_loans l WHERE l.shop_id = $1 AND l.status = 'pending' ORDER BY l.id LIMIT 5`, [s.id]);
    for (const l of pending) {
      const ok = l.bad === 0 && l.amount <= s.balance * 0.6 && rnd() < (l.good > 0 ? 0.9 : 0.65);
      if (await tryDo(ok ? 'prêt accordé' : 'prêt refusé', () => shops.respondLoan(me, l.id, ok)) && ok) s.balance -= l.amount;
    }
    // Il se verse parfois une petite partie du coffre (le retrait est visible par tous sur la page de la boutique).
    if (rnd() < 0.04 && Number(s.balance) > 500) {
      const room = Math.floor(Number(s.balance) * WITHDRAW_PCT / 100);
      await tryDo('retrait du coffre', () => shops.withdraw(me, s.id, Math.max(1, Math.round(room * between(0.1, 0.5)))));
    }
    // De temps en temps il ajuste sa commission selon ses ventes, et il remet un peu de bits au coffre.
    if (rnd() < 0.1) {
      const max = (TIERS[s.tier] || TIERS.standard).maxFee;
      const fee = Math.max(0, Math.min(max, s.fee_pct + (s.sales_count < 3 ? -2 : 1)));
      if (fee !== s.fee_pct) await tryDo('réglages boutique', () => shops.updateShop(me, s.id, { feePct: fee }));
    }
    if (rnd() < 0.1) {
      const bits = await bitsOf(bot.id);
      if (bits > 2000) await tryDo('coffre alimenté', () => shops.deposit(me, s.id, Math.round(bits * between(0.05, 0.15))));
    }
  }

  // Une session : un peu de tout, selon la personnalité.
  async function play(bot, me, p, tryDo, opts) {
    await daily(bot, p, tryDo);
    if (rnd() < ({ grinder: 0.7, regular: 0.35, casual: 0.15 }[p.type] ?? 0.3)) await miniGames(bot, p, tryDo);
    await ownShop(bot, me, p, tryDo);
    // Celui qui veut une boutique et s'en approche économise : pas d'achats de boosters, de parts ni de holo.
    const saving = wantsShop(bot, p) && (await bitsOf(bot.id)) >= SAVE_FROM && !(await db.one('SELECT 1 FROM shops WHERE owner_id = $1', [bot.id]));
    if (!saving) await forgeAndHolo(bot, p, tryDo);
    const list = await openShops();
    if (!list.length) return;
    await manageListings(bot, me, p, tryDo, list, opts);
    await sealAndSell(bot, me, p, tryDo, list, opts);
    if (!saving) await buyPacks(bot, me, p, tryDo, list, opts);
    await bourse.session(bot, me, p, tryDo, list, { noBuy: saving });
    await loans(bot, me, p, tryDo, list);
  }

  return { play, packWorth: (b) => packWorth(game, b) };
}
