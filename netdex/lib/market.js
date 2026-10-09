// Cote des cartes et valeur des collections, d'après les vraies ventes aux enchères.
//  - cote d'une rareté = médiane des ventes des 7 derniers jours (non holo), sinon 2 × la valeur de recyclage ;
//  - cote d'un site = médiane de ses propres ventes sur 30 jours s'il en a, sinon cote de sa rareté,
//    modulée selon son rang dans la rareté (le haut du palier vaut jusqu'à 1,5×) ;
//  - holo × 5.
import { RARITIES } from './sites.js';
import { CONFIG } from './game.js';

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
let cache = { at: 0, rarity: null };

export async function rarityPrices(db) {
  if (cache.rarity && Date.now() - cache.at < 5 * 60_000) return cache.rarity;
  const rows = await db.all(`SELECT rarity, percentile_cont(0.5) WITHIN GROUP (ORDER BY price) p, COUNT(*) n
    FROM sales WHERE at > $1 AND holo = 0 GROUP BY rarity`, [Date.now() - 7 * DAY]);
  const got = Object.fromEntries(rows.filter((r) => r.n >= 5).map((r) => [r.rarity, r.p]));
  const out = RARITIES.map((r) => Math.max(1, Math.round(got[r.id] ?? r.value * 2)));
  cache = { at: Date.now(), rarity: out };
  return out;
}

export async function sitePrices(db, game, siteIds) {
  const rp = await rarityPrices(db);
  const ids = [...new Set(siteIds)];
  const own = ids.length ? await db.all(`SELECT site_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY price / CASE WHEN holo = 1 THEN $3 ELSE 1 END) p
    FROM sales WHERE site_id = ANY($1::int[]) AND at > $2 GROUP BY site_id`, [ids, Date.now() - 30 * DAY, CONFIG.holoMultiplier]) : [];
  const bySite = new Map(own.map((r) => [r.site_id, r.p]));
  const out = new Map();
  for (const id of ids) {
    const t = game.tierOf(id);
    const pos = 1 - (id - t.lo) / Math.max(1, t.hi - t.lo + 1); // 1 en haut du palier, 0 en bas
    out.set(id, Math.max(1, Math.round(bySite.get(id) ?? rp[t.id] * (1 + 0.5 * pos))));
  }
  return out;
}

export async function collectionValue(db, game, userId) {
  const cards = await db.all('SELECT c.site_id, c.holo FROM cards c WHERE c.user_id = $1', [userId]);
  const prices = await sitePrices(db, game, cards.map((c) => c.site_id));
  const byRarity = RARITIES.map((r) => ({ rarity: r.id, name: r.name, count: 0, value: 0 }));
  let value = 0;
  const priced = cards.map((c) => {
    const v = prices.get(c.site_id) * (c.holo ? CONFIG.holoMultiplier : 1);
    const r = game.tierOf(c.site_id).id;
    byRarity[r].count++; byRarity[r].value += v; value += v;
    return { site_id: c.site_id, holo: c.holo, price: v };
  });
  priced.sort((a, b) => b.price - a.price);
  return { value, cards: cards.length, byRarity, top: priced.slice(0, 10) };
}

const bucket = (t) => Math.floor(t / HOUR) * HOUR;

export async function snapshot(db, game, userId) {
  const [v, u] = await Promise.all([collectionValue(db, game, userId), db.one('SELECT bits FROM users WHERE id = $1', [userId])]);
  await db.run(`INSERT INTO value_history (user_id, at, value, bits, cards) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id, at) DO UPDATE SET value = EXCLUDED.value, bits = EXCLUDED.bits, cards = EXCLUDED.cards`, [userId, bucket(Date.now()), v.value, u.bits, v.cards]);
  return v;
}

// Appelé par la tâche minute : une photo par heure pour les joueurs humains actifs ces 30 derniers jours.
export async function snapshotDue(db, game, limit = 60) {
  const b = bucket(Date.now());
  const due = await db.all(`SELECT u.id FROM users u WHERE NOT u.is_bot AND u.last_seen > $1
    AND NOT EXISTS (SELECT 1 FROM value_history h WHERE h.user_id = u.id AND h.at = $2) LIMIT $3`, [Date.now() - 30 * DAY, b, limit]);
  for (const { id } of due) await snapshot(db, game, id);
  return due.length;
}

export async function wallet(db, game, userId) {
  const v = await snapshot(db, game, userId);
  const history = await db.all('SELECT at, value, bits, cards FROM value_history WHERE user_id = $1 AND at > $2 ORDER BY at', [userId, Date.now() - 90 * DAY]);
  const change = (ms) => {
    const past = [...history].reverse().find((h) => h.at <= Date.now() - ms);
    return past ? { from: past.value, pct: past.value ? Math.round(((v.value - past.value) / past.value) * 1000) / 10 : null } : null;
  };
  const sites = await game.ensureSites(db, v.top.map((t) => t.site_id));
  return {
    ...v,
    top: v.top.map((t) => ({ ...t, site: sites.get(t.site_id) })),
    history, change24h: change(DAY), change7d: change(7 * DAY), rarityPrices: await rarityPrices(db),
  };
}

// Cours du marché : médiane quotidienne par rareté sur 30 jours.
export async function marketIndex(db) {
  const rows = await db.all(`SELECT rarity, (at / ${DAY})::bigint * ${DAY} AS day, percentile_cont(0.5) WITHIN GROUP (ORDER BY price) p, COUNT(*) n
    FROM sales WHERE at > $1 AND holo = 0 GROUP BY 1, 2 ORDER BY 2`, [Date.now() - 30 * DAY]);
  return { current: await rarityPrices(db), days: rows.map((r) => ({ rarity: r.rarity, day: Number(r.day), price: Math.round(r.p), n: r.n })) };
}
