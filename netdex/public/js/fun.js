// Options « fun » : jeux du jour, mini-jeux, progression, messages, forge, souhaits, effets visuels et style.
import {
  api, state, refreshMe, esc, fmt, $, $$, h, ago, isOnline, cardHtml, toast, toastErr, modal, confirmDialog, busy, prefs,
  RARITY, favicon, siteName, power, sfx, now, duration,
} from './core.js';
import { openSite } from './views.js';

const avatar = (domain, name) => `<div class="avatar">${domain ? `<img class="fav" src="${favicon(domain)}" alt="" data-l="${esc(name[0])}">` : esc(name[0].toUpperCase())}</div>`;
const parseCards = (s) => (s ? String(s).split(',').map((x) => ({ id: parseInt(x, 10), holo: x.endsWith('h') })) : []);
const rewardText = (r) => [r.bits && `+${fmt(r.bits)} bits`, r.packs && `+${r.packs} booster${r.packs > 1 ? 's' : ''}`].filter(Boolean).join(' · ');

// ======================================================================
// Style : couleur d'accent, mode rétro, dos de booster
// ======================================================================
export const ACCENTS = { orange: '#ff5b1f', bleu: '#3d8ee6', vert: '#2fbf71', violet: '#9b5de5', rose: '#ec4899', jaune: '#e0a100' };
export const PACK_BACKS = { classique: 'Classique', grille: 'Grille', code: 'Code', minuit: 'Minuit' };
export function applyStyle() {
  const root = document.documentElement;
  const name = ACCENTS[prefs.get('accent', 'orange')] ? prefs.get('accent', 'orange') : 'orange';
  if (name === 'orange') { root.style.removeProperty('--accent'); root.style.removeProperty('--accent-ink'); } else {
    root.style.setProperty('--accent', ACCENTS[name]);
    root.style.setProperty('--accent-ink', name === 'jaune' || name === 'vert' ? '#111' : '#fff');
  }
  root.classList.toggle('crt', !!prefs.get('crt', false));
  root.dataset.pack = prefs.get('packBack', 'classique');
  root.dataset.grid = prefs.get('gridSize', 'normal');
}

// ======================================================================
// Effets de révélation selon la rareté
// ======================================================================
export function revealFx(card) {
  const r = card.site.rarity;
  if (r >= 5) sfx('legend'); else if (r >= 4) sfx('legend'); else if (r >= 3) sfx('epic'); else if (r >= 2 || card.holo) sfx('rare'); else sfx('flip');
  if (r < 3 && !card.holo) return;
  const color = getComputedStyle(document.documentElement).getPropertyValue(['--r-common', '--r-uncommon', '--r-rare', '--r-epic', '--r-legendary', '--r-mythic'][r]).trim();
  const fl = h(`<div class="fx-flash" style="--fx:${color}"></div>`);
  document.body.append(fl);
  setTimeout(() => fl.remove(), 700);
  if (r >= 4) { document.body.classList.add('fx-shake'); setTimeout(() => document.body.classList.remove('fx-shake'), 600); navigator.vibrate?.([60, 40, 120]); }
  if (r >= 4 || card.holo) confetti(r >= 5 ? 160 : r >= 4 ? 90 : 40, color);
}
export function confetti(n = 60, color = 'var(--accent)') {
  const box = h('<div class="fx-confetti"></div>');
  const colors = [color, '#ffffff', 'var(--accent)', '#ffd34d'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};--dx:${(Math.random() - 0.5) * 220}px;--rot:${Math.random() * 720}deg;animation-delay:${Math.random() * 0.25}s;animation-duration:${1.4 + Math.random() * 1.2}s`;
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3000);
}

// ======================================================================
// Inspection plein écran (inclinaison 3D + reflet)
// ======================================================================
export function inspectCard(site, holo = false) {
  const ov = h(`<div class="overlay inspect"><div class="insp-stage"><div class="insp-card">${cardHtml(site, { holo })}<div class="insp-glare"></div></div></div>
    <p class="muted small">Bouge le doigt ou la souris sur la carte · touche pour fermer</p></div>`);
  document.body.append(ov);
  const c = $('.insp-card', ov);
  const tilt = (x, y) => { c.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 22}deg)`; c.style.setProperty('--gx', `${50 + x * 50}%`); c.style.setProperty('--gy', `${50 + y * 50}%`); };
  ov.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); tilt(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2); });
  const orient = (e) => tilt(Math.max(-1, Math.min(1, (e.gamma || 0) / 30)), Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30)));
  window.addEventListener('deviceorientation', orient);
  ov.addEventListener('click', () => { window.removeEventListener('deviceorientation', orient); ov.remove(); });
}

// ======================================================================
// Partage d'une carte
// ======================================================================
export async function shareSite(s) {
  const url = `${location.origin}/#/site/${s.id}`;
  const text = `Regarde ma carte ${s.domain} (${RARITY[s.rarity].name}) sur Netdex !`;
  try {
    if (navigator.share) await navigator.share({ title: 'Netdex', text, url });
    else { await navigator.clipboard.writeText(`${text} ${url}`); toast('Lien copié !', 'ok'); }
  } catch { /* partage annulé */ }
}

