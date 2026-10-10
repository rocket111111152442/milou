// Options de jeu « fun » : progression (XP, niveaux, succès, quêtes), récompenses quotidiennes (coffre, roue,
// ticket à gratter, carte du jour), mini-jeux, forge, holo-isation, favoris, souhaits, messages, cadeaux,
// profil personnalisé, défi communautaire, codes promo et événements. Les bots n'y participent pas.
import { randomInt, createHash } from 'node:crypto';
import { CONFIG, GameError, EVENTS, weekId } from './game.js';
import { RARITIES } from './sites.js';

const DAY = 24 * 3600 * 1000;
export const dayId = (t = Date.now()) => Math.floor(t / DAY);
const hashInt = (s) => parseInt(createHash('sha256').update(String(s)).digest('hex').slice(0, 12), 16);

// ---------- Progression ----------
const S = (u) => new Proxy(u.stats || {}, { get: (o, k) => Number(o[k]) || 0 });

export const ACHIEVEMENTS = [
  { id: 'first', name: 'Premier pas', desc: 'Ouvrir un booster', test: (s) => s.packs >= 1 },
  { id: 'addict', name: 'Accro', desc: 'Ouvrir 50 boosters', test: (s) => s.packs >= 50 },
  { id: 'insomniac', name: 'Insomniaque', desc: 'Ouvrir 500 boosters', test: (s) => s.packs >= 500 },
  { id: 'epic', name: 'Épique !', desc: 'Obtenir une carte Épique', test: (s) => s.epic >= 1 },
  { id: 'legend', name: 'Légende vivante', desc: 'Obtenir une carte Légendaire', test: (s) => s.legendary >= 1 },
  { id: 'mythic', name: 'Mythomane', desc: 'Obtenir une carte Mythique', test: (s) => s.mythic >= 1 },
  { id: 'shiny', name: 'Brillant', desc: 'Obtenir une carte holo', test: (s) => s.holo >= 1 },
  { id: 'disco', name: 'Boule à facettes', desc: 'Obtenir 10 cartes holo', test: (s) => s.holo >= 10 },
  { id: 'explorer', name: 'Explorateur', desc: 'Découvrir 100 sites', test: (s, u) => u.dex_count >= 100 },
  { id: 'carto', name: 'Cartographe', desc: 'Découvrir 1 000 sites', test: (s, u) => u.dex_count >= 1000 },
  { id: 'archivist', name: 'Archiviste', desc: 'Découvrir 5 000 sites', test: (s, u) => u.dex_count >= 5000 },
  { id: 'deal', name: 'Premier deal', desc: 'Vendre une carte aux enchères', test: (s) => s.sold >= 1 },
  { id: 'trader', name: 'Trader', desc: 'Vendre 50 cartes', test: (s) => s.sold >= 50 },
  { id: 'shopper', name: 'Acheteur compulsif', desc: 'Remporter 10 enchères', test: (s) => s.bought >= 10 },
  { id: 'barter', name: 'Troc', desc: 'Réaliser un échange', test: (s) => s.traded >= 1 },
  { id: 'nego', name: 'Négociateur', desc: 'Réaliser 20 échanges', test: (s) => s.traded >= 20 },
  { id: 'smith', name: 'Forgeron', desc: 'Forger une carte', test: (s) => s.forged >= 1 },
  { id: 'mastersmith', name: 'Maître forgeron', desc: 'Forger 25 cartes', test: (s) => s.forged >= 25 },
  { id: 'generous', name: 'Généreux', desc: 'Faire 5 cadeaux', test: (s) => s.gifts >= 5 },
  { id: 'duelist', name: 'Duelliste', desc: 'Gagner 10 duels', test: (s) => s.wins >= 10 },
  { id: 'gamer', name: 'Joueur', desc: 'Jouer 50 parties de mini-jeux', test: (s) => s.games >= 50 },
  { id: 'diligent', name: 'Assidu', desc: 'Terminer 20 quêtes', test: (s) => s.quests >= 20 },
  { id: 'loyal', name: 'Fidèle', desc: 'Série de 7 jours de bonus', test: (s, u) => u.daily_streak >= 7 },
  { id: 'rich', name: 'Riche', desc: 'Avoir 10 000 bits', test: (s, u) => u.bits >= 10000 },
  { id: 'initiate', name: 'Initié', desc: 'Trouver le code secret', test: (s) => s.konami >= 1 },
];

export function xpOf(u) {
  const s = S(u);
  return s.packs * 10 + s.sold * 8 + s.bought * 5 + s.traded * 15 + s.forged * 20 + s.games * 4 + s.gifts * 10 + s.quests * 25 + (u.dex_count || 0) * 2;
}
export const levelOf = (xp) => Math.floor(Math.sqrt(xp / 40)) + 1;
export const xpFor = (level) => 40 * (level - 1) ** 2;
const levelReward = (l) => ({ bits: 25 * l, packs: l % 5 === 0 ? 3 : 1 });

export function progression(u) {
  const xp = xpOf(u);
  const level = levelOf(xp);
  const s = S(u);
  const unlocked = ACHIEVEMENTS.filter((a) => a.test(s, u)).map((a) => a.id);
  return { xp, level, cur: xpFor(level), next: xpFor(level + 1), claimedLevel: Number(u.fun?.lvl) || 1, unlocked };
}

