// Saison, boss de la semaine, loterie, collections et fil « En direct ».
import { api, state, refreshMe, esc, fmt, $, duration, now, toast, toastErr, busy, sfx, RARITY } from './core.js';

const pctOf = (a, b) => Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100));
const bar = (pct, cls = '') => `<div class="progress ${cls}"><i style="width:${pct}%"></i></div>`;
const countdown = (t) => `<span data-until="${t}">${duration(t - now())}</span>`;

// ======================================================================
// Accueil : bandeau saison / boss / jackpot + fil en direct
// ======================================================================
export async function liveWidget(el) {
  const [d, f] = await Promise.all([api('/live'), api('/feed').catch(() => null)]);
  const s = d.season, b = d.boss;
  const seasonPct = s.tier >= 30 ? 100 : pctOf(s.xp - s.tier * s.tierXp, s.tierXp);
  el.innerHTML = `<div class="live-grid">
    <a class="live-card" href="#/saison"><div class="row"><b class="grow">Saison ${s.id}</b><span class="tag">${s.tier}/30</span></div>
      ${bar(seasonPct)}<div class="muted small">${s.tier > s.claimed ? `<b class="ok-text">${s.tier - s.claimed} palier${s.tier - s.claimed > 1 ? 's' : ''} à récupérer !</b>` : `fin dans ${countdown(s.endsAt)}`}</div></a>
    <a class="live-card boss" href="#/boss"><div class="row"><b class="grow">${b.emoji} ${esc(b.name)}</b>${b.dead ? '<span class="tag good">vaincu</span>' : ''}</div>
      ${bar(100 - pctOf(b.dealt, b.hp), 'hp')}<div class="muted small">${b.dead ? 'Butin à récupérer' : `${fmt(Math.max(0, b.hp - b.dealt))} PV restants`}</div></a>
    <a class="live-card" href="#/loterie"><div class="row"><b class="grow">Loterie</b><span class="mono">${fmt(d.lottery.jackpot)}</span></div>
      <div class="muted small">bits à gagner · tirage dans ${countdown(d.lottery.drawAt)}</div></a>
  </div>
  ${f?.events?.length ? `<div class="panel live-feed" style="margin-top:10px"><div class="row"><b class="grow">En direct</b><span class="muted small">${fmt(f.online)} en ligne · ${fmt(f.auctions)} enchères</span></div>
    <div class="list small" style="margin-top:6px">${f.events.slice(0, 6).map(feedLine).join('')}</div></div>` : ''}`;
}

function feedLine(e) {
  const who = `<b>${esc(e.who || '?')}</b>`;
  const card = e.domain ? `<span class="r-${e.rarity} rtext">${esc(e.domain)}</span>${e.holo ? ' ✦' : ''}` : '';
  const text = e.kind === 'pull' ? `${who} a tiré ${card}`
    : e.kind === 'sold' ? `${who} a vendu ${card}${e.amount ? ` pour ${fmt(e.amount)} bits` : ''}`
      : e.kind === 'trade' ? `${who} a échangé avec <b>${esc(e.other || '?')}</b>`
        : e.kind === 'lottery' ? `${who} a gagné <b>${fmt(e.amount)}</b> bits à la loterie !`
          : `${who}`;
  return `<div><span class="grow">${text}</span><span class="muted">${ago(e.at)}</span></div>`;
}
const ago = (t) => { const m = Math.round((now() - t) / 60000); return m < 1 ? 'à l\'instant' : m < 60 ? `${m} min` : `${Math.round(m / 60)} h`; };