// ======================================================================
// Jeux : récompenses du jour, quêtes, défi communautaire, mini-jeux
// ======================================================================
export async function viewPlay(el, { on }) {
  const render = async () => {
    const d = await api('/fun');
    const pct = Math.min(100, ((d.xp - d.cur) / Math.max(1, d.next - d.cur)) * 100);
    const comm = d.community;
    el.innerHTML = `
      <div class="page-head"><h1>Jeux</h1><div class="row"><a class="btn sm" href="#/progress">Succès & stats</a></div></div>
      ${d.event ? `<div class="event-banner"><b>${esc(d.event.name)}</b> ${esc(d.event.desc)} · encore <span data-until="${d.event.until}">${duration(d.event.until - now())}</span></div>` : ''}
      <div class="panel level-panel">
        <div class="row"><div class="lvl-badge">${d.level}</div><div class="grow"><b>Niveau ${d.level}</b>
          <div class="muted small mono">${fmt(d.xp)} XP · prochain niveau à ${fmt(d.next)}</div></div>
          ${d.claimedLevel < d.level ? `<button class="btn primary sm" data-level>Récompense niveau ${d.level} (${rewardText(d.levelReward)}${d.level - d.claimedLevel > 1 ? '…' : ''})</button>` : ''}</div>
        <div class="progress" style="margin-top:10px"><i style="width:${pct}%"></i></div>
      </div>

      <h2>Chaque jour</h2>
      <div class="daily-grid">
        <button class="daily-tile${d.daily.chest ? ' ready' : ''}" data-chest ${d.daily.chest ? '' : 'disabled'}><span class="dt-ico">▣</span><b>Coffre</b><span>${d.daily.chest ? '1 carte Rare ou mieux' : 'Ouvert · demain'}</span></button>
        <button class="daily-tile${d.daily.wheel ? ' ready' : ''}" data-wheel ${d.daily.wheel ? '' : 'disabled'}><span class="dt-ico">◎</span><b>Roue</b><span>${d.daily.wheel ? 'Jusqu\'à 1000 bits' : 'Tournée · demain'}</span></button>
        <button class="daily-tile${d.daily.scratch ? ' ready' : ''}" data-scratch ${d.daily.scratch ? '' : 'disabled'}><span class="dt-ico">▦</span><b>Ticket</b><span>${d.daily.scratch ? 'À gratter' : 'Gratté · demain'}</span></button>
        <div class="daily-tile cotd${d.cotd.owned && d.daily.cotd ? ' ready' : ''}" data-cotd-tile>
          <span class="dt-ico">✦</span><b>Carte du jour</b>
          <span><a href="#" data-site-link="${d.cotd.site.id}" class="r-${d.cotd.site.rarity} rtext">${esc(d.cotd.site.domain)}</a></span>
          ${d.cotd.owned ? (d.daily.cotd ? `<button class="btn primary sm" data-cotd>+${d.cotd.bits} bits</button>` : '<span class="muted">Récupéré</span>') : '<span class="muted">Possède-la pour +' + d.cotd.bits + ' bits</span>'}
        </div>
      </div>

      <h2>Quêtes du jour</h2>
      <div class="panel list">${d.quests.map((q) => `<div>
          <div class="grow"><b>${esc(q.text)}</b><div class="progress" style="margin-top:6px"><i style="width:${(q.progress / q.n) * 100}%"></i></div></div>
          <span class="mono small">${q.progress}/${q.n}</span>
          ${q.claimed ? '<span class="tag good">fait</span>' : `<button class="btn sm${q.progress >= q.n ? ' primary' : ''}" data-quest="${q.id}" ${q.progress >= q.n ? '' : 'disabled'}>+${q.bits}</button>`}
        </div>`).join('')}
        <div class="muted small">Les 3 quêtes terminées = 1 booster en plus. Nouvelles quêtes chaque jour.</div></div>

      <h2>Défi communautaire de la semaine</h2>
      <div class="panel">
        ${(() => {
          const next = comm.tiers.find((t) => !t.done) || comm.tiers[comm.tiers.length - 1];
          const claimable = comm.reached - comm.claimed;
          return `<div class="row"><div class="grow"><b>${fmt(next.target)} boosters ouverts par tous les joueurs</b>
            <div class="muted small">Palier ${Math.min(comm.reached + 1, comm.tiers.length)}/${comm.tiers.length} · récompense pour chacun : ${rewardText(next.reward)}</div></div>
            ${claimable > 0 ? `<button class="btn primary sm" data-community>Récupérer ${claimable > 1 ? claimable + ' paliers' : 'le palier'}</button>` : comm.claimed ? `<span class="tag good">${comm.claimed}/${comm.tiers.length} récupéré${comm.claimed > 1 ? 's' : ''}</span>` : ''}</div>
          <div class="progress" style="margin-top:10px"><i style="width:${Math.min(100, (comm.progress / next.target) * 100)}%"></i></div>
          <div class="tiers-row">${comm.tiers.map((t, k) => `<span class="${k < comm.claimed ? 'got' : t.done ? 'ready' : ''}">${fmt(t.target)}</span>`).join('')}</div>
          <div class="muted small mono" style="margin-top:6px">${fmt(comm.progress)} / ${fmt(next.target)}</div>`;
        })()}
      </div>

      <h2>Mini-jeux <span class="muted" style="text-transform:none;letter-spacing:0">· encore ${d.gamesLeft} bits à gagner aujourd'hui</span></h2>
      <div class="games-grid">
        <button class="game-tile" data-game="hl"><b>Plus ou moins</b><span>Lequel des deux sites est le plus visité ?</span></button>
        <button class="game-tile" data-game="guess"><b>Devine le site</b><span>Retrouve le site à partir de son icône</span></button>
        <button class="game-tile" data-game="duel"><b>Duel de cartes</b><span>3 de tes cartes contre celles d'un joueur</span></button>
        <button class="game-tile" data-game="memo"><b>Mémo</b><span>Retrouve les paires d'icônes, contre la montre</span></button>
      </div>
      <h2>Ateliers</h2>
      <div class="games-grid">
        <a class="game-tile" href="#/forge"><b>Forge</b><span>Fusionne tes doublons en une carte plus rare</span></a>
        <a class="game-tile" href="#/wishlist"><b>Liste de souhaits</b><span>Sois alerté quand une carte est mise en vente</span></a>
      </div>`;
  };
  await render();
  on('nd:fun', () => render().catch(toastErr));
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button, a[data-site-link]');
    if (!b) return;
    const done = (msg) => { if (msg) toast(msg, 'ok'); refreshMe(); document.dispatchEvent(new CustomEvent('nd:fun')); };
    if (b.matches('[data-site-link]')) { e.preventDefault(); openSite(b.dataset.siteLink); }
    else if (b.matches('[data-level]')) busy(b, async () => { const r = await api('/fun/level', {}); sfx('coin'); confetti(50); done(`Niveau ${r.level} ! ${rewardText(r)}`); });
    else if (b.matches('[data-quest]')) busy(b, async () => { const r = await api('/fun/quest/' + b.dataset.quest, {}); sfx('coin'); done(rewardText(r)); });
    else if (b.matches('[data-community]')) busy(b, async () => { const r = await api('/fun/community', {}); sfx('coin'); confetti(60); done(rewardText(r)); });
    else if (b.matches('[data-cotd]')) busy(b, async () => { const r = await api('/fun/cotd', {}); sfx('coin'); done(rewardText(r)); });
    else if (b.matches('[data-chest]')) busy(b, async () => { const r = await api('/fun/chest', {}); showCards('Coffre du jour', r.cards); done(); });
    else if (b.matches('[data-wheel]')) wheelGame(() => done());
    else if (b.matches('[data-scratch]')) scratchGame(() => done());
    else if (b.matches('[data-game]')) ({ hl: higherLowerGame, guess: guessGame, duel: duelGame, memo: memoGame })[b.dataset.game](() => document.dispatchEvent(new CustomEvent('nd:fun')));
  });
}