const QUESTS = [
  { id: 'packs5', key: 'packs', n: 5, text: 'Ouvre 5 boosters' },
  { id: 'packs15', key: 'packs', n: 15, text: 'Ouvre 15 boosters' },
  { id: 'rare3', key: 'rare', n: 3, text: 'Obtiens 3 cartes Rare ou mieux' },
  { id: 'epic1', key: 'epic', n: 1, text: 'Obtiens une carte Épique ou mieux' },
  { id: 'sell1', key: 'sold', n: 1, text: 'Vends une carte aux enchères' },
  { id: 'buy1', key: 'bought', n: 1, text: 'Remporte une enchère' },
  { id: 'games3', key: 'games', n: 3, text: 'Joue 3 parties de mini-jeux' },
  { id: 'win1', key: 'wins', n: 1, text: 'Gagne un duel' },
  { id: 'forge1', key: 'forged', n: 1, text: 'Forge une carte' },
  { id: 'recycle20', key: 'recycled', n: 20, text: 'Recycle 20 cartes' },
  { id: 'msg1', key: 'messages', n: 1, text: 'Envoie un message à un ami' },
  { id: 'gift1', key: 'gifts', n: 1, text: 'Fais un cadeau à un ami' },
];
const QUEST_BITS = 60;

function questsFor(userId, day) {
  const pool = QUESTS.slice();
  const out = [];
  let h = hashInt(`${userId}:${day}`);
  while (out.length < 3) { out.push(pool.splice(h % pool.length, 1)[0]); h = Math.floor(h / 7) + 13; }
  return out;
}

