// Contenu « vivant » : de quoi revenir chaque jour et viser quelque chose sur plusieurs semaines.
//  - Saison (14 jours) : 30 paliers à débloquer en jouant, avec des boosters sur mesure aux paliers ronds.
//  - Boss de la semaine : toute la communauté lui inflige des dégâts en ouvrant des boosters ; récompenses à sa chute,
//    bonus pour le podium des plus gros attaquants.
//  - Loterie quotidienne : tickets à 20 bits, jackpot qui grossit, tirage chaque jour (le jackpot est reporté sans ticket).
//  - Collections : chaque famille de sites a 4 paliers (5, 15, 30, 60 sites différents) avec une récompense chacun.
//  - Événements surprises : sans admin, quelques fois par jour, un événement d'une heure démarre tout seul.
import { randomInt } from 'node:crypto';
import { GameError, EVENTS, BOSS_DMG, weekId } from './game.js';

const DAY = 24 * 3600e3;
const dayId = (t = Date.now()) => Math.floor(t / DAY);

// ---------- Saison ----------
export const SEASON_DAYS = 14;
const SEASON_EPOCH = Date.UTC(2026, 0, 5); // un lundi
export const seasonId = (t = Date.now()) => Math.floor((t - SEASON_EPOCH) / (SEASON_DAYS * DAY));
const seasonEnd = (id) => SEASON_EPOCH + (id + 1) * SEASON_DAYS * DAY;
export const SEASON_TIERS = 30;
export const TIER_XP = 150;
// XP de saison gagnée par action (d'après les compteurs de statistiques du joueur).
export const SEASON_XP = { packs: 10, rare: 4, epic: 20, legendary: 120, mythic: 800, holo: 25, games: 3, quests: 40, forged: 25, recycled: 1, gifts: 10 };
// Boosters sur mesure (pourcentage par carte, de Commune [0] à Mythique [5]).
export const PRESETS = {
  genereux: { label: 'Booster généreux', odds: { 0: 40, 1: 30, 2: 20, 3: 8, 4: 1.8, 5: 0.2 } },
  epique: { label: 'Booster Épique+', odds: { 0: 0, 1: 0, 2: 0, 3: 75, 4: 22, 5: 3 } },
  legende: { label: 'Booster Légende', odds: { 0: 0, 1: 0, 2: 0, 3: 50, 4: 46, 5: 4 } },
  jackpot: { label: 'Booster Jackpot', odds: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 80, 5: 20 } },
  boss: { label: 'Butin du boss', odds: { 0: 0, 1: 10, 2: 45, 3: 35, 4: 9, 5: 1 } },
};
export function tierReward(k) {
  if (k === 30) return { bits: 2000, booster: 'jackpot' };
  if (k === 25) return { bits: 800, booster: 'legende' };
  if (k % 10 === 0) return { bits: 500, booster: 'epique' };
  if (k % 5 === 0) return { bits: 300, booster: 'genereux', count: 2 };
  if (k % 3 === 0) return { packs: 3 };
  return { bits: 60 + k * 10 };
}

// ---------- Boss ----------
const BOSSES = [
  { name: 'Le Captcha Géant', emoji: '🤖' }, { name: 'La Pop-up Infernale', emoji: '🪟' }, { name: 'Le Virus 404', emoji: '👾' },
  { name: 'La Pub Intrusive', emoji: '📢' }, { name: 'Le Spam Royal', emoji: '📧' }, { name: 'Le Cookie Tyran', emoji: '🍪' },
  { name: 'Le Lag Éternel', emoji: '🐌' }, { name: 'Le Troll des Commentaires', emoji: '🧌' },
];
const BOSS_MIN_HP = 20_000;
const BOSS_MIN_DMG = 50; // pour avoir droit au butin

// ---------- Loterie ----------
export const TICKET_PRICE = 20;
const MAX_TICKETS = 50;
const JACKPOT_SHARE = 0.8; // 80 % des tickets vont au jackpot, le reste disparaît
const JACKPOT_SEED = 500; // ajouté chaque jour par la maison
const BOT_TICKETS_MAX = 300; // tickets des comptes animés par jour, au total