function showCards(title, cards) {
  cards.forEach((c, i) => setTimeout(() => revealFx(c), 250 + i * 200));
  modal(esc(title), `<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(140px,180px));justify-content:center">${cards.map((c) => cardHtml(c.site, { holo: c.holo, isNew: c.isNew })).join('')}</div>
    <p class="center muted small">${cards.map((c) => `<span class="r-${c.site.rarity} rtext">${RARITY[c.site.rarity].name}${c.holo ? ' HOLO' : ''}</span>`).join(' · ')}</p>`, {
    onMount: (b) => b.addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) openSite(c.dataset.site); }),
  });
}

// ---------- Roue de la fortune ----------
function wheelGame(after) {
  const labels = ['20 bits', '50 bits', '1 booster', '100 bits', '2 boosters', '250 bits', 'Carte Rare+', '1000 bits'];
  const seg = 360 / labels.length;
  const colors = ['var(--surface-2)', 'var(--surface)'];
  const paths = labels.map((l, i) => {
    const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180;
    const x0 = 100 + 96 * Math.cos(a0), y0 = 100 + 96 * Math.sin(a0), x1 = 100 + 96 * Math.cos(a1), y1 = 100 + 96 * Math.sin(a1);
    const mid = (i + 0.5) * seg;
    return `<path d="M100 100 L${x0} ${y0} A96 96 0 0 1 ${x1} ${y1} Z" fill="${i === 7 ? 'var(--accent)' : colors[i % 2]}" stroke="var(--line-2)"/>
      <text x="100" y="30" transform="rotate(${mid} 100 100)${mid > 90 && mid < 270 ? ' rotate(180 100 30)' : ''}" text-anchor="middle" dominant-baseline="middle" class="wheel-txt${i === 7 ? ' jack' : ''}">${l}</text>`;
  }).join('');
  modal('Roue de la fortune', `<div class="wheel-wrap"><div class="wheel-ptr"></div>
      <svg viewBox="0 0 200 200" class="wheel" data-wheel>${paths}<circle cx="100" cy="100" r="14" fill="var(--text)"/></svg></div>
    <p class="center" data-res style="min-height:24px"></p>
    <div class="center"><button class="btn primary big" data-spin>Tourner</button></div>`, {
    onMount(body, close) {
      $('[data-spin]', body).addEventListener('click', (e) => busy(e.target, async () => {
        const r = await api('/fun/wheel', {});
        e.target.remove();
        const target = 360 * 6 + (360 - (r.index + 0.5) * seg);
        const w = $('[data-wheel]', body);
        w.style.transform = `rotate(${target}deg)`;
        const ticks = setInterval(() => sfx('tick'), 120);
        setTimeout(() => {
          clearInterval(ticks);
          sfx(r.index >= 5 ? 'epic' : 'coin');
          if (r.index >= 5) confetti(80);
          $('[data-res]', body).innerHTML = `<b>${esc(r.label)} !</b> ${r.bits ? `+${fmt(r.bits)} bits` : ''}`;
          if (r.cards?.length) setTimeout(() => { close(); showCards('Roue de la fortune', r.cards); }, 900);
          after();
        }, 4200);
      }));
    },
  });
}