// ======================================================================
// Saison
// ======================================================================
export async function viewSeason(el) {
  const render = async () => {
    const d = await api('/season');
    const inTier = d.tier >= 30 ? d.tierXp : d.xp - d.tier * d.tierXp;
    el.innerHTML = `<div class="page-head"><h1>Saison ${d.id}</h1><span class="muted small">se termine dans ${countdown(d.endsAt)}</span></div>
      <div class="panel"><div class="row"><div class="lvl-badge">${d.tier}</div><div class="grow"><b>Palier ${d.tier} / 30</b>
        <div class="muted small mono">${fmt(d.xp)} XP de saison · ${d.tier >= 30 ? 'saison terminée à 100 % !' : `${fmt(d.tierXp - inTier)} XP avant le palier ${d.tier + 1}`}</div></div>
        ${d.tier > d.claimed ? `<button class="btn primary" data-claim>Récupérer ${d.tier - d.claimed} palier${d.tier - d.claimed > 1 ? 's' : ''}</button>` : ''}</div>
        ${bar(pctOf(inTier, d.tierXp))}
        <p class="muted small" style="margin:8px 0 0">Gagne de l'XP de saison en jouant : booster ouvert ${d.xpTable.packs} · Rare +${d.xpTable.rare} · Épique +${d.xpTable.epic} · Légendaire +${d.xpTable.legendary} · Mythique +${d.xpTable.mythic} · holo +${d.xpTable.holo} · quête +${d.xpTable.quests} · forge +${d.xpTable.forged} · mini-jeu +${d.xpTable.games}. Une nouvelle saison repart de zéro toutes les 2 semaines.</p></div>
      <div class="season-track">${d.tiers.map((t) => {
        const st = t.k <= d.claimed ? 'claimed' : t.k <= d.tier ? 'ready' : 'locked';
        return `<div class="season-tier ${st}${t.reward.booster ? ' big' : ''}"><span class="mono">${t.k}</span><b>${esc(t.text)}</b><span class="small">${st === 'claimed' ? '✓ récupéré' : st === 'ready' ? 'à récupérer' : ''}</span></div>`;
      }).join('')}</div>`;
  };
  await render();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-claim]');
    if (b) busy(b, async () => {
      const r = await api('/season/claim', {});
      toast(`Paliers ${r.from} à ${r.to} : ${[r.bits ? `${fmt(r.bits)} bits` : '', r.packs ? `${r.packs} boosters` : '', ...r.boosters].filter(Boolean).join(', ')}`, 'ok');
      sfx('legend'); refreshMe(); render();
    });
  });
}

// ======================================================================
// Boss de la semaine
// ======================================================================
export async function viewBoss(el) {
  const render = async () => {
    const d = await api('/boss');
    const left = Math.max(0, d.hp - d.dealt);
    el.innerHTML = `<div class="page-head"><h1>${d.emoji} ${esc(d.name)}</h1><span class="muted small">nouveau boss dans ${countdown(d.endsAt)}</span></div>
      ${d.rage ? '<div class="event-banner"><b>Rage du boss</b> Tes boosters infligent ×2 dégâts !</div>' : ''}
      <div class="panel boss-panel${d.dead ? ' dead' : ''}">
        <div class="boss-face">${d.emoji}</div>
        <div class="row"><b class="grow">${d.dead ? 'Vaincu par la communauté !' : `${fmt(left)} / ${fmt(d.hp)} PV`}</b><span class="mono small">${fmt(d.dealt)} dégâts</span></div>
        ${bar(100 - pctOf(d.dealt, d.hp), 'hp')}
        <p class="muted small" style="margin:8px 0 0">Chaque booster ouvert par n'importe quel joueur frappe le boss : Commune ${d.dmgTable[0]} · Peu commune ${d.dmgTable[1]} · Rare ${d.dmgTable[2]} · Épique ${d.dmgTable[3]} · Légendaire ${d.dmgTable[4]} · Mythique ${d.dmgTable[5]} dégâts (holo ×3).</p>
      </div>
      <div class="grid-2" style="margin-top:10px">
        <div class="panel"><b>Toi</b>
          <div class="big-value" style="margin-top:6px">${fmt(d.mine.dmg)}</div><div class="muted small">dégâts cette semaine${d.mine.rank ? ` · ${d.mine.rank}${d.mine.rank === 1 ? 'er' : 'e'}` : ''}</div>
          ${d.dead ? (d.claimed ? '<p class="muted small">Butin récupéré ✓</p>' : d.mine.dmg >= d.minDmg ? '<button class="btn primary" style="margin-top:10px" data-claim>Récupérer le butin</button>' : `<p class="muted small">Il fallait au moins ${d.minDmg} dégâts pour le butin.</p>`)
            : `<p class="muted small">À la chute du boss : 1er → Booster Jackpot + 1 500 bits · 2e-3e → Booster Légende + 800 · 4e-10e → Booster Épique+ + 400 · tous les autres (≥ ${d.minDmg} dégâts) → Butin du boss + 150.</p>`}
        </div>
        <div class="panel"><b>Classement</b><div class="list small" style="margin-top:6px">${d.top.map((t, i) => `<div><span class="grow">${i + 1}. ${esc(t.username)}</span><span class="mono">${fmt(t.dmg)}</span></div>`).join('') || '<div class="muted">Personne n\'a encore frappé</div>'}</div></div>
      </div>
      <a class="btn primary" style="margin-top:12px;width:100%" href="#/">Ouvrir des boosters pour frapper</a>`;
  };
  await render();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-claim]');
    if (b) busy(b, async () => { const r = await api('/boss/claim', {}); toast(`Butin (${r.rank}e) : ${r.text}`, 'ok'); sfx('legend'); refreshMe(); render(); });
  });
}