// ---------- Récompenses quotidiennes ----------
export const WHEEL = [
  { label: '20 bits', bits: 20, w: 26 },
  { label: '50 bits', bits: 50, w: 20 },
  { label: '1 booster', packs: 1, w: 18 },
  { label: '100 bits', bits: 100, w: 12 },
  { label: '2 boosters', packs: 2, w: 10 },
  { label: '250 bits', bits: 250, w: 7 },
  { label: 'Carte Rare+', card: 2, w: 5 },
  { label: '1000 bits', bits: 1000, w: 2 },
];
const SCRATCH = [
  { sym: '●', bits: 15, w: 40 }, { sym: '♣', bits: 40, w: 25 }, { sym: '★', bits: 80, w: 15 },
  { sym: '♥', packs: 1, w: 10 }, { sym: '◆', bits: 200, w: 7 }, { sym: '♛', bits: 600, w: 3 },
];
const pickW = (list) => { let x = randomInt(list.reduce((a, i) => a + i.w, 0)); for (const i of list) { if ((x -= i.w) < 0) return i; } return list[0]; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const GAME_BITS_PER_DAY = 200;
const COTD_BITS = 50;
const FORGE_COST = [5, 5, 5, 10, 25]; // cartes de la rareté r pour 1 carte de la rareté r + 1
const GIFTS_PER_DAY = 5, GIFT_BITS_PER_DAY = 500;
export const PROFILE_COLORS = ['#ff5b1f', '#3d8ee6', '#57b26a', '#9b5de5', '#e5484d', '#e0a100', '#14b8a6', '#ec4899'];
const COMMUNITY_REWARD = { bits: 200, packs: 2 };

export function createFun(db, game) {
  // Lit le joueur verrouillé et remet à zéro les compteurs du jour si besoin.
  async function lockUser(q, userId) {
    const u = await q.one('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!u) throw new GameError('Joueur introuvable.', 404);
    if (u.is_bot) throw new GameError('Réservé aux joueurs humains.', 403);
    return u;
  }
  const setFun = (q, userId, patch) => q.run('UPDATE users SET fun = fun || $2::jsonb WHERE id = $1', [userId, JSON.stringify(patch)]);
  const reward = async (q, userId, { bits = 0, packs = 0 }) => {
    if (bits || packs) await q.run('UPDATE users SET bits = bits + $1, pack_stock = pack_stock + $2 WHERE id = $3', [bits, packs, userId]);
  };

  // Les quêtes du jour se mesurent par rapport aux compteurs du début de journée.
  async function ensureQuests(q, u, day = dayId()) {
    if (u.fun?.q?.day === day) return u.fun.q;
    const s = S(u);
    const list = questsFor(u.id, day);
    const qs = { day, ids: list.map((x) => x.id), base: Object.fromEntries(list.map((x) => [x.key, s[x.key]])), done: [] };
    await setFun(q, u.id, { q: qs });
    u.fun = { ...(u.fun || {}), q: qs };
    return qs;
  }
  async function touch(userId) {
    const u = await db.one('SELECT id, is_bot, stats, fun FROM users WHERE id = $1', [userId]);
    if (u && !u.is_bot && u.fun?.q?.day !== dayId()) await ensureQuests(db, u);
  }

  function questView(u) {
    const qs = u.fun?.q;
    if (!qs || qs.day !== dayId()) return [];
    const s = S(u);
    return qs.ids.map((id) => {
      const d = QUESTS.find((x) => x.id === id);
      return { id, text: d.text, n: d.n, progress: Math.min(d.n, s[d.key] - (qs.base[d.key] || 0)), claimed: qs.done.includes(id), bits: QUEST_BITS };
    });
  }

  const cotdId = (day = dayId()) => (hashInt('cotd:' + day) % 2500) + 1; // une Épique ou mieux chaque jour

  async function community() {
    const wk = weekId();
    let row = await db.one("SELECT value FROM meta WHERE key = 'community'");
    let c = row ? JSON.parse(row.value) : null;
    const total = (await db.one('SELECT COALESCE(SUM(packs_opened), 0) n FROM users')).n;
    if (!c || c.week !== wk) {
      // Objectif : 10 % de plus que ce que la communauté a fait la semaine précédente.
      const prevDone = c ? total - c.base : 0;
      const target = c ? Math.max(5000, Math.round((prevDone * 1.1) / 1000) * 1000) : 50000;
      c = { week: wk, base: total, target };
      await db.run("INSERT INTO meta (key, value) VALUES ('community', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(c)]);
    }
    return { week: wk, progress: total - c.base, target: c.target, reward: COMMUNITY_REWARD };
  }

  async function hub(userId) {
    await touch(userId);
    const u = await db.one('SELECT * FROM users WHERE id = $1', [userId]);
    const day = dayId();
    const f = u.fun || {};
    const [comm, cotd] = await Promise.all([community(), game.ensureSites(db, [cotdId(day)])]);
    const cotdSite = cotd.get(cotdId(day));
    const ownsCotd = !!(await db.one('SELECT 1 FROM cards WHERE user_id = $1 AND site_id = $2', [userId, cotdSite.id]));
    const p = progression(u);
    return {
      ...p,
      levelReward: levelReward(p.claimedLevel + 1),
      achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, desc: a.desc, done: p.unlocked.includes(a.id) })),
      quests: questView(u),
      daily: { chest: f.chest !== day, wheel: f.wheel !== day, scratch: f.scratch !== day, cotd: f.cotd !== day },
      cotd: { site: cotdSite, owned: ownsCotd, bits: COTD_BITS },
      gamesLeft: Math.max(0, GAME_BITS_PER_DAY - (f.gb?.day === day ? f.gb.n : 0)),
      community: { ...comm, claimed: f.comm === comm.week, done: comm.progress >= comm.target },
      pity: { n: u.pity, after: CONFIG.pityAfter },
      event: game.activeEvent(),
      wheel: WHEEL.map((w) => w.label),
      stats: u.stats,
      konami: !!S(u).konami,
    };
  }

  async function claimQuest(userId, id) {
    return db.tx(async (q) => {
      const u = await lockUser(q, userId);
      await ensureQuests(q, u);
      const qv = questView(u).find((x) => x.id === id);
      if (!qv) throw new GameError('Quête inconnue.', 404);
      if (qv.claimed) throw new GameError('Déjà récupérée.');
      if (qv.progress < qv.n) throw new GameError('Quête pas encore terminée.');
      const done = [...u.fun.q.done, id];
      const all = done.length === u.fun.q.ids.length;
      await setFun(q, userId, { q: { ...u.fun.q, done } });
      await reward(q, userId, { bits: QUEST_BITS, packs: all ? 1 : 0 });
      await game.bump(q, userId, { quests: 1 });
      return { bits: QUEST_BITS, packs: all ? 1 : 0 };
    });
  }

  async function claimLevel(userId) {
    return db.tx(async (q) => {
      const u = await lockUser(q, userId);
      const p = progression(u);
      if (p.claimedLevel >= p.level) throw new GameError('Aucune récompense de niveau en attente.');
      let bits = 0, packs = 0;
      for (let l = p.claimedLevel + 1; l <= p.level; l++) { const r = levelReward(l); bits += r.bits; packs += r.packs; }
      await setFun(q, userId, { lvl: p.level });
      await reward(q, userId, { bits, packs });
      return { bits, packs, level: p.level };
    });
  }

  // Une seule fois par jour : coffre / roue / ticket / carte du jour.
  async function once(userId, key, fn) {
    return db.tx(async (q) => {
      const u = await lockUser(q, userId);
      const day = dayId();
      if (u.fun?.[key] === day) throw new GameError('Déjà fait aujourd\'hui, reviens demain !');
      const r = await fn(q, u);
      await setFun(q, userId, { [key]: day });
      return r;
    });
  }

  const bitsMult = () => (game.eventIs('bits') ? 2 : 1);

  const openChest = (userId) => once(userId, 'chest', async (q) => {
    const cards = await game.grantCards(q, userId, [{ siteId: game.pickIn(game.rollTier(2)), holo: game.holoRoll(false) }]);
    return { cards };
  });

  const spinWheel = (userId) => once(userId, 'wheel', async (q) => {
    const seg = pickW(WHEEL);
    const index = WHEEL.indexOf(seg);
    let cards = [];
    if (seg.card != null) cards = await game.grantCards(q, userId, [{ siteId: game.pickIn(game.rollTier(seg.card)), holo: 0 }]);
    const bits = (seg.bits || 0) * bitsMult();
    await reward(q, userId, { bits, packs: seg.packs || 0 });
    return { index, label: seg.label, bits, packs: seg.packs || 0, cards };
  });

  const scratch = (userId) => once(userId, 'scratch', async (q) => {
    const win = randomInt(100) < 35 ? pickW(SCRATCH) : null;
    // Grille de 9 : le symbole gagnant 3 fois, les autres 2 fois au plus (aucun autre trio possible).
    const others = shuffle(SCRATCH.filter((x) => x !== win).flatMap((x) => [x.sym, x.sym]));
    const grid = shuffle([...(win ? [win.sym, win.sym, win.sym] : []), ...others.slice(0, win ? 6 : 9)]);
    if (win) await reward(q, userId, { bits: win.bits || 0, packs: win.packs || 0 });
    return { grid, win: win ? { sym: win.sym, bits: win.bits || 0, packs: win.packs || 0 } : null };
  });

  const claimCotd = (userId) => once(userId, 'cotd', async (q) => {
    if (!(await q.one('SELECT 1 FROM cards WHERE user_id = $1 AND site_id = $2', [userId, cotdId()]))) throw new GameError('Tu ne possèdes pas la carte du jour.');
    await reward(q, userId, { bits: COTD_BITS });
    return { bits: COTD_BITS };
  });

  async function claimCommunity(userId) {
    const c = await community();
    if (c.progress < c.target) throw new GameError('Objectif communautaire pas encore atteint.');
    return db.tx(async (q) => {
      const u = await lockUser(q, userId);
      if (u.fun?.comm === c.week) throw new GameError('Récompense déjà récupérée cette semaine.');
      await setFun(q, userId, { comm: c.week });
      await reward(q, userId, COMMUNITY_REWARD);
      return COMMUNITY_REWARD;
    });
  }

  async function konami(userId) {
    return db.tx(async (q) => {
      const u = await lockUser(q, userId);
      if (S(u).konami) return { already: true };
      await reward(q, userId, { packs: 3 });
      await game.bump(q, userId, { konami: 1 });
      return { packs: 3 };
    });
  }

  // ---------- Mini-jeux (gains plafonnés par jour) ----------
  async function payGame(q, u, want, extra = {}) {
    const day = dayId();
    const used = u.fun?.gb?.day === day ? u.fun.gb.n : 0;
    const bits = Math.max(0, Math.min(want, GAME_BITS_PER_DAY - used));
    await setFun(q, u.id, { gb: { day, n: used + bits }, ...extra });
    if (bits) await reward(q, u.id, { bits });
    return bits;
  }
  const randomSites = async (q, lo, hi, n) => {
    const ids = new Set();
    while (ids.size < n) ids.add(lo + randomInt(hi - lo + 1));
    const map = await game.ensureSites(q, [...ids]);
    return [...ids].map((id) => map.get(id)).filter(Boolean);
  };

  // Plus ou moins : lequel des deux sites est le plus visité ?
  async function hlRound(q, u) {
    const [a, b] = await randomSites(q, 1, 30000, 2);
    const hl = { a: a.id, b: b.id, streak: u.fun?.hl?.streak || 0, best: u.fun?.hl?.best || 0 };
    await setFun(q, u.id, { hl });
    return { a: { domain: a.domain }, b: { domain: b.domain }, streak: hl.streak, best: hl.best };
  }
  const higherLower = (userId) => db.tx(async (q) => {
    const u = await lockUser(q, userId);
    const hl = u.fun?.hl;
    if (hl?.a && hl?.b) {
      const map = await game.ensureSites(q, [hl.a, hl.b]);
      return { a: { domain: map.get(hl.a).domain }, b: { domain: map.get(hl.b).domain }, streak: hl.streak || 0, best: hl.best || 0 };
    }
    return hlRound(q, u);
  });
  const higherLowerAnswer = (userId, pick) => db.tx(async (q) => {
    const u = await lockUser(q, userId);
    const hl = u.fun?.hl;
    if (!hl?.a) throw new GameError('Aucune partie en cours.');
    const right = hl.a < hl.b ? 'a' : 'b';
    const ok = pick === right;
    const streak = ok ? (hl.streak || 0) + 1 : 0;
    const best = Math.max(hl.best || 0, streak);
    const bits = ok ? await payGame(q, u, 5) : 0;
    await game.bump(q, userId, { games: 1 });
    const result = { ok, right, ranks: { a: hl.a, b: hl.b }, bits, streak, best };
    return { ...result, next: await hlRound(q, { ...u, fun: { ...u.fun, hl: { streak, best } } }) };
  });

  // Devine le site d'après son icône (servie par notre API pour ne pas révéler la réponse).
  const guessRound = (userId) => db.tx(async (q) => {
    await lockUser(q, userId);
    const sites = await randomSites(q, 1, 3000, 4);
    const answer = sites[randomInt(sites.length)];
    await setFun(q, userId, { guess: { id: answer.id, opts: sites.map((s) => s.id), at: Date.now() } });
    return { options: sites.map((s) => s.domain), img: `/api/fun/guess/img?t=${Date.now()}` };
  });
  async function guessImage(userId) {
    const u = await db.one('SELECT fun FROM users WHERE id = $1', [userId]);
    const id = u?.fun?.guess?.id;
    if (!id) throw new GameError('Aucune partie en cours.');
    const s = (await game.ensureSites(db, [id])).get(id);
    const r = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(s.domain)}&sz=128`).catch(() => null);
    if (!r?.ok) throw new GameError('Icône indisponible.', 502);
    return { __raw: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'image/png' };
  }
  const guessAnswer = (userId, domain) => db.tx(async (q) => {
    const u = await lockUser(q, userId);
    const g = u.fun?.guess;
    if (!g?.id) throw new GameError('Aucune partie en cours.');
    const answer = (await game.ensureSites(q, [g.id])).get(g.id);
    const ok = String(domain) === answer.domain;
    await setFun(q, userId, { guess: null });
    const bits = ok ? await payGame(q, u, 10) : 0;
    await game.bump(q, userId, { games: 1 });
    return { ok, answer: answer.domain, rank: answer.id, bits };
  });

  // Duel : 3 de tes cartes contre les 3 meilleures d'un bot. Puissance + un peu de hasard, au meilleur des 3.
  const power = (s, holo) => (s.id >= 100_000_000 ? [60, 250, 500, 800, 950, 1000][s.rarity] : Math.max(1, Math.round(1000 * (1 - Math.log10(s.id) / 6)))) + (holo ? 100 : 0);
  const duel = (userId, cardIds) => db.tx(async (q) => {
    const ids = [...new Set((cardIds || []).map(Number))];
    if (ids.length !== 3) throw new GameError('Choisis exactement 3 cartes.');
    const u = await lockUser(q, userId);
    const mine = await q.all(`SELECT c.id, c.holo, s.id site_id, s.domain, s.rarity, s.family FROM cards c JOIN sites s ON s.id = c.site_id
      WHERE c.id = ANY($1::int[]) AND c.user_id = $2 AND c.status = 'owned'`, [ids, userId]);
    if (mine.length !== 3) throw new GameError('Une de ces cartes n\'est plus disponible.');
    const foe = await q.one(`SELECT id, username FROM users WHERE is_bot AND packs_opened > 20 ORDER BY random() LIMIT 1`)
      || await q.one('SELECT id, username FROM users WHERE id != $1 AND packs_opened > 0 ORDER BY random() LIMIT 1', [userId]);
    if (!foe) throw new GameError('Aucun adversaire disponible.');
    const theirs = await q.all(`SELECT c.holo, s.id site_id, s.domain, s.rarity, s.family FROM cards c JOIN sites s ON s.id = c.site_id
      WHERE c.user_id = $1 ORDER BY s.rarity DESC, random() LIMIT 3`, [foe.id]);
    while (theirs.length < 3) theirs.push(theirs[0] || { holo: 0, site_id: 999999, domain: 'example.org', rarity: 0, family: '?' });
    const order = ids.map((id) => mine.find((m) => m.id === id));
    const rounds = order.map((m, i) => {
      const t = theirs[i];
      const a = power({ id: m.site_id, rarity: m.rarity }, m.holo) + randomInt(301);
      const b = power({ id: t.site_id, rarity: t.rarity }, t.holo) + randomInt(301);
      return { mine: { id: m.site_id, domain: m.domain, rarity: m.rarity, family: m.family, holo: m.holo, score: a },
        theirs: { id: t.site_id, domain: t.domain, rarity: t.rarity, family: t.family, holo: t.holo, score: b }, win: a > b };
    });
    const won = rounds.filter((r) => r.win).length >= 2;
    const bits = won ? await payGame(q, u, 25) : 0;
    await game.bump(q, userId, { games: 1, wins: won ? 1 : 0 });
    return { foe: foe.username, rounds, won, bits };
  });

  // ---------- Forge et holo-isation ----------
  async function forgeable(q, userId, r) {
    const t = game.tiers[r];
    return q.all(`SELECT c.site_id, array_agg(c.id ORDER BY c.obtained_at) ids
      FROM cards c WHERE c.user_id = $1 AND c.status = 'owned' AND c.holo = 0
        AND (c.site_id BETWEEN $2 AND $3 OR c.site_id = ANY($4::int[]))
        AND NOT EXISTS (SELECT 1 FROM favorites f WHERE f.user_id = c.user_id AND f.site_id = c.site_id)
      GROUP BY c.site_id HAVING COUNT(*) > 1`, [userId, t.lo, t.hi, t.extra]);
  }
  async function forgeInfo(userId) {
    const out = [];
    for (let r = 0; r < FORGE_COST.length; r++) {
      const rows = await forgeable(db, userId, r);
      out.push({ rarity: r, cost: FORGE_COST[r], available: rows.reduce((a, x) => a + x.ids.length - 1, 0) });
    }
    return { items: out };
  }
  const forge = (userId, rarity) => db.tx(async (q) => {
    const r = Math.trunc(Number(rarity));
    if (!(r >= 0 && r < FORGE_COST.length)) throw new GameError('Rareté invalide.');
    await lockUser(q, userId);
    const need = FORGE_COST[r];
    const ids = (await forgeable(q, userId, r)).flatMap((x) => x.ids.slice(1)).slice(0, need);
    if (ids.length < need) throw new GameError(`Il faut ${need} doublons ${RARITIES[r].name} (non holo, hors favoris) : tu en as ${ids.length}.`);
    await q.run('DELETE FROM cards WHERE id = ANY($1::int[]) AND user_id = $2', [ids, userId]);
    const cards = await game.grantCards(q, userId, [{ siteId: game.pickIn(game.tiers[r + 1]), holo: game.holoRoll(false) }]);
    await game.bump(q, userId, { forged: 1 });
    return { used: need, cards };
  });

  const holofyCost = (rarity) => Math.max(20, RARITIES[rarity].value * 4);
  const holofy = (userId, cardId) => db.tx(async (q) => {
    await lockUser(q, userId);
    const c = await q.one(`SELECT c.id, c.holo, c.site_id FROM cards c WHERE c.id = $1 AND c.user_id = $2 AND c.status = 'owned' FOR UPDATE`, [Number(cardId), userId]);
    if (!c) throw new GameError('Carte indisponible.');
    if (c.holo) throw new GameError('Cette carte est déjà holo.');
    const cost = holofyCost(game.tierOf(c.site_id).id);
    await game.debit(q, userId, cost, `Il te faut ${cost} bits.`);
    const success = randomInt(100) < 25;
    if (success) { await q.run('UPDATE cards SET holo = 1 WHERE id = $1', [c.id]); await game.bump(q, userId, { holo: 1, holofied: 1 }); }
    return { success, cost };
  });

  // ---------- Favoris, souhaits, historique ----------
  async function toggle(table, userId, siteId, on) {
    siteId = Number(siteId) || 0;
    if (on) {
      if (table === 'wishlist') {
        const n = (await db.one('SELECT COUNT(*) n FROM wishlist WHERE user_id = $1', [userId])).n;
        if (n >= 100) throw new GameError('Liste de souhaits pleine (100 sites).');
        await game.ensureSites(db, [siteId]);
        await db.run('INSERT INTO wishlist (user_id, site_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, siteId, Date.now()]);
      } else {
        await db.run('INSERT INTO favorites (user_id, site_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, siteId]);
      }
    } else {
      await db.run(`DELETE FROM ${table} WHERE user_id = $1 AND site_id = $2`, [userId, siteId]);
    }
    if (table === 'wishlist' && on) await game.bump(db, userId, { wishes: 1 });
    return { on: !!on };
  }
  async function wishlist(userId) {
    return { items: await db.all(`SELECT s.id, s.domain, s.rarity, s.family, w.created_at,
        (SELECT MIN(COALESCE(a.current_bid, a.start_price)) FROM auctions a WHERE a.site_id = s.id AND a.status = 'open') best_price,
        (SELECT COUNT(*) FROM auctions a WHERE a.site_id = s.id AND a.status = 'open') on_sale,
        EXISTS (SELECT 1 FROM cards c WHERE c.user_id = $1 AND c.site_id = s.id) owned
      FROM wishlist w JOIN sites s ON s.id = w.site_id WHERE w.user_id = $1 ORDER BY w.created_at DESC`, [userId]) };
  }
  async function history(userId) {
    return { items: await db.all(`SELECT x.at, x.price, x.holo, x.seller_id = $1 sold, s.id site_id, s.domain, s.rarity, s.family,
        uo.username other FROM sales x JOIN sites s ON s.id = x.site_id
        LEFT JOIN users uo ON uo.id = CASE WHEN x.seller_id = $1 THEN x.buyer_id ELSE x.seller_id END
      WHERE x.seller_id = $1 OR x.buyer_id = $1 ORDER BY x.at DESC LIMIT 100`, [userId]) };
  }

  // ---------- Social ----------
  const friendsOnly = async (q, a, b) => {
    if ((await game.relation(q, a, b)) !== 'friends') throw new GameError('Réservé à tes amis.', 403);
  };
  // Amis + toute personne avec qui on a échangé des messages (ex-amis, demandes en attente...).
  async function conversations(userId) {
    return { items: await db.all(`WITH people AS (
        SELECT friend_id id FROM friends WHERE user_id = $1 AND status = 'accepted'
        UNION SELECT from_id FROM messages WHERE to_id = $1 UNION SELECT to_id FROM messages WHERE from_id = $1)
      SELECT u.id, u.username, u.last_seen, s.domain avatar_domain, m.text, m.at, m.from_id,
        EXISTS (SELECT 1 FROM friends f WHERE f.user_id = $1 AND f.friend_id = u.id AND f.status = 'accepted') friend,
        (SELECT COUNT(*) FROM messages x WHERE x.to_id = $1 AND x.from_id = u.id AND NOT x.read) unread
      FROM people p JOIN users u ON u.id = p.id LEFT JOIN sites s ON s.id = u.avatar_site
      LEFT JOIN LATERAL (SELECT text, at, from_id FROM messages WHERE (from_id = $1 AND to_id = u.id) OR (from_id = u.id AND to_id = $1) ORDER BY id DESC LIMIT 1) m ON true
      WHERE u.id != $1 ORDER BY m.at DESC NULLS LAST, u.last_seen DESC`, [userId]) };
  }
  async function thread(userId, otherId) {
    otherId = Number(otherId);
    const other = await db.one('SELECT id, username, last_seen FROM users WHERE id = $1', [otherId]);
    if (other) other.friend = (await game.relation(db, userId, otherId)) === 'friends';
    if (!other) throw new GameError('Joueur introuvable.', 404);
    await db.run('UPDATE messages SET read = true WHERE to_id = $1 AND from_id = $2 AND NOT read', [userId, otherId]);
    const items = await db.all(`SELECT id, from_id, text, at FROM messages WHERE (from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)
      ORDER BY id DESC LIMIT 60`, [userId, otherId]);
    return { other, items: items.reverse() };
  }
  const sendMessage = (me, otherId, text) => db.tx(async (q) => {
    otherId = Number(otherId);
    text = String(text || '').trim().slice(0, 500);
    if (!text) throw new GameError('Message vide.');
    await friendsOnly(q, me.id, otherId);
    const recent = (await q.one('SELECT COUNT(*) n FROM messages WHERE from_id = $1 AND at > $2', [me.id, Date.now() - 60_000])).n;
    if (recent >= 20) throw new GameError('Doucement ! Attends un peu avant d\'envoyer d\'autres messages.', 429);
    const m = await q.one('INSERT INTO messages (from_id, to_id, text, at) VALUES ($1, $2, $3, $4) RETURNING id, from_id, text, at', [me.id, otherId, text, Date.now()]);
    // Un bot qui reçoit un message passe voir dans les minutes qui suivent.
    await q.run('UPDATE users SET bot_next_at = LEAST(bot_next_at, $1) WHERE id = $2 AND is_bot', [Date.now() + (1 + randomInt(5)) * 60_000, otherId]);
    await game.bump(q, me.id, { messages: 1 });
    return m;
  });

  const gift = (me, body) => db.tx(async (q) => {
    const to = Number(body.toUserId);
    const bits = Math.max(0, Math.floor(Number(body.bits) || 0));
    const cardId = body.cardId ? Number(body.cardId) : null;
    if (!bits && !cardId) throw new GameError('Cadeau vide.');
    await friendsOnly(q, me.id, to);
    const u = await lockUser(q, me.id);
    const day = dayId();
    const g = u.fun?.gift?.day === day ? u.fun.gift : { day, n: 0, bits: 0 };
    if (g.n >= GIFTS_PER_DAY) throw new GameError(`Maximum ${GIFTS_PER_DAY} cadeaux par jour.`);
    if (g.bits + bits > GIFT_BITS_PER_DAY) throw new GameError(`Maximum ${GIFT_BITS_PER_DAY} bits offerts par jour (reste ${GIFT_BITS_PER_DAY - g.bits}).`);
    let site = null;
    if (cardId) {
      const c = await q.one(`UPDATE cards SET user_id = $1, obtained_at = $2 WHERE id = $3 AND user_id = $4 AND status = 'owned' RETURNING site_id, holo`, [to, Date.now(), cardId, me.id]);
      if (!c) throw new GameError('Carte indisponible.');
      site = (await game.ensureSites(q, [c.site_id])).get(c.site_id);
      await game.discover(q, to, c.site_id);
    }
    if (bits) { await game.debit(q, me.id, bits); await game.credit(q, to, bits); }
    await setFun(q, me.id, { gift: { day, n: g.n + 1, bits: g.bits + bits } });
    await game.bump(q, me.id, { gifts: 1 });
    const parts = [site && site.domain, bits && `${bits} bits`].filter(Boolean).join(' + ');
    await game.notify(q, to, `${me.username} t'offre un cadeau : ${parts} !`, cardId ? '#/collection' : '#/');
    return { ok: true };
  });

  async function saveProfile(userId, body) {
    const u = await db.one('SELECT * FROM users WHERE id = $1', [userId]);
    const p = { ...(u.profile || {}) };
    if (body.bio !== undefined) p.bio = String(body.bio).replace(/\s+/g, ' ').trim().slice(0, 140);
    if (body.color !== undefined) { if (!PROFILE_COLORS.includes(body.color)) throw new GameError('Couleur invalide.'); p.color = body.color; }
    if (body.title !== undefined) {
      if (body.title === '') p.title = '';
      else {
        const a = ACHIEVEMENTS.find((x) => x.name === body.title);
        if (!a || !progression(u).unlocked.includes(a.id)) throw new GameError('Titre pas encore débloqué.');
        p.title = a.name;
      }
    }
    if (body.showcase !== undefined) {
      const ids = [...new Set((body.showcase || []).map(Number))].slice(0, 6);
      const own = ids.length ? (await db.all('SELECT DISTINCT site_id FROM cards WHERE user_id = $1 AND site_id = ANY($2::int[])', [userId, ids])).map((r) => r.site_id) : [];
      p.showcase = ids.filter((id) => own.includes(id));
    }
    await db.run('UPDATE users SET profile = $1 WHERE id = $2', [JSON.stringify(p), userId]);
    return { profile: p };
  }

  async function compare(meId, name) {
    const o = await db.one('SELECT id, username FROM users WHERE lower(username) = lower($1)', [name]);
    if (!o) throw new GameError('Joueur introuvable.', 404);
    const diff = (a, b) => db.all(`SELECT s.id, s.domain, s.rarity, s.family FROM
      (SELECT DISTINCT site_id FROM cards WHERE user_id = $1 EXCEPT SELECT DISTINCT site_id FROM cards WHERE user_id = $2) x
      JOIN sites s ON s.id = x.site_id ORDER BY s.rarity DESC, s.id LIMIT 24`, [a, b]);
    const [theyHave, iHave, counts] = await Promise.all([diff(o.id, meId), diff(meId, o.id), db.one(`SELECT
      (SELECT COUNT(*) FROM (SELECT DISTINCT site_id FROM cards WHERE user_id = $1 INTERSECT SELECT DISTINCT site_id FROM cards WHERE user_id = $2) x) common,
      (SELECT COUNT(DISTINCT site_id) FROM cards WHERE user_id = $1) mine, (SELECT COUNT(DISTINCT site_id) FROM cards WHERE user_id = $2) theirs`, [meId, o.id])]);
    return { other: o.username, theyHave, iHave, ...counts };
  }

  async function albums(userId) {
    return { items: await db.all(`SELECT s.family, COUNT(DISTINCT s.id)::int n, MAX(s.rarity) best,
        (array_agg(s.domain ORDER BY s.rarity DESC, s.id))[1] top_domain, (array_agg(s.id ORDER BY s.rarity DESC, s.id))[1] top_id
      FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.user_id = $1 GROUP BY s.family ORDER BY n DESC`, [userId]) };
  }

  async function detailedStats(userId) {
    const u = await db.one('SELECT * FROM users WHERE id = $1', [userId]);
    const [money, best, rarities, wk] = await Promise.all([
      db.one(`SELECT COALESCE(SUM(price) FILTER (WHERE seller_id = $1), 0) earned, COALESCE(SUM(price) FILTER (WHERE buyer_id = $1), 0) spent,
        MAX(price) FILTER (WHERE seller_id = $1) best_sale FROM sales WHERE seller_id = $1 OR buyer_id = $1`, [userId]),
      db.one(`SELECT s.id, s.domain, s.rarity, s.family, c.holo FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.user_id = $1
        ORDER BY s.rarity DESC, c.holo DESC, s.id LIMIT 1`, [userId]),
      db.all('SELECT s.rarity, COUNT(*)::int n FROM cards c JOIN sites s ON s.id = c.site_id WHERE c.user_id = $1 GROUP BY s.rarity', [userId]),
      db.one('SELECT COUNT(*) + 1 r FROM users WHERE week_id = $1 AND week_score > $2', [weekId(), u.week_id === weekId() ? u.week_score : 0]),
    ]);
    return { stats: u.stats, ...progression(u), money, best, rarities, pity: u.pity, weekScore: u.week_id === weekId() ? u.week_score : 0, weekRank: wk.r,
      createdAt: u.created_at, bits: u.bits, dexCount: u.dex_count, dexScore: u.dex_score, packsOpened: u.packs_opened };
  }

  // ---------- Codes promo ----------
  const normCode = (c) => String(c || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  async function createPromo(body) {
    const code = normCode(body.code);
    if (code.length < 3) throw new GameError('Code : 3 caractères minimum (lettres, chiffres).');
    const bits = Math.max(0, Math.min(1_000_000, Math.trunc(Number(body.bits) || 0)));
    const packs = Math.max(0, Math.min(100, Math.trunc(Number(body.packs) || 0)));
    if (!bits && !packs) throw new GameError('Le code doit offrir des bits ou des boosters.');
    const days = Math.max(0, Number(body.days) || 0);
    await db.run(`INSERT INTO promo_codes (code, bits, packs, max_uses, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (code) DO UPDATE SET bits = EXCLUDED.bits, packs = EXCLUDED.packs, max_uses = EXCLUDED.max_uses, expires_at = EXCLUDED.expires_at`,
    [code, bits, packs, Math.max(0, Math.trunc(Number(body.maxUses) || 0)), days ? Date.now() + days * DAY : null, Date.now()]);
    return { code };
  }
  const listPromos = async () => ({ items: await db.all('SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT 50') });
  const deletePromo = async (code) => { await db.run('DELETE FROM promo_codes WHERE code = $1', [normCode(code)]); return { ok: true }; };
  const redeem = (userId, raw) => db.tx(async (q) => {
    const code = normCode(raw);
    const p = await q.one('SELECT * FROM promo_codes WHERE code = $1 FOR UPDATE', [code]);
    if (!p || (p.expires_at && p.expires_at < Date.now())) throw new GameError('Code invalide ou expiré.', 404);
    if (p.max_uses && p.uses >= p.max_uses) throw new GameError('Ce code a déjà été utilisé le nombre maximum de fois.');
    await lockUser(q, userId);
    if (!(await q.run('INSERT INTO promo_uses (code, user_id, at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [code, userId, Date.now()]))) throw new GameError('Tu as déjà utilisé ce code.');
    await q.run('UPDATE promo_codes SET uses = uses + 1 WHERE code = $1', [code]);
    await reward(q, userId, { bits: p.bits, packs: p.packs });
    return { bits: p.bits, packs: p.packs };
  });

  // ---------- Événements (admin) ----------
  async function setEvent(type, hours) {
    if (type && !EVENTS[type]) throw new GameError('Événement inconnu.');
    const h = Math.max(0.25, Math.min(72, Number(hours) || 1));
    const value = type ? { type, until: Date.now() + h * 3600e3 } : { type: null, until: 0 };
    await db.run("INSERT INTO meta (key, value) VALUES ('event', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(value)]);
    await game.loadCustom();
    return { event: game.activeEvent() };
  }

  return {
    touch, hub, claimQuest, claimLevel, openChest, spinWheel, scratch, claimCotd, claimCommunity, konami,
    higherLower, higherLowerAnswer, guessRound, guessImage, guessAnswer, duel,
    forgeInfo, forge, holofy, holofyCost, toggle, wishlist, history,
    conversations, thread, sendMessage, gift, saveProfile, compare, albums, detailedStats,
    createPromo, listPromos, deletePromo, redeem, setEvent, community,
  };
}