// ---------- Ticket à gratter ----------
function scratchGame(after) {
  modal('Ticket à gratter', `<p class="muted small center">Gratte les 9 cases : 3 symboles identiques = gagné. ● 15 · ♣ 40 · ★ 80 · ♥ booster · ◆ 200 · ♛ 600</p>
    <div class="scratch" data-grid><div class="center" style="grid-column:1/-1"><button class="btn primary big" data-buy>Prendre mon ticket</button></div></div>
    <p class="center" data-res style="min-height:24px"></p>`, {
    onMount(body) {
      $('[data-buy]', body).addEventListener('click', (e) => busy(e.target, async () => {
        const r = await api('/fun/scratch', {});
        after();
        const grid = $('[data-grid]', body);
        grid.innerHTML = r.grid.map((s, i) => `<div class="sc-cell" data-i="${i}"><span class="${r.win && s === r.win.sym ? 'win' : ''}">${s}</span><div class="sc-cover"></div></div>`).join('');
        let down = false, left = 9;
        const reveal = (cell) => {
          if (!cell || cell.classList.contains('open')) return;
          cell.classList.add('open'); sfx('tick');
          if (--left === 0) finish();
        };
        const finish = () => {
          $$('.sc-cell', grid).forEach((c) => c.classList.add('open'));
          $('[data-res]', body).innerHTML = r.win ? `<b>Gagné : ${r.win.sym} ${r.win.sym} ${r.win.sym} → ${rewardText(r.win)}</b>` : '<span class="muted">Perdu… retente demain !</span>';
          if (r.win) { sfx('coin'); confetti(50); grid.classList.add('won'); } else sfx('lose');
          refreshMe();
        };
        grid.addEventListener('pointerdown', (ev) => { down = true; reveal(ev.target.closest('.sc-cell')); });
        grid.addEventListener('pointerover', (ev) => { if (down) reveal(ev.target.closest('.sc-cell')); });
        grid.addEventListener('pointermove', (ev) => { if (down) reveal(document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.sc-cell')); });
        window.addEventListener('pointerup', () => { down = false; });
        const all = h('<div class="center" style="margin-top:8px"><button class="btn sm ghost">Tout gratter</button></div>');
        grid.after(all);
        all.addEventListener('click', () => { if (left > 0) { left = 0; finish(); } all.remove(); });
      }));
    },
  });
}

// ---------- Plus ou moins ----------
function higherLowerGame(after) {
  modal('Plus ou moins', `<p class="muted small center" style="margin-top:0">Quel site est le plus visité au monde ? (+5 bits par bonne réponse)</p>
    <div class="hl" data-hl><div class="spinner"></div></div><p class="center" data-res style="min-height:44px"></p>`, {
    async onMount(body) {
      let round = await api('/fun/hl').catch((e) => { toastErr(e); return null; });
      if (!round) return;
      let locked = false;
      const draw = () => {
        $('[data-hl]', body).innerHTML = ['a', 'b'].map((k) => `<button class="hl-opt" data-pick="${k}"><img class="fav" src="${favicon(round[k].domain)}" alt="" data-l="${esc(round[k].domain[0])}"><b>${esc(round[k].domain)}</b><span class="hl-rank"></span></button>`).join('<span class="hl-vs">ou</span>')
          + `<div class="hl-streak mono">Série : ${round.streak} · record ${round.best}</div>`;
      };
      draw();
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-pick]');
        if (!b || locked) return;
        locked = true;
        try {
          const r = await api('/fun/hl', { pick: b.dataset.pick });
          for (const k of ['a', 'b']) {
            const opt = $(`[data-pick=${k}]`, body);
            $('.hl-rank', opt).textContent = '#' + fmt(r.ranks[k]);
            opt.classList.add(k === r.right ? 'good' : 'bad');
          }
          sfx(r.ok ? 'coin' : 'lose');
          $('[data-res]', body).innerHTML = r.ok ? `<b>Bien vu !</b> ${r.bits ? `+${r.bits} bits` : '(plafond du jour atteint)'} · série ${r.streak}` : `<b>Raté.</b> Série remise à zéro (record ${r.best})`;
          after();
          setTimeout(() => { round = r.next; locked = false; $('[data-res]', body).innerHTML = ''; draw(); }, 1600);
        } catch (err) { toastErr(err); locked = false; }
      });
    },
  });
}