// ======================================================================
// Loterie
// ======================================================================
export async function viewLottery(el) {
  const render = async () => {
    const d = await api('/lottery');
    el.innerHTML = `<div class="page-head"><h1>Loterie</h1><span class="muted small">tirage dans ${countdown(d.drawAt)}</span></div>
      <div class="panel jackpot"><div class="muted small">Jackpot du jour</div><div class="jackpot-value mono">${fmt(d.jackpot)}</div><div class="muted small">bits · ${fmt(d.tickets)} tickets de ${fmt(d.players)} joueur${d.players > 1 ? 's' : ''}</div></div>
      <div class="grid-2" style="margin-top:10px">
        <div class="panel"><b>Mes tickets : ${d.mine}</b><div class="muted small">${d.mine ? `≈ ${(d.chance * 100).toFixed(d.chance < 0.01 ? 2 : 1).replace('.', ',')} % de chances de tout gagner` : 'Achète des tickets pour participer'}</div>
          <div class="row" style="margin-top:10px"><input type="number" min="1" max="${d.max - d.mine}" value="${Math.min(5, Math.max(1, d.max - d.mine))}" data-n style="width:90px"><button class="btn primary" data-buy ${d.mine >= d.max ? 'disabled' : ''}>Acheter</button></div>
          <p class="muted small" data-cost style="margin:6px 0 0"></p></div>
        <div class="panel"><b>Dernier tirage</b>${d.last ? `<div style="margin-top:6px"><b>${esc(d.last.winner)}</b> a gagné <b>${fmt(d.last.jackpot)}</b> bits</div><div class="muted small">${fmt(d.last.tickets)} tickets · ${fmt(d.last.players)} joueurs · il avait ${(d.last.odds * 100).toFixed(1).replace('.', ',')} % de chances</div>` : '<div class="muted small" style="margin-top:6px">Pas encore de tirage.</div>'}</div>
      </div>
      <p class="muted small">Un ticket coûte ${d.price} bits (maximum ${d.max} par jour). 80 % du prix des tickets va dans le jackpot, et 500 bits y sont ajoutés chaque jour. Un seul gagnant, tiré au hasard selon le nombre de tickets ; sans participant, le jackpot est reporté au lendemain.</p>`;
    const n = $('[data-n]', el);
    const upd = () => { $('[data-cost]', el).textContent = `${fmt((Number(n.value) || 0) * d.price)} bits`; };
    n.addEventListener('input', upd); upd();
  };
  await render();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-buy]');
    if (b) busy(b, async () => { const r = await api('/lottery/buy', { n: Number($('[data-n]', el).value) }); toast(`Tu as ${r.mine} ticket${r.mine > 1 ? 's' : ''}`, 'ok'); sfx('coin'); refreshMe(); render(); });
  });
}

// ======================================================================
// Collections par famille
// ======================================================================
export async function viewSets(el) {
  const render = async () => {
    const d = await api('/sets');
    el.innerHTML = `<div class="page-head"><h1>Collections</h1></div>
      <p class="muted small">Chaque famille de sites a 4 paliers : ${d.steps.map((s) => `${s.n} sites → ${esc(s.text)}`).join(' · ')}.</p>
      <div class="sets-grid">${d.items.map((f) => {
        const next = d.steps[f.reached];
        return `<div class="panel set-card${f.reached > f.claimed ? ' ready' : ''}"><div class="row"><b class="grow">${esc(f.family)}</b><span class="mono small">${fmt(f.n)} / ${fmt(f.total)}</span></div>
          <div class="set-steps">${d.steps.map((s, i) => `<span class="${i < f.claimed ? 'done' : i < f.reached ? 'ready' : ''}">${s.n}</span>`).join('')}</div>
          ${bar(next ? pctOf(f.n, next.n) : 100)}
          ${f.reached > f.claimed ? `<button class="btn primary sm" style="margin-top:8px" data-claim="${esc(f.family)}">Récupérer</button>` : `<div class="muted small" style="margin-top:6px">${next ? `encore ${next.n - f.n} site${next.n - f.n > 1 ? 's' : ''} pour ${esc(next.text)}` : 'Famille terminée ✓'}</div>`}</div>`;
      }).join('')}</div>`;
  };
  await render();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-claim]');
    if (b) busy(b, async () => {
      const r = await api('/sets/claim', { family: b.dataset.claim });
      toast([r.bits ? `${fmt(r.bits)} bits` : '', r.packs ? `${r.packs} boosters` : '', ...r.boosters].filter(Boolean).join(' + '), 'ok'); sfx('coin'); refreshMe(); render();
    });
  });
}