// ---------- Collections ----------
export const SET_STEPS = [
  { n: 5, bits: 50 }, { n: 15, bits: 150 }, { n: 30, bits: 400, packs: 2 }, { n: 60, bits: 1000, booster: 'epique' },
];

export function createLive(db, game, shops) {
  const getMeta = async (q, key) => { const r = await q.one('SELECT value FROM meta WHERE key = $1', [key]); return r ? JSON.parse(r.value) : null; };
  const setMeta = (q, key, v) => q.run('INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, JSON.stringify(v)]);
  const setFun = (q, userId, patch) => q.run('UPDATE users SET fun = fun || $2::jsonb WHERE id = $1', [userId, JSON.stringify(patch)]);
  const lockUser = async (q, userId) => {
    const u = await q.one('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!u) throw new GameError('Joueur introuvable.', 404);
    return u;
  };
  // Distribue une récompense { bits, packs, booster, count }.
  async function give(q, userId, r, why) {
    if (r.bits || r.packs) await q.run('UPDATE users SET bits = bits + $1, pack_stock = pack_stock + $2 WHERE id = $3', [r.bits || 0, r.packs || 0, userId]);
    if (r.booster) {
      const p = PRESETS[r.booster];
      await q.run(`INSERT INTO sealed_packs (owner_id, boost, quality, created_at, odds, label)
        SELECT $1, 1, 'standard', $2, $3, $4 FROM generate_series(1, $5)`, [userId, Date.now(), JSON.stringify(p.odds), p.label, r.count || 1]);
    }
    if (why) await game.notify(q, userId, why, '#/');
  }
  const rewardText = (r) => [r.bits ? `${r.bits} bits` : '', r.packs ? `${r.packs} booster${r.packs > 1 ? 's' : ''}` : '',
    r.booster ? `${r.count > 1 ? r.count + ' × ' : ''}${PRESETS[r.booster].label}` : ''].filter(Boolean).join(' + ');

  // ---------- Saison ----------
  const xpFrom = (stats, base) => Object.entries(SEASON_XP).reduce((a, [k, w]) => a + Math.max(0, (Number(stats?.[k]) || 0) - (Number(base?.[k]) || 0)) * w, 0);
  async function seasonState(q, u) {
    const id = seasonId();
    let s = u.fun?.season;
    if (!s || s.id !== id) {
      s = { id, base: u.stats || {}, claimed: 0 };
      await setFun(q, u.id, { season: s });
    }
    const xp = xpFrom(u.stats, s.base);
    return { id, xp, tier: Math.min(SEASON_TIERS, Math.floor(xp / TIER_XP)), claimed: s.claimed, endsAt: seasonEnd(id) };
  }
  async function season(userId) {
    const u = await db.one('SELECT id, stats, fun FROM users WHERE id = $1', [userId]);
    const st = await seasonState(db, u);
    return { ...st, tierXp: TIER_XP, tiers: Array.from({ length: SEASON_TIERS }, (_, i) => ({ k: i + 1, reward: tierReward(i + 1), text: rewardText(tierReward(i + 1)) })), xpTable: SEASON_XP };
  }
  async function claimSeason(userId) {
    return db.tx(async (q) => {
      const u = await lockUser(q, userId);
      const st = await seasonState(q, u);
      if (st.tier <= st.claimed) throw new GameError('Aucun palier à récupérer pour le moment.');
      const total = { bits: 0, packs: 0, boosters: [] };
      for (let k = st.claimed + 1; k <= st.tier; k++) {
        const r = tierReward(k);
        await give(q, userId, r);
        total.bits += r.bits || 0; total.packs += r.packs || 0;
        if (r.booster) total.boosters.push(`${r.count > 1 ? r.count + ' × ' : ''}${PRESETS[r.booster].label}`);
      }
      const fresh = await q.one('SELECT fun FROM users WHERE id = $1', [userId]);
      await setFun(q, userId, { season: { ...fresh.fun.season, claimed: st.tier } });
      return { ...total, from: st.claimed + 1, to: st.tier };
    });
  }

  // ---------- Boss ----------
  async function bossState(q = db) {
    const wk = weekId();
    let b = await getMeta(q, 'boss');
    if (!b || b.week !== wk) {
      // Points de vie : 70 % des dégâts infligés la semaine précédente (la communauté doit forcer un peu).
      const prev = b ? Number((await q.one('SELECT COALESCE(SUM(dmg), 0) d FROM boss_hits WHERE week = $1', [b.week])).d) : 0;
      const pick = BOSSES[(wk * 7 + 3) % BOSSES.length];
      b = { week: wk, ...pick, hp: Math.max(BOSS_MIN_HP, Math.round((prev * 0.7) / 1000) * 1000) };
      await setMeta(q, 'boss', b);
    }
    const dealt = Number((await q.one('SELECT COALESCE(SUM(dmg), 0) d FROM boss_hits WHERE week = $1', [b.week])).d);
    return { ...b, dealt, dead: dealt >= b.hp, endsAt: (wk + 1) * 7 * DAY + 4 * DAY };
  }
  async function boss(userId) {
    const b = await bossState();
    const [top, mine, fun] = await Promise.all([
      db.all('SELECT u.username, h.dmg FROM boss_hits h JOIN users u ON u.id = h.user_id WHERE h.week = $1 ORDER BY h.dmg DESC LIMIT 10', [b.week]),
      db.one(`SELECT dmg, (SELECT COUNT(*) + 1 FROM boss_hits x WHERE x.week = h.week AND x.dmg > h.dmg) rank FROM boss_hits h WHERE week = $1 AND user_id = $2`, [b.week, userId]),
      db.one('SELECT fun FROM users WHERE id = $1', [userId]),
    ]);
    return { ...b, top: top.map((t) => ({ username: t.username, dmg: Number(t.dmg) })), mine: mine ? { dmg: Number(mine.dmg), rank: Number(mine.rank) } : { dmg: 0, rank: null },
      claimed: fun.fun?.boss === b.week, minDmg: BOSS_MIN_DMG, dmgTable: BOSS_DMG, rage: game.eventIs('rage') };
  }
  async function claimBoss(userId) {
    return db.tx(async (q) => {
      const u = await lockUser(q, userId);
      const b = await bossState(q);
      if (!b.dead) throw new GameError('Le boss est encore debout : continue d\'ouvrir des boosters !');
      if (u.fun?.boss === b.week) throw new GameError('Butin déjà récupéré cette semaine.');
      const mine = await q.one(`SELECT dmg, (SELECT COUNT(*) + 1 FROM boss_hits x WHERE x.week = h.week AND x.dmg > h.dmg) rank FROM boss_hits h WHERE week = $1 AND user_id = $2`, [b.week, userId]);
      if (!mine || Number(mine.dmg) < BOSS_MIN_DMG) throw new GameError(`Il faut avoir infligé au moins ${BOSS_MIN_DMG} dégâts pour le butin.`);
      const rank = Number(mine.rank);
      const r = rank === 1 ? { bits: 1500, booster: 'jackpot' } : rank <= 3 ? { bits: 800, booster: 'legende' } : rank <= 10 ? { bits: 400, booster: 'epique' } : { bits: 150, booster: 'boss' };
      await give(q, userId, r);
      await setFun(q, userId, { boss: b.week });
      return { ...r, rank, text: rewardText(r) };
    });
  }

  // ---------- Loterie ----------
  async function lottery(userId) {
    const day = dayId();
    const st = await lotteryState(db, day);
    const [mine, last] = await Promise.all([
      db.one('SELECT n FROM lottery_tickets WHERE day = $1 AND user_id = $2', [day, userId]),
      getMeta(db, 'lottery_last'),
    ]);
    const n = mine?.n || 0;
    return { day, jackpot: st.jackpot, tickets: st.tickets, players: st.players, mine: n, chance: st.tickets ? n / st.tickets : 0,
      price: TICKET_PRICE, max: MAX_TICKETS, drawAt: (day + 1) * DAY, last };
  }
  async function lotteryState(q, day) {
    const r = await q.one('SELECT COALESCE(SUM(n), 0)::int t, COUNT(*)::int p FROM lottery_tickets WHERE day = $1', [day]);
    const carry = Number((await getMeta(q, 'lottery_carry')) ?? 0); // jackpot reporté des tirages sans ticket
    return { tickets: r.t, players: r.p, jackpot: carry + JACKPOT_SEED + Math.floor(r.t * TICKET_PRICE * JACKPOT_SHARE) };
  }
  async function buyTickets(userId, nIn) {
    const n = Math.floor(Number(nIn));
    if (!(n >= 1 && n <= MAX_TICKETS)) throw new GameError(`Entre 1 et ${MAX_TICKETS} tickets.`);
    return db.tx(async (q) => {
      const u = await lockUser(q, userId);
      const day = dayId();
      const have = (await q.one('SELECT n FROM lottery_tickets WHERE day = $1 AND user_id = $2', [day, userId]))?.n || 0;
      if (have + n > MAX_TICKETS) throw new GameError(`Maximum ${MAX_TICKETS} tickets par jour (tu en as ${have}).`);
      if (u.is_bot) {
        const bots = (await q.one('SELECT COALESCE(SUM(t.n), 0)::int n FROM lottery_tickets t JOIN users x ON x.id = t.user_id WHERE t.day = $1 AND x.is_bot', [day])).n;
        if (bots + n > BOT_TICKETS_MAX) throw new GameError('Plus de tickets pour aujourd\'hui.');
      }
      await game.debit(q, userId, n * TICKET_PRICE, `Il faut ${n * TICKET_PRICE} bits pour ${n} ticket${n > 1 ? 's' : ''}.`);
      await q.run('INSERT INTO lottery_tickets (day, user_id, n) VALUES ($1, $2, $3) ON CONFLICT (day, user_id) DO UPDATE SET n = lottery_tickets.n + EXCLUDED.n', [day, userId, n]);
      return { mine: have + n };
    });
  }
  // Tirage des jours passés (appelé par la tâche planifiée) : un gagnant au hasard, pondéré par ses tickets.
  async function drawLottery() {
    const today = dayId();
    return db.tx(async (q) => {
      const last = Number((await getMeta(q, 'lottery_drawn')) ?? today - 1);
      if (last >= today - 1) return null;
      let result = null;
      for (let day = last + 1; day < today; day++) {
        const st = await lotteryState(q, day);
        const rows = await q.all('SELECT t.user_id, t.n, u.username FROM lottery_tickets t JOIN users u ON u.id = t.user_id WHERE t.day = $1 ORDER BY t.user_id', [day]);
        if (!rows.length) {
          await setMeta(q, 'lottery_carry', st.jackpot); // personne n'a joué : tout est reporté
          continue;
        }
        let x = randomInt(st.tickets);
        const win = rows.find((r) => (x -= r.n) < 0) || rows[0];
        await game.credit(q, win.user_id, st.jackpot);
        await game.notify(q, win.user_id, `Tu as gagné la loterie : ${st.jackpot} bits ! (${win.n} ticket${win.n > 1 ? 's' : ''} sur ${st.tickets})`, '#/loterie');
        await game.logEvent(q, 'lottery', win.user_id, { amount: st.jackpot });
        await setMeta(q, 'lottery_carry', 0);
        result = { day, winner: win.username, jackpot: st.jackpot, tickets: st.tickets, players: rows.length, odds: win.n / st.tickets };
        await setMeta(q, 'lottery_last', result);
      }
      await setMeta(q, 'lottery_drawn', today - 1);
      await q.run('DELETE FROM lottery_tickets WHERE day < $1', [today - 7]);
      return result;
    });
  }

  // ---------- Collections ----------
  // Nombre de sites par famille : compté sur ~1 million de sites, donc gardé en mémoire 10 minutes.
  let famCache = { at: 0, rows: null };
  async function familyTotals() {
    if (!famCache.rows || Date.now() - famCache.at > 600e3) {
      famCache = { at: Date.now(), rows: await db.all("SELECT family, COUNT(*)::int n FROM sites WHERE family IS NOT NULL AND family != '' GROUP BY 1 ORDER BY 1") };
    }
    return famCache.rows;
  }
  async function sets(userId) {
    const [rows, u, totals] = await Promise.all([
      db.all(`SELECT s.family, COUNT(DISTINCT s.id)::int n FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.user_id = $1 AND s.family IS NOT NULL AND s.family != '' GROUP BY 1`, [userId]),
      db.one('SELECT fun FROM users WHERE id = $1', [userId]),
      familyTotals(),
    ]);
    const have = new Map(rows.map((r) => [r.family, r.n]));
    const claimed = u.fun?.sets || {};
    return { steps: SET_STEPS.map((s) => ({ ...s, text: rewardText(s) })), items: totals.map((t) => {
      const n = have.get(t.family) || 0;
      const reached = SET_STEPS.filter((s) => n >= s.n).length;
      return { family: t.family, n, total: t.n, reached, claimed: claimed[t.family] || 0 };
    }).sort((a, b) => (b.reached - b.claimed) - (a.reached - a.claimed) || b.n - a.n) };
  }
  async function claimSet(userId, family) {
    return db.tx(async (q) => {
      const u = await lockUser(q, userId);
      const n = Number((await q.one('SELECT COUNT(DISTINCT s.id) n FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.user_id = $1 AND s.family = $2', [userId, String(family)])).n);
      const reached = SET_STEPS.filter((s) => n >= s.n).length;
      const done = u.fun?.sets?.[family] || 0;
      if (reached <= done) throw new GameError('Rien à récupérer pour cette famille.');
      const total = { bits: 0, packs: 0, boosters: [] };
      for (let k = done; k < reached; k++) {
        const r = SET_STEPS[k];
        await give(q, userId, r);
        total.bits += r.bits || 0; total.packs += r.packs || 0;
        if (r.booster) total.boosters.push(PRESETS[r.booster].label);
      }
      await q.run(`UPDATE users SET fun = jsonb_set(COALESCE(fun, '{}'::jsonb), '{sets}', COALESCE(fun->'sets', '{}'::jsonb) || jsonb_build_object($2::text, $3::int)) WHERE id = $1`, [userId, String(family), reached]);
      return total;
    });
  }

  // ---------- Événements surprises ----------
  // Environ 3 par jour : à chaque passage (toutes les minutes), une petite chance d'en lancer un s'il n'y en a pas déjà.
  async function maybeSurprise() {
    if ((await getMeta(db, 'auto_events')) === false) return null;
    if (game.activeEvent()) return null;
    if (randomInt(1_000_000) >= 2100) return null; // ≈ 3 / (24 × 60)
    const types = Object.keys(EVENTS);
    const type = types[randomInt(types.length)];
    const until = Date.now() + 3600e3;
    await setMeta(db, 'event', { type, until, surprise: true });
    await game.loadCustom();
    return { type, until };
  }

  // Tâches de la tâche planifiée.
  async function jobs() {
    const out = {};
    out.lottery = await drawLottery().catch((e) => { console.error('loterie', e.message); return null; });
    out.surprise = await maybeSurprise().catch((e) => { console.error('événement', e.message); return null; });
    await bossState().catch((e) => console.error('boss', e.message)); // change de boss en début de semaine
    await db.run('DELETE FROM boss_hits WHERE week < $1', [weekId() - 4]).catch(() => {});
    return out;
  }

  // Résumé affiché sur l'accueil.
  async function summary(userId) {
    const [b, l, s] = await Promise.all([bossState(), lotteryState(db, dayId()), season(userId)]);
    return { boss: { name: b.name, emoji: b.emoji, hp: b.hp, dealt: b.dealt, dead: b.dead },
      lottery: { jackpot: l.jackpot, drawAt: (dayId() + 1) * DAY },
      season: { id: s.id, tier: s.tier, claimed: s.claimed, xp: s.xp, tierXp: TIER_XP, endsAt: s.endsAt } };
  }

  return { season, claimSeason, boss, claimBoss, lottery, buyTickets, drawLottery, sets, claimSet, maybeSurprise, jobs, summary, bossState };
}