// ---------- Devine le site ----------
function guessGame(after) {
  modal('Devine le site', `<div data-g><div class="spinner"></div></div>`, {
    async onMount(body) {
      const next = async () => {
        const r = await api('/fun/guess/new', {});
        $('[data-g]', body).innerHTML = `<p class="muted small center" style="margin-top:0">À quel site appartient cette icône ? (+10 bits)</p>
          <div class="guess-img"><img src="${r.img}" alt="Icône mystère"></div>
          <div class="guess-opts">${r.options.map((o) => `<button class="btn" data-ans="${esc(o)}">${esc(o)}</button>`).join('')}</div><p class="center" data-res style="min-height:24px"></p>`;
      };
      await next().catch(toastErr);
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ans]');
        if (!b || b.disabled) return;
        $$('[data-ans]', body).forEach((x) => { x.disabled = true; });
        api('/fun/guess', { domain: b.dataset.ans }).then((r) => {
          $$('[data-ans]', body).forEach((x) => { if (x.dataset.ans === r.answer) x.classList.add('primary'); });
          if (!r.ok) b.classList.add('danger');
          sfx(r.ok ? 'coin' : 'lose');
          $('[data-res]', body).innerHTML = `${r.ok ? `<b>Exact !</b> ${r.bits ? `+${r.bits} bits` : '(plafond du jour atteint)'}` : `<b>Non :</b> c'était ${esc(r.answer)}`} · rang #${fmt(r.rank)}
            <div style="margin-top:8px"><button class="btn sm" data-again>Suivant</button></div>`;
          after();
        }).catch(toastErr);
      });
      body.addEventListener('click', (e) => { if (e.target.closest('[data-again]')) next().catch(toastErr); });
    },
  });
}

// ---------- Duel ----------
function duelGame(after) {
  modal('Duel de cartes', `<p class="muted small" style="margin-top:0">Choisis 3 cartes (l'ordre compte). Chaque manche : puissance de la carte + un peu de chance (holo +100). 2 manches gagnées = victoire (+25 bits). Tes cartes ne sont pas perdues.</p>
    <div class="row" style="margin-bottom:8px"><b class="grow" data-sel-n>0 / 3</b><button class="btn primary" data-fight disabled>Combattre</button></div>
    <div class="picker"><div class="cards mini-cards" data-grid><div class="spinner"></div></div></div><div data-arena></div>`, {
    wide: true,
    async onMount(body) {
      const rows = (await api('/collection?' + new URLSearchParams({ sort: 'rank', limit: 200 }))).items.filter((s) => s.cards);
      const sel = [];
      const draw = () => {
        $('[data-grid]', body).innerHTML = rows.map((s) => cardHtml(s, { holo: s.holo > 0, selected: sel.some((x) => x.site === s.id) })).join('') || '<div class="empty">Aucune carte</div>';
        $('[data-sel-n]', body).textContent = `${sel.length} / 3`;
        $('[data-fight]', body).disabled = sel.length !== 3;
      };
      draw();
      $('[data-grid]', body).addEventListener('click', (e) => {
        const c = e.target.closest('.card');
        if (!c) return;
        const id = Number(c.dataset.site);
        const i = sel.findIndex((x) => x.site === id);
        if (i >= 0) sel.splice(i, 1);
        else if (sel.length < 3) { const s = rows.find((x) => x.id === id); const copies = parseCards(s.cards); const pick = copies.find((x) => x.holo) || copies[0]; sel.push({ site: id, card: pick.id }); }
        draw();
      });
      $('[data-fight]', body).addEventListener('click', (e) => busy(e.target, async () => {
        const r = await api('/fun/duel', { cardIds: sel.map((x) => x.card) });
        const arena = $('[data-arena]', body);
        arena.innerHTML = `<h2>Contre ${esc(r.foe)}</h2><div class="duel">${r.rounds.map((rd, i) => `<div class="duel-round" style="animation-delay:${i * 0.7}s">
            <div class="${rd.win ? 'won' : 'lost'}">${cardHtml(rd.mine, { holo: rd.mine.holo })}<b class="mono">${rd.mine.score}</b></div><span class="hl-vs">vs</span>
            <div class="${rd.win ? 'lost' : 'won'}">${cardHtml(rd.theirs, { holo: rd.theirs.holo })}<b class="mono">${rd.theirs.score}</b></div></div>`).join('')}</div>
          <p class="center duel-res" style="animation-delay:${r.rounds.length * 0.7}s">${r.won ? `<b>Victoire !</b> ${r.bits ? `+${r.bits} bits` : '(plafond du jour atteint)'}` : '<b>Défaite…</b> Retente avec d\'autres cartes.'}</p>`;
        arena.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => { sfx(r.won ? 'epic' : 'lose'); if (r.won) confetti(60); }, r.rounds.length * 700);
        sel.length = 0; draw(); after();
      }));
    },
  });
}

// ---------- Mémo (record personnel) ----------
async function memoGame() {
  let sites = (await api('/collection?' + new URLSearchParams({ sort: 'rarity', limit: 8 })).catch(() => ({ items: [] }))).items.map((s) => s.domain);
  const fill = ['google.com', 'youtube.com', 'wikipedia.org', 'amazon.com', 'netflix.com', 'reddit.com', 'twitch.tv', 'github.com'];
  for (const f of fill) if (sites.length < 8 && !sites.includes(f)) sites.push(f);
  sites = sites.slice(0, 8);
  const deck = [...sites, ...sites].map((d, i) => ({ d, k: i })).sort(() => Math.random() - 0.5);
  const best = prefs.get('memoBest', null);
  modal('Mémo', `<div class="row" style="margin-bottom:10px"><span class="grow mono" data-time>0,0 s</span><span class="mono" data-moves>0 coups</span>${best ? `<span class="muted small">record ${(best / 1000).toFixed(1).replace('.', ',')} s</span>` : ''}</div>
    <div class="memo">${deck.map((c, i) => `<button class="memo-c" data-i="${i}"><img class="fav" src="${favicon(c.d)}" alt="" data-l="${esc(c.d[0])}"></button>`).join('')}</div><p class="center" data-res></p>`, {
    onMount(body, close) {
      let first = null, busyFlip = false, moves = 0, found = 0, t0 = 0, iv = null;
      body.addEventListener('click', (e) => {
        const b = e.target.closest('.memo-c');
        if (!b || busyFlip || b.classList.contains('open')) return;
        if (!t0) { t0 = Date.now(); iv = setInterval(() => { if (!body.isConnected) return clearInterval(iv); $('[data-time]', body).textContent = ((Date.now() - t0) / 1000).toFixed(1).replace('.', ',') + ' s'; }, 100); }
        b.classList.add('open'); sfx('flip');
        if (!first) { first = b; return; }
        moves++; $('[data-moves]', body).textContent = `${moves} coups`;
        const a = deck[first.dataset.i], c = deck[b.dataset.i];
        if (a.d === c.d) {
          first.classList.add('done'); b.classList.add('done'); first = null; found++; sfx('pop');
          if (found === 8) {
            clearInterval(iv);
            const ms = Date.now() - t0;
            const rec = !best || ms < best;
            if (rec) prefs.set('memoBest', ms);
            $('[data-res]', body).innerHTML = `<b>Terminé en ${(ms / 1000).toFixed(1).replace('.', ',')} s et ${moves} coups</b>${rec ? ' · nouveau record !' : ''}`;
            sfx('epic'); if (rec) confetti(50);
          }
        } else {
          busyFlip = true;
          setTimeout(() => { first.classList.remove('open'); b.classList.remove('open'); first = null; busyFlip = false; }, 700);
        }
      });
    },
  });
}

// ======================================================================
// Succès, titres et statistiques détaillées
// ======================================================================
export async function viewProgress(el) {
  const [d, st] = await Promise.all([api('/fun'), api('/fun/stats')]);
  const s = st.stats || {};
  const title = state.me.user.profile?.title || '';
  const done = d.achievements.filter((a) => a.done);
  el.innerHTML = `<div class="page-head"><h1>Succès & stats</h1><div class="row"><a class="btn sm" href="#/play">Jeux</a></div></div>
    <div class="quick-grid">
      <div class="quick"><b>${d.level}</b><span>Niveau (${fmt(d.xp)} XP)</span></div>
      <div class="quick"><b>${done.length}/${d.achievements.length}</b><span>Succès</span></div>
      <div class="quick"><b>#${fmt(st.weekRank)}</b><span>Cette semaine (${fmt(st.weekScore)} pts)</span></div>
      <div class="quick"><b>${st.pity}/${state.me.config.pityAfter}</b><span>Compteur de pitié</span></div>
    </div>
    <h2>Titre affiché sur ton profil</h2>
    <div class="panel row"><select data-title style="flex:1"><option value="">Aucun</option>${done.map((a) => `<option${a.name === title ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
    <h2>Succès</h2>
    <div class="ach-grid">${d.achievements.map((a) => `<div class="ach${a.done ? ' done' : ''}"><b>${a.done ? '✓ ' : ''}${esc(a.name)}</b><span>${esc(a.desc)}</span></div>`).join('')}</div>
    <h2>Statistiques</h2>
    <div class="panel"><dl class="kv">
      <dt>Boosters ouverts</dt><dd>${fmt(st.packsOpened)}</dd>
      <dt>Cartes obtenues (depuis le suivi)</dt><dd>${fmt(s.cards)}</dd>
      <dt>Rare ou mieux</dt><dd>${fmt(s.rare)}</dd>
      <dt>Épiques ou mieux</dt><dd>${fmt(s.epic)}</dd>
      <dt>Légendaires ou mieux</dt><dd>${fmt(s.legendary)}</dd>
      <dt>Mythiques</dt><dd>${fmt(s.mythic)}</dd>
      <dt>Holos</dt><dd>${fmt(s.holo)}</dd>
      <dt>Sites découverts</dt><dd>${fmt(st.dexCount)}</dd>
      <dt>Ventes / achats</dt><dd>${fmt(s.sold)} / ${fmt(s.bought)}</dd>
      <dt>Bits gagnés en ventes</dt><dd>${fmt(st.money.earned)}</dd>
      <dt>Bits dépensés aux enchères</dt><dd>${fmt(st.money.spent)}</dd>
      <dt>Meilleure vente</dt><dd>${st.money.best_sale ? fmt(st.money.best_sale) + ' bits' : '—'}</dd>
      <dt>Échanges</dt><dd>${fmt(s.traded)}</dd>
      <dt>Forges / holo-isations</dt><dd>${fmt(s.forged)} / ${fmt(s.holofied)}</dd>
      <dt>Cartes recyclées</dt><dd>${fmt(s.recycled)}</dd>
      <dt>Parties de mini-jeux / duels gagnés</dt><dd>${fmt(s.games)} / ${fmt(s.wins)}</dd>
      <dt>Quêtes terminées</dt><dd>${fmt(s.quests)}</dd>
      <dt>Cadeaux faits</dt><dd>${fmt(s.gifts)}</dd>
      <dt>Meilleure carte</dt><dd>${st.best ? `<a href="#" data-site-link="${st.best.id}" class="r-${st.best.rarity} rtext">${esc(st.best.domain)}${st.best.holo ? ' ✦' : ''}</a>` : '—'}</dd>
      <dt>Inscrit</dt><dd>${ago(st.createdAt)}</dd>
    </dl></div>
    <div class="row" style="margin-top:12px"><a class="btn" href="#/history">Historique de mes ventes et achats</a><a class="btn" href="#/albums">Albums par famille</a></div>`;
  $('[data-title]', el).addEventListener('change', (e) => api('/fun/profile', { title: e.target.value }).then(() => { toast('Titre mis à jour', 'ok'); refreshMe(); }).catch(toastErr));
  el.addEventListener('click', (e) => { const a = e.target.closest('[data-site-link]'); if (a) { e.preventDefault(); openSite(a.dataset.siteLink); } });
}

// Succès débloqués depuis la dernière visite : petite annonce.
export function checkAchievements() {
  const got = state.me?.user?.achievements || [];
  const key = 'ach.' + state.me.user.id;
  const seen = prefs.get(key, null);
  if (seen) {
    const fresh = got.filter((a) => !seen.includes(a));
    if (fresh.length) { toast(`Succès débloqué${fresh.length > 1 ? 's' : ''} ! Voir Jeux › Succès`, 'ok'); sfx('rare'); }
  }
  prefs.set(key, got);
}

// ======================================================================
// Messages privés
// ======================================================================
export async function viewMessages(el, { params, on }) {
  if (!params.id) {
    const d = await api('/fun/messages');
    el.innerHTML = `<div class="page-head"><h1>Messages</h1></div>
      ${d.items.length ? `<div class="panel list">${d.items.map((c) => `<a href="#/messages/${c.id}" style="color:var(--text)">${avatar(c.avatar_domain, c.username)}
        <div class="grow"><b>${esc(c.username)}</b> ${isOnline(c.last_seen) ? '<span class="online"></span>' : ''}
          <div class="muted small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.text ? (c.from_id === state.me.user.id ? 'Toi : ' : '') + esc(c.text) : 'Aucun message'}</div></div>
        ${c.unread ? `<span class="tag accent">${c.unread}</span>` : c.at ? `<span class="muted small">${ago(c.at)}</span>` : ''}</a>`).join('')}</div>`
        : '<div class="panel empty"><b>Aucune conversation</b>Ajoute des amis dans l\'onglet Social pour discuter.</div>'}`;
    return;
  }
  const meId = state.me.user.id;
  el.innerHTML = '<div class="spinner"></div>';
  const load = async () => {
    const d = await api('/fun/messages/' + params.id);
    const list = $('[data-msgs]', el);
    if (!list) {
      el.innerHTML = `<div class="page-head"><a class="btn sm ghost" href="#/messages">‹</a><h1><a href="#/u/${encodeURIComponent(d.other.username)}" style="text-decoration:none">${esc(d.other.username)}</a></h1>
        ${isOnline(d.other.last_seen) ? '<span class="online"></span>' : ''}<div class="row"><button class="btn sm" data-gift>Offrir</button></div></div>
        <div class="chat" data-msgs></div>
        ${d.other.friend ? '' : '<p class="muted small">Vous n\'êtes pas (ou plus) amis : tu peux lire ces messages, mais pour répondre il faut l\'ajouter en ami.</p>'}
        <form class="chat-form" data-send><input type="text" name="t" maxlength="500" placeholder="Écris un message…" autocomplete="off"><button class="btn primary">Envoyer</button></form>`;
      $('[data-send]', el).addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target;
        const text = f.t.value.trim();
        if (!text) return;
        busy($('button', f), async () => { await api('/fun/messages/' + params.id, { text }); f.t.value = ''; sfx('pop'); await load(); });
      });
      $('[data-gift]', el).addEventListener('click', () => giftDialog({ id: d.other.id, username: d.other.username }));
    }
    const box = $('[data-msgs]', el);
    box.innerHTML = d.items.map((m) => `<div class="msg${m.from_id === meId ? ' me' : ''}"><span>${esc(m.text)}</span><small>${ago(m.at)}</small></div>`).join('') || '<div class="empty">Dis bonjour !</div>';
    box.scrollTop = box.scrollHeight;
  };
  await load();
  refreshMe().catch(() => {});
  const iv = setInterval(() => { if (document.visibilityState === 'visible') load().catch(() => {}); }, 8000);
  on('nd:leave', () => clearInterval(iv));
}

// ======================================================================
// Cadeaux entre amis
// ======================================================================
export function giftDialog(friend) {
  modal(`Cadeau pour ${esc(friend.username)}`, `<p class="muted small" style="margin-top:0">5 cadeaux par jour, 500 bits maximum par jour.</p>
    <label class="field"><span>Bits (solde : ${fmt(state.me.user.bits)})</span><input type="number" min="0" value="0" data-bits></label>
    <input type="search" placeholder="Choisir une carte (optionnel)…" data-q style="margin-bottom:8px">
    <div class="picker"><div class="cards mini-cards" data-grid></div></div>
    <button class="btn primary" style="margin-top:12px" data-go>Offrir</button>`, {
    wide: true,
    async onMount(body, close) {
      let rows = [], pick = null;
      const load = async (q = '') => {
        rows = (await api('/collection?' + new URLSearchParams({ q, sort: 'rarity', limit: 200 }))).items.filter((s) => s.cards);
        $('[data-grid]', body).innerHTML = rows.map((s) => cardHtml(s, { holo: s.holo > 0, selected: pick?.site === s.id })).join('') || '<div class="empty">Aucune carte</div>';
      };
      let t;
      $('[data-q]', body).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => load(e.target.value.trim()).catch(toastErr), 200); });
      $('[data-grid]', body).addEventListener('click', (e) => {
        const c = e.target.closest('.card');
        if (!c) return;
        const s = rows.find((x) => x.id === Number(c.dataset.site));
        const copies = parseCards(s.cards);
        pick = pick?.site === s.id ? null : { site: s.id, card: (copies.find((x) => !x.holo) || copies[0]).id };
        $$('.card', body).forEach((x) => x.classList.toggle('selected', pick && Number(x.dataset.site) === pick.site));
      });
      $('[data-go]', body).addEventListener('click', (e) => busy(e.target, async () => {
        await api('/fun/gift', { toUserId: friend.id, bits: Number($('[data-bits]', body).value) || 0, cardId: pick?.card || null });
        toast('Cadeau envoyé !', 'ok'); sfx('coin'); close(); refreshMe(); document.dispatchEvent(new CustomEvent('nd:cards'));
      }));
      await load().catch(toastErr);
    },
  });
}

// ======================================================================
// Forge
// ======================================================================
export async function viewForge(el, { on }) {
  const render = async () => {
    const d = await api('/fun/forge');
    el.innerHTML = `<div class="page-head"><h1>Forge</h1></div>
      <p class="muted">Fusionne des doublons (non holo, hors favoris ★) en une carte aléatoire de la rareté au-dessus. Il te reste toujours un exemplaire de chaque site.</p>
      <div class="panel list">${d.items.map((f) => `<div class="r-${f.rarity}">
        <div class="grow"><b><span class="rtext">${f.cost} × ${RARITY[f.rarity].name}</span> → <span class="r-${f.rarity + 1}"><span class="rtext">1 ${RARITY[f.rarity + 1].name}</span></span></b>
          <div class="muted small">${f.available} doublon${f.available > 1 ? 's' : ''} disponible${f.available > 1 ? 's' : ''}</div></div>
        <button class="btn sm${f.available >= f.cost ? ' primary' : ''}" data-forge="${f.rarity}" ${f.available >= f.cost ? '' : 'disabled'}>Forger</button></div>`).join('')}</div>`;
  };
  await render();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-forge]');
    if (!b) return;
    const r = Number(b.dataset.forge);
    busy(b, async () => {
      if (!(await confirmDialog('Forger', `Fusionner des doublons ${RARITY[r].name} en une carte <b>${RARITY[r + 1].name}</b> ?`, 'Forger'))) return;
      const res = await api('/fun/forge', { rarity: r });
      showCards('Forge', res.cards);
      document.dispatchEvent(new CustomEvent('nd:cards'));
      await render();
    });
  });
  on('nd:cards', () => render().catch(() => {}));
}

// ======================================================================
// Liste de souhaits & historique des transactions
// ======================================================================
export async function viewWishlist(el) {
  const d = await api('/fun/wishlist');
  el.innerHTML = `<div class="page-head"><h1>Liste de souhaits</h1><div class="row"><a class="btn sm" href="#/market?wish=1">Voir au marché</a></div></div>
    <p class="muted small">Ajoute une carte avec ♡ sur sa fiche. Tu reçois une notification dès que quelqu'un la met en vente.</p>
    ${d.items.length ? `<div class="cards">${d.items.map((s) => `<div>${cardHtml(s, { missing: !s.owned })}
      <div class="small center" style="margin-top:4px">${s.on_sale ? `<a href="#/market?q=${encodeURIComponent(s.domain)}"><b>${s.on_sale} en vente</b> dès ${fmt(s.best_price)}</a>` : '<span class="muted">pas en vente</span>'}</div></div>`).join('')}</div>`
      : '<div class="panel empty"><b>Liste vide</b>Ouvre la fiche d\'un site et touche ♡.</div>'}`;
  el.addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) openSite(c.dataset.site); });
}

export async function viewHistory(el) {
  const d = await api('/fun/history');
  const sold = d.items.filter((x) => x.sold).reduce((a, x) => a + x.price, 0), bought = d.items.filter((x) => !x.sold).reduce((a, x) => a + x.price, 0);
  el.innerHTML = `<div class="page-head"><h1>Mes transactions</h1></div>
    <div class="quick-grid"><div class="quick"><b>${fmt(sold)}</b><span>Encaissé (avant commission)</span></div><div class="quick"><b>${fmt(bought)}</b><span>Dépensé</span></div></div>
    <div class="panel" style="padding:0;overflow-x:auto;margin-top:12px"><table class="data"><tr><th>Quand</th><th>Carte</th><th></th><th>Avec</th><th style="text-align:right">Prix</th></tr>
    ${d.items.map((x) => `<tr><td class="muted small">${ago(x.at)}</td><td><a href="#" data-site-link="${x.site_id}" class="r-${x.rarity} rtext">${esc(x.domain)}${x.holo ? ' ✦' : ''}</a></td>
      <td><span class="tag ${x.sold ? 'good' : 'accent'}">${x.sold ? 'vendue' : 'achetée'}</span></td><td class="small">${x.other ? `<a href="#/u/${encodeURIComponent(x.other)}">${esc(x.other)}</a>` : '—'}</td>
      <td class="num">${x.sold ? '+' : '−'}${fmt(x.price)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted center" style="padding:20px">Aucune transaction pour l\'instant</td></tr>'}</table></div>`;
  el.addEventListener('click', (e) => { const a = e.target.closest('[data-site-link]'); if (a) { e.preventDefault(); openSite(a.dataset.siteLink); } });
}

// ======================================================================
// Albums par famille & comparaison de collections
// ======================================================================
export async function viewAlbums(el) {
  const d = await api('/fun/albums');
  el.innerHTML = `<div class="page-head"><h1>Albums</h1></div>
    <p class="muted small">Tes cartes rangées par famille (extension du domaine).</p>
    <div class="albums">${d.items.map((a) => `<a class="album r-${a.best}" href="#/collection?family=${encodeURIComponent(a.family)}">
      <img class="fav" src="${favicon(a.top_domain)}" alt="" data-l="${esc(a.family[0])}"><div class="grow"><b>${esc(a.family)}</b>
      <div class="muted small">${fmt(a.n)} site${a.n > 1 ? 's' : ''} · meilleur : <span class="rtext">${esc(a.top_domain)}</span></div></div></a>`).join('') || '<div class="empty">Aucune carte</div>'}</div>`;
}

export async function viewCompare(el, { params }) {
  const d = await api('/fun/compare/' + encodeURIComponent(params.name));
  const grid = (items) => `<div class="cards">${items.map((s) => cardHtml(s)).join('') || '<div class="empty" style="grid-column:1/-1">Rien</div>'}</div>`;
  el.innerHTML = `<div class="page-head"><h1>Toi vs ${esc(d.other)}</h1><div class="row"><a class="btn sm" href="#/u/${encodeURIComponent(d.other)}">Profil</a></div></div>
    <div class="quick-grid"><div class="quick"><b>${fmt(d.mine)}</b><span>Tes sites</span></div><div class="quick"><b>${fmt(d.common)}</b><span>En commun</span></div><div class="quick"><b>${fmt(d.theirs)}</b><span>Ses sites</span></div></div>
    <h2>Ses meilleures cartes que tu n'as pas</h2>${grid(d.theyHave)}
    <h2>Tes meilleures cartes qu'il/elle n'a pas</h2>${grid(d.iHave)}`;
  el.addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) openSite(c.dataset.site); });
}

// ======================================================================
// Éditeur de profil (bio, couleur, vitrine)
// ======================================================================
export function profileEditor(after) {
  const p = state.me.user.profile || {};
  const colors = state.me.config.colors;
  modal('Personnaliser mon profil', `
    <label class="field"><span>Bio (140 caractères)</span><input type="text" maxlength="140" value="${esc(p.bio || '')}" data-bio></label>
    <div class="field"><span class="muted small" style="font-weight:600;text-transform:uppercase;letter-spacing:.05em;font-size:12px">Couleur</span>
      <div class="row" style="margin-top:6px" data-colors>${colors.map((c) => `<button class="swatch${p.color === c ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
    <div class="field"><span class="muted small" style="font-weight:600;text-transform:uppercase;letter-spacing:.05em;font-size:12px">Vitrine (6 cartes max)</span>
      <div class="picker" style="margin-top:6px"><div class="cards mini-cards" data-grid><div class="spinner"></div></div></div></div>
    <button class="btn primary" data-save>Enregistrer</button>`, {
    wide: true,
    async onMount(body, close) {
      let color = p.color || null;
      const show = new Set(p.showcase || []);
      $('[data-colors]', body).addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; $$('[data-c]', body).forEach((x) => x.classList.toggle('on', x === b)); });
      const rows = (await api('/collection?' + new URLSearchParams({ sort: 'rarity', limit: 200 }))).items;
      const grid = $('[data-grid]', body);
      const draw = () => { grid.innerHTML = rows.map((s) => cardHtml(s, { holo: s.holo > 0, selected: show.has(s.id) })).join(''); };
      draw();
      grid.addEventListener('click', (e) => {
        const c = e.target.closest('.card');
        if (!c) return;
        const id = Number(c.dataset.site);
        if (show.has(id)) show.delete(id); else if (show.size < 6) show.add(id); else toast('6 cartes maximum', 'err');
        draw();
      });
      $('[data-save]', body).addEventListener('click', (e) => busy(e.target, async () => {
        await api('/fun/profile', { bio: $('[data-bio]', body).value, ...(color ? { color } : {}), showcase: [...show] });
        toast('Profil mis à jour', 'ok'); close(); await refreshMe(); after?.();
      }));
    },
  });
}

// ======================================================================
// Raccourcis clavier & code secret
// ======================================================================
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
export function initKeys(actions) {
  let seq = [];
  document.addEventListener('keydown', (e) => {
    seq = [...seq, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length);
    if (seq.join() === KONAMI.join() && state.me) {
      seq = [];
      api('/fun/konami', {}).then((r) => {
        if (r.already) toast('Tu connais déjà le secret 😉');
        else { confetti(150); sfx('legend'); toast('Code secret ! +3 boosters', 'ok'); refreshMe(); }
      }).catch(toastErr);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || $('.modal-back, .overlay')) return;
    const fn = actions[e.key.toLowerCase()];
    if (fn) { e.preventDefault(); fn(); }
  });
}
export function shortcutsHelp() {
  modal('Raccourcis clavier', `<dl class="kv">
    <dt>O</dt><dd>Ouvrir un booster</dd><dt>A</dt><dd>Ouvrir tous les boosters</dd><dt>B</dt><dd>Boosters</dd><dt>C</dt><dd>Collection</dd>
    <dt>J</dt><dd>Jeux</dd><dt>M</dt><dd>Marché</dd><dt>S</dt><dd>Social</dd><dt>T</dt><dd>Classement</dd><dt>/</dt><dd>Rechercher un site</dd><dt>?</dt><dd>Cette aide</dd>
  </dl><p class="muted small">Il paraît aussi qu'un vieux code de jeu vidéo marche ici…</p>`);
}
