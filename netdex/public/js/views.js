// Écrans de l'application.
import {
  api, state, refreshMe, setMe, esc, fmt, $, $$, h, duration, ago, isOnline, cardHtml, unknownCardHtml, toast, toastErr,
  modal, confirmDialog, busy, prefs, RARITY, VALUES, ICONS, favicon, siteName, power, now,
} from './core.js';

const rarityChips = (current, withAll = true) =>
  (withAll ? `<button class="chip${current === '' ? ' on' : ''}" data-r="">Toutes</button>` : '') +
  RARITY.map((r) => `<button class="chip r-${r.id}${String(current) === String(r.id) ? ' on' : ''}" data-r="${r.id}">${r.name}</button>`).join('');

const avatarHtml = (domain, name, cls = '') =>
  `<div class="avatar ${cls}">${domain ? `<img class="fav" src="${favicon(domain)}" alt="" data-l="${esc(name[0])}">` : esc(name[0].toUpperCase())}</div>`;

const parseCards = (s) => (s ? String(s).split(',').map((x) => ({ id: parseInt(x, 10), holo: x.endsWith('h') })) : []);

// ======================================================================
// Ouverture de booster
// ======================================================================
export async function openPackFlow(kind = 'free', free = false) {
  let res;
  try { res = await api('/packs/open', { kind, free }); } catch (e) { toastErr(e); return; }
  setMe(res.me);
  const cards = res.cards;
  const fast = prefs.get('fast', false);
  const ov = h(`<div class="overlay">
    <div class="reveal">${cards.map((c, i) => `<div class="flip" data-i="${i}">
        <div class="back r-${c.site.rarity}${c.site.rarity >= 3 ? ' hint' : ''}"></div>
        ${cardHtml(c.site, { holo: c.holo, isNew: c.isNew })}
      </div>`).join('')}</div>
    <div class="reveal-summary"><p class="muted">Touche les cartes pour les retourner</p>
      <div class="row"><button class="btn" data-all>Tout révéler</button></div></div>
  </div>`);
  document.body.append(ov);
  const flips = $$('.flip', ov);
  const done = () => {
    if (!flips.every((f) => f.classList.contains('open'))) return;
    const news = cards.filter((c) => c.isNew).length;
    const val = cards.reduce((a, c) => a + VALUES[c.site.rarity] * (c.holo ? 5 : 1), 0);
    const best = cards.reduce((a, c) => (c.site.rarity > a.site.rarity ? c : a));
    const left = free ? Infinity : state.me.packs.available;
    $('.reveal-summary', ov).innerHTML = `
      <div><b>${news}</b> nouveau${news > 1 ? 'x' : ''} site${news > 1 ? 's' : ''} · valeur <b>${fmt(val)}</b> bits · meilleure : <span class="r-${best.site.rarity} rtext">${RARITY[best.site.rarity].name}</span></div>
      <div class="row">
        ${left > 0 ? `<button class="btn primary big" data-next>Booster suivant${left === Infinity ? '' : ` (${left})`}</button>` : ''}
        <button class="btn${left > 0 ? '' : ' primary big'}" data-close>Fermer</button>
      </div>`;
  };
  const flip = (f) => { if (!f.classList.contains('open')) { f.classList.add('open'); navigator.vibrate?.(cards[f.dataset.i].site.rarity >= 3 ? 40 : 8); done(); } };
  ov.addEventListener('click', (e) => {
    const f = e.target.closest('.flip');
    if (f) { if (f.classList.contains('open')) openSite(f.querySelector('.card').dataset.site); else flip(f); return; }
    if (e.target.closest('[data-all]')) flips.forEach((x, i) => setTimeout(() => flip(x), i * 90));
    if (e.target.closest('[data-next]')) { ov.remove(); openPackFlow(kind === 'premium' && free ? 'premium' : 'free', free); }
    if (e.target.closest('[data-close]')) { ov.remove(); document.dispatchEvent(new CustomEvent('nd:cards')); }
  });
  if (fast) flips.forEach((x, i) => setTimeout(() => flip(x), 150 + i * 70));
}

// ======================================================================
// Fiche d'un site
// ======================================================================
export async function openSite(id) {
  let d;
  try { d = await api('/sites/' + id); } catch (e) { toastErr(e); return; }
  const s = d.site;
  const owned = d.mine.filter((c) => c.status === 'owned');
  const r = RARITY[s.rarity];
  modal(`<span class="r-${s.rarity} rtext">${esc(siteName(s.domain))}</span>`, `
    <div class="site-hero">
      <div>${cardHtml(s, { holo: d.mine.some((c) => c.holo), count: d.mine.length })}</div>
      <dl class="kv">
        <dt>Rang mondial</dt><dd>#${fmt(s.id)}</dd>
        <dt>Rareté</dt><dd class="r-${s.rarity} rtext">${r.name}</dd>
        <dt>Famille</dt><dd>${esc(s.family)}</dd>
        <dt>Puissance</dt><dd>${power(s.id)}</dd>
        <dt>Valeur</dt><dd>${fmt(d.value)} bits</dd>
        <dt>En circulation</dt><dd>${fmt(d.circulation)}${d.holos ? ` (${d.holos} holo)` : ''}</dd>
        <dt>Joueurs</dt><dd>${fmt(d.owners)}</dd>
        <dt>Tu en as</dt><dd>${d.mine.length}${d.mine.length - owned.length ? ` (${d.mine.length - owned.length} en vente)` : ''}</dd>
        ${d.foundAt ? `<dt>Découvert</dt><dd>${ago(d.foundAt)}</dd>` : ''}
      </dl>
    </div>
    <div class="row" style="margin-top:14px">
      <a class="btn sm" href="https://${esc(s.domain)}" target="_blank" rel="noopener noreferrer">Visiter ↗</a>
      ${owned.length ? `<button class="btn sm" data-sell>Vendre aux enchères</button>
        <button class="btn sm" data-recycle>Recycler 1 (+${fmt(d.value * (owned.every((c) => c.holo) ? 5 : 1))})</button>
        <button class="btn sm ghost" data-avatar>Mettre en avatar</button>` : ''}
    </div>
    <div data-form></div>
    ${d.ownerList.length ? `<h2>Qui la possède ?</h2><div class="list">${d.ownerList.map((o) =>
      `<a href="#/u/${encodeURIComponent(o.username)}" data-close><div class="grow">${esc(o.username)}</div><span class="muted">×${o.n}${o.h ? ' ✦' : ''}</span></a>`).join('')}</div>` : ''}
  `, {
    onMount(body, close) {
      $('[data-recycle]', body)?.addEventListener('click', (e) => busy(e.target, async () => {
        const c = owned.find((x) => !x.holo) || owned[0];
        const ok = await confirmDialog('Recycler', `Recycler 1 exemplaire de <b>${esc(s.domain)}</b>${c.holo ? ' (HOLO)' : ''} ?`, 'Recycler', true);
        if (!ok) return;
        const res = await api('/cards/recycle', { cardIds: [c.id] });
        toast(`+${fmt(res.gained)} bits`, 'ok');
        close(); refreshMe(); document.dispatchEvent(new CustomEvent('nd:cards'));
      }));
      $('[data-avatar]', body)?.addEventListener('click', (e) => busy(e.target, async () => {
        await api('/account/avatar', { siteId: s.id }); toast('Avatar mis à jour', 'ok'); refreshMe();
      }));
      $('[data-sell]', body)?.addEventListener('click', () => {
        $('[data-form]', body).innerHTML = auctionForm(owned, s);
        bindAuctionForm($('[data-form]', body), close);
      });
    },
  });
}

function auctionForm(owned, s) {
  const suggested = Math.max(1, VALUES[s.rarity] * 2);
  return `<form class="panel" style="margin-top:14px" data-auction>
    ${owned.length > 1 ? `<label class="field"><span>Exemplaire</span><select name="cardId">${owned.map((c) => `<option value="${c.id}">${c.holo ? 'HOLO ✦' : 'Normal'} #${c.id}</option>`).join('')}</select></label>`
      : `<input type="hidden" name="cardId" value="${owned[0].id}">`}
    <div class="grid-2">
      <label class="field"><span>Prix de départ (bits)</span><input type="number" name="startPrice" min="1" value="${suggested}" required></label>
      <label class="field"><span>Achat immédiat (optionnel)</span><input type="number" name="buyout" min="2" placeholder="—"></label>
    </div>
    <label class="field"><span>Durée</span><select name="hours">${state.me.config.auctionHours.map((x) => `<option value="${x}"${x === 24 ? ' selected' : ''}>${x} h</option>`).join('')}</select></label>
    <p class="muted small">Commission de ${state.me.config.auctionFee * 100} % prélevée à la vente. Annulable tant que personne n'a enchéri.</p>
    <button class="btn primary">Mettre en vente</button>
  </form>`;
}
function bindAuctionForm(root, close) {
  const f = $('[data-auction]', root);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    busy($('button', f), async () => {
      await api('/auctions', { cardId: Number(fd.get('cardId')), startPrice: Number(fd.get('startPrice')), buyout: fd.get('buyout') ? Number(fd.get('buyout')) : null, hours: Number(fd.get('hours')) });
      toast('Carte mise en vente !', 'ok');
      close?.(); document.dispatchEvent(new CustomEvent('nd:cards')); location.hash = '#/market?scope=mine';
    });
  });
}

// ======================================================================
// Accueil : boosters
// ======================================================================
// Fil « En direct » : ce qui se passe dans le jeu (rafraîchi toutes les 10 s tant que la page est ouverte).
function liveFeed(box, on, { limit = 12 } = {}) {
  const line = (e) => {
    const who = `<a href="#/u/${encodeURIComponent(e.who || '')}">${esc(e.who || '?')}</a>`;
    const other = `<a href="#/u/${encodeURIComponent(e.other || '')}">${esc(e.other || '?')}</a>`;
    const card = e.domain ? `<a href="#" data-site-link="${e.site_id}" class="r-${e.rarity} rtext">${esc(e.domain)}</a>${e.holo ? ' <span class="tag accent">holo</span>' : ''}` : '';
    const txt = {
      pull: `${who} a tiré ${card} <span class="muted">· ${RARITY[e.rarity]?.name || ''}</span>`,
      sold: `${who} a acheté ${card} à ${other} pour <b class="mono">${fmt(e.amount)}</b> bits`,
      trade: `${who} et ${other} ont échangé ${e.amount} carte${e.amount > 1 ? 's' : ''}`,
      join: `${who} a rejoint Netdex`,
    }[e.kind] || '';
    return `<div><span class="grow">${txt}</span><span class="muted small mono">${ago(e.at)}</span></div>`;
  };
  const load = async () => {
    const d = await api('/feed');
    box.innerHTML = `<div class="row" style="margin-bottom:6px"><b class="grow">En direct</b>
        <span class="small"><span class="online"></span> <b class="mono">${fmt(d.online)}</b> en ligne · <b class="mono">${fmt(d.auctions)}</b> ventes · <b class="mono">${fmt(d.last_hour)}</b> événements/h</span></div>
      <div class="list small">${d.events.slice(0, limit).map(line).join('') || '<div class="muted">Calme plat pour le moment.</div>'}</div>`;
  };
  box.addEventListener('click', (e) => { const a = e.target.closest('[data-site-link]'); if (a) { e.preventDefault(); openSite(a.dataset.siteLink); } });
  load().catch(() => {});
  const iv = setInterval(() => { if (document.visibilityState === 'visible') load().catch(() => {}); }, 10_000);
  on('nd:leave', () => clearInterval(iv));
}

export async function viewHome(el, { on }) {
  el.innerHTML = `
    <section class="hero" data-hero></section>
    <div class="panel" style="margin-top:12px" data-live></div>
    <div class="quick-grid" style="margin-top:12px" data-quick></div>
    <div class="grid-2" style="margin-top:12px">
      <div class="panel" data-daily></div>
      <div class="panel">
        <div class="row"><div class="grow"><b>Booster Premium</b><div class="muted small">5 cartes Peu commune+, dernière Rare+, 3× plus de holo</div></div>
        <button class="btn violet" data-premium>${fmt(state.me.config.premiumPrice)} bits</button></div>
      </div>
    </div>
    <div class="panel" style="margin-top:12px"><div class="row"><b class="grow">Progression du Netdex</b><a href="#/dex" class="small">Voir le dex →</a></div><div data-tiers><div class="spinner"></div></div></div>
    ${state.me.user.isAdmin ? `<div class="panel" style="margin-top:10px"><b>Admin</b> <span class="muted small">boosters illimités, sans toucher à ton stock</span>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-admin-open="free">Booster gratuit</button><button class="btn" data-admin-open="premium">Premium gratuit</button><a class="btn" href="#/admin">Panneau admin</a></div></div>` : ''}
    <div data-install></div>`;

  const renderHero = () => {
    const p = state.me.packs;
    $('[data-hero]', el).innerHTML = `
      <div class="pack-visual${p.available ? '' : ' empty'}" data-open>
        <div class="pv-top">BOOSTER</div>
        <div><div class="pv-logo">netdex_</div><div class="pv-label">5 sites du web<br>classement mondial</div></div>
        ${p.available ? `<div class="pv-count">${p.available}</div>` : ''}
      </div>
      <div>
        <div class="muted small">${p.nextAt ? 'Prochain booster dans' : 'Stock plein'}</div>
        ${p.nextAt ? `<div class="timer" data-until="${p.nextAt}" data-refresh>${duration(p.nextAt - now())}</div>` : '<div class="timer">MAX</div>'}
        <div class="stock-bar">${Array.from({ length: Math.max(p.cap, p.available) }, (_, i) => `<i class="${i < p.available ? 'on' : ''}"></i>`).join('')}</div>
        <div class="row hero-actions" style="justify-content:center">
          <button class="btn primary big" data-open ${p.available ? '' : 'disabled'}>Ouvrir un booster${p.available > 1 ? ` (${p.available})` : ''}</button>
        </div>
        <p class="muted small" style="margin:12px 0 0">Un booster toutes les 3 min, même app fermée. Stock max ${p.cap}.</p>
      </div>`;
    const d = state.me.daily;
    $('[data-daily]', el).innerHTML = `<div class="row"><div class="grow"><b>Bonus quotidien</b>
      <div class="muted small">${d.available ? `+${d.reward} bits · jour ${Math.min(7, d.streak + 1)}/7 de ta série` : `Prochain dans <span data-until="${d.nextAt}">${duration(d.nextAt - now())}</span>`}</div></div>
      <button class="btn${d.available ? ' primary' : ''}" data-daily-btn ${d.available ? '' : 'disabled'}>${d.available ? 'Récupérer' : 'Récupéré'}</button></div>`;
    const u = state.me.user;
    $('[data-quick]', el).innerHTML = `
      <a class="quick" href="#/collection"><b>${fmt(u.dexCount)}</b><span>Sites découverts</span></a>
      <a class="quick" href="#/top"><b>${fmt(u.dexScore)}</b><span>Score Netdex</span></a>
      <div class="quick"><b>${fmt(u.packsOpened)}</b><span>Boosters ouverts</span></div>
      <a class="quick" href="#/market"><b>${fmt(u.bits)}</b><span>Bits</span></a>`;
  };
  renderHero();
  on('nd:me', renderHero);
  liveFeed($('[data-live]', el), on, { limit: 8 });

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-open]') && state.me.packs.available) openPackFlow('free');
    const adm = e.target.closest('[data-admin-open]');
    if (adm) openPackFlow(adm.dataset.adminOpen, true);
    const prem = e.target.closest('[data-premium]');
    if (prem) busy(prem, async () => {
      if (await confirmDialog('Booster Premium', `Acheter un booster Premium pour <b>${fmt(state.me.config.premiumPrice)}</b> bits ?`, 'Acheter')) await openPackFlow('premium');
    });
    const daily = e.target.closest('[data-daily-btn]');
    if (daily) busy(daily, async () => { const r = await api('/daily', {}); toast(`+${r.reward} bits · série ${r.streak}`, 'ok'); await refreshMe(); });
  });

  const loadTiers = async () => {
    const st = await api('/stats');
    $('[data-tiers]', el).innerHTML = st.tiers.slice().reverse().map((t) => `
      <div class="tier-row r-${t.id}"><span class="rtext">${t.name}</span>
        <div class="progress"><i style="width:${Math.max(t.found ? 1.5 : 0, (t.found / t.total) * 100)}%"></i></div>
        <span class="muted">${fmt(t.found)} / ${fmt(t.total)}</span></div>`).join('') +
      `<p class="muted small" style="margin:8px 0 0">${fmt(st.cards)} cartes · ${fmt(st.distinct)} sites différents en main</p>`;
  };
  loadTiers().catch(toastErr);
  on('nd:cards', () => loadTiers().catch(() => {}));

  if (window.ndInstall?.available() && !prefs.get('installDismissed', false)) {
    $('[data-install]', el).innerHTML = `<div class="panel" style="margin-top:12px"><div class="row"><div class="grow"><b>Installer Netdex</b><div class="muted small">Accès direct depuis l'écran d'accueil</div></div>
      <button class="btn primary" data-inst>Installer</button><button class="btn ghost" data-inst-x>✕</button></div></div>`;
    $('[data-inst]', el).addEventListener('click', () => window.ndInstall.prompt());
    $('[data-inst-x]', el).addEventListener('click', () => { prefs.set('installDismissed', true); $('[data-install]', el).innerHTML = ''; });
  }
}

// ======================================================================
// Collection
// ======================================================================
const collTabs = (on) => `<div class="tabs"><a href="#/collection"${on === 'mine' ? ' class="on"' : ''}>Ma collection</a><a href="#/cards"${on === 'all' ? ' class="on"' : ''}>Toutes les cartes</a><a href="#/dex"${on === 'dex' ? ' class="on"' : ''}>Netdex</a></div>`;

export async function viewCollection(el, { on, query }) {
  const user = query.user && query.user.toLowerCase() !== state.me.user.username.toLowerCase() ? query.user : '';
  const f = { q: '', rarity: '', sort: prefs.get('sort', 'rarity'), dupes: false, holo: false };
  el.innerHTML = `${user ? '' : collTabs('mine')}
    <div class="page-head"><h1>${user ? `Collection de ${esc(user)}` : 'Ma collection'}</h1>
      <div class="row">${user ? `<a class="btn sm" href="#/u/${encodeURIComponent(user)}">Profil</a>` : '<button class="btn sm" data-dupes-recycle>Recycler les doublons</button>'}</div></div>
    <div class="row" style="margin-bottom:10px">
      <input type="search" class="grow" placeholder="Rechercher un site…" data-q style="flex:1;min-width:160px">
      <select data-sort style="width:auto">
        <option value="rarity">Rareté</option><option value="recent">Récentes</option><option value="rank">Rang</option>
        <option value="name">A → Z</option><option value="count">Quantité</option>
      </select>
    </div>
    <div class="chips" data-chips>${rarityChips('')}
      <button class="chip" data-toggle="dupes">Doublons</button><button class="chip" data-toggle="holo">✦ Holo</button></div>
    <div class="cards" style="margin-top:12px" data-grid></div>
    <div class="center" style="margin-top:16px" data-more></div>`;
  $('[data-sort]', el).value = f.sort;
  let offset = 0, seq = 0;
  const grid = $('[data-grid]', el);

  const load = async (append = false) => {
    const my = ++seq;
    if (!append) { offset = 0; grid.innerHTML = '<div class="skeleton"></div>'.repeat(6); }
    const qs = new URLSearchParams({ q: f.q, rarity: f.rarity, sort: f.sort, offset, limit: 120, dupes: f.dupes ? 1 : '', holo: f.holo ? 1 : '' });
    if (user) qs.set('user', user);
    const res = await api('/collection?' + qs);
    if (my !== seq) return;
    const html = res.items.map((s) => cardHtml(s, { count: s.n, holo: s.holo > 0, locked: !s.cards })).join('');
    if (append) grid.insertAdjacentHTML('beforeend', html); else grid.innerHTML = html;
    offset += res.items.length;
    if (!append && !res.items.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>${f.q || f.rarity !== '' || f.dupes || f.holo ? 'Aucun résultat' : 'Collection vide'}</b>${user ? '' : 'Ouvre des boosters pour découvrir des sites !'}</div>`;
    }
    $('[data-more]', el).innerHTML = res.more ? '<button class="btn" data-load-more>Charger plus</button>' : '';
  };

  let t;
  $('[data-q]', el).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value.trim(); load().catch(toastErr); }, 200); });
  $('[data-sort]', el).addEventListener('change', (e) => { f.sort = e.target.value; prefs.set('sort', f.sort); load().catch(toastErr); });
  el.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-r]');
    if (chip) { f.rarity = chip.dataset.r; $$('[data-r]', el).forEach((c) => c.classList.toggle('on', c === chip)); load().catch(toastErr); return; }
    const tog = e.target.closest('[data-toggle]');
    if (tog) { const k = tog.dataset.toggle; f[k] = !f[k]; tog.classList.toggle('on', f[k]); if (f[k]) { const o = k === 'dupes' ? 'holo' : 'dupes'; f[o] = false; $(`[data-toggle=${o}]`, el).classList.remove('on'); } load().catch(toastErr); return; }
    if (e.target.closest('[data-load-more]')) { load(true).catch(toastErr); return; }
    const card = e.target.closest('.card');
    if (card) { openSite(card.dataset.site); return; }
    if (e.target.closest('[data-dupes-recycle]')) recycleDupesDialog(() => load().catch(toastErr));
  });
  on('nd:cards', () => load().catch(() => {}));
  await load();
}

function recycleDupesDialog(after) {
  modal('Recycler les doublons', `
    <p class="muted">Garde toujours au moins un exemplaire de chaque site (et toutes tes cartes holo). Les doublons sont transformés en bits.</p>
    <label class="field"><span>Jusqu'à la rareté</span><select data-max>${RARITY.map((r) => `<option value="${r.id}"${r.id === 2 ? ' selected' : ''}>${r.name} (${VALUES[r.id]} bits/carte)</option>`).join('')}</select></label>
    <button class="btn primary" data-go>Recycler</button>`, {
    onMount(body, close) {
      $('[data-go]', body).addEventListener('click', (e) => busy(e.target, async () => {
        const r = await api('/cards/recycle-duplicates', { maxRarity: Number($('[data-max]', body).value) });
        toast(`${r.count} cartes recyclées · +${fmt(r.gained)} bits`, 'ok');
        close(); refreshMe(); after();
      }));
    },
  });
}

// ======================================================================
// Netdex (pokédex des sites)
// ======================================================================
export async function viewDex(el) {
  const st = await api('/stats');
  let rarity = 5, missing = false, offset = 0;
  el.innerHTML = `${collTabs('dex')}<div class="page-head"><h1>Netdex</h1><div class="row"><button class="chip" data-missing>Seulement manquants</button></div></div>
    <div class="chips" data-tiers>${st.tiers.slice().reverse().map((t) => `<button class="chip r-${t.id}${t.id === rarity ? ' on' : ''}" data-r="${t.id}">${t.name} · ${fmt(t.found)}/${fmt(t.total)}</button>`).join('')}</div>
    <p class="muted small" data-info></p>
    <div class="cards" data-grid></div><div class="center" style="margin-top:16px" data-more></div>`;
  const grid = $('[data-grid]', el);
  const load = async (append) => {
    if (!append) { offset = 0; grid.innerHTML = '<div class="skeleton"></div>'.repeat(6); }
    const t = st.tiers.find((x) => x.id === rarity);
    $('[data-info]', el).textContent = `${t.name} : sites classés #${fmt(t.lo)} à #${fmt(t.hi)} · ${t.chance} % de chance par carte · ${t.value} bits`;
    const res = await api(`/dex?rarity=${rarity}&offset=${offset}${missing ? '&missing=1' : ''}`);
    const html = res.items.map((s) => (s.found_at ? cardHtml(s) : unknownCardHtml(s))).join('');
    if (append) grid.insertAdjacentHTML('beforeend', html); else grid.innerHTML = html || '<div class="empty" style="grid-column:1/-1"><b>Tout découvert !</b></div>';
    offset += res.items.length;
    $('[data-more]', el).innerHTML = res.more ? '<button class="btn" data-load-more>Charger plus</button>' : '';
  };
  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-r]');
    if (c) { rarity = Number(c.dataset.r); $$('[data-r]', el).forEach((x) => x.classList.toggle('on', x === c)); load().catch(toastErr); return; }
    const m = e.target.closest('[data-missing]');
    if (m) { missing = !missing; m.classList.toggle('on', missing); load().catch(toastErr); return; }
    if (e.target.closest('[data-load-more]')) { load(true).catch(toastErr); return; }
    const card = e.target.closest('.card:not(.unknown)');
    if (card) openSite(card.dataset.site);
  });
  await load();
}

// ======================================================================
// Marché aux enchères
// ======================================================================
export async function viewMarket(el, { on, query }) {
  const f = { scope: query.scope || 'all', rarity: '', q: '', sort: 'ending' };
  el.innerHTML = `
    <div class="page-head"><h1>Marché</h1><div class="row"><button class="btn primary sm" data-sell>+ Vendre une carte</button></div></div>
    <div class="panel" style="margin-bottom:14px" data-live></div>
    <div class="tabs" data-tabs><button data-scope="all">Toutes les ventes</button><button data-scope="mine">Mes ventes</button><button data-scope="bids">Mes enchères</button></div>
    <div class="row" style="margin-bottom:10px">
      <input type="search" placeholder="Rechercher…" data-q style="flex:1;min-width:150px">
      <select data-sort style="width:auto"><option value="ending">Fin proche</option><option value="new">Récentes</option><option value="price">Prix ↑</option><option value="rarity">Rareté</option></select>
    </div>
    <div class="chips" style="margin-bottom:12px">${rarityChips('')}</div>
    <div class="auctions" data-list></div>`;
  const list = $('[data-list]', el);
  const setTabs = () => $$('[data-scope]', el).forEach((b) => b.classList.toggle('on', b.dataset.scope === f.scope));
  setTabs();
  liveFeed($('[data-live]', el), on, { limit: 5 });
  let items = [];
  const load = async () => {
    const res = await api('/auctions?' + new URLSearchParams(f));
    items = res.items;
    const me = state.me.user.id;
    list.innerHTML = items.length ? items.map((a) => {
      const open = a.status === 'open' && a.ends_at > now();
      const mineSell = a.seller_id === me, leading = a.bidder_id === me;
      const status = open ? (leading ? '<span class="tag good">Tu mènes</span>' : '') :
        a.status === 'sold' ? `<span class="tag ${leading ? 'good' : ''}">${leading ? 'Gagnée' : 'Vendue'}</span>` :
        a.status === 'expired' ? '<span class="tag">Invendue</span>' : a.status === 'cancelled' ? '<span class="tag">Annulée</span>' : '<span class="tag warn">Clôture…</span>';
      return `<div class="auction" data-id="${a.id}">
        <div>${cardHtml({ id: a.site_id, domain: a.domain, rarity: a.rarity, family: a.family }, { holo: !!a.holo })}</div>
        <div style="min-width:0;display:flex;flex-direction:column;gap:4px">
          <div class="row" style="gap:6px"><b style="overflow:hidden;text-overflow:ellipsis">${esc(a.domain)}</b>${status}</div>
          <div class="meta">par <a href="#/u/${encodeURIComponent(a.seller)}">${esc(a.seller)}</a> · ${a.bid_count} enchère${a.bid_count > 1 ? 's' : ''}${a.bidder ? ` · meilleur : ${esc(a.bidder)}` : ''}</div>
          <div class="price">${fmt(a.current_bid ?? a.start_price)} <span class="muted small">bits${a.current_bid == null ? ' (départ)' : ''}</span></div>
          ${a.buyout ? `<div class="meta">Achat immédiat : <b>${fmt(a.buyout)}</b></div>` : ''}
          <div class="meta">${open ? `Fin dans <b data-until="${a.ends_at}">${duration(a.ends_at - now())}</b>` : `Terminée ${ago(a.ends_at)}`}</div>
          <div class="row" style="gap:6px;margin-top:auto">
            ${open && !mineSell && !leading ? `<button class="btn primary sm" data-bid>Enchérir ${fmt(a.min_bid)}</button>` : ''}
            ${open && !mineSell && a.buyout ? `<button class="btn violet sm" data-buyout>Acheter ${fmt(a.buyout)}</button>` : ''}
            ${open && mineSell && !a.bidder_id ? '<button class="btn sm danger" data-cancel>Annuler</button>' : ''}
          </div>
        </div></div>`;
    }).join('') : `<div class="empty" style="grid-column:1/-1"><b>${f.scope === 'all' ? 'Aucune vente en cours' : 'Rien ici pour le moment'}</b>Mets une carte en vente depuis ta collection.</div>`;
  };

  let t;
  $('[data-q]', el).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value.trim(); load().catch(toastErr); }, 250); });
  $('[data-sort]', el).addEventListener('change', (e) => { f.sort = e.target.value; load().catch(toastErr); });
  el.addEventListener('click', (e) => {
    const sc = e.target.closest('[data-scope]');
    if (sc) { f.scope = sc.dataset.scope; setTabs(); load().catch(toastErr); return; }
    const chip = e.target.closest('[data-r]');
    if (chip) { f.rarity = chip.dataset.r; $$('[data-r]', el).forEach((c) => c.classList.toggle('on', c === chip)); load().catch(toastErr); return; }
    if (e.target.closest('[data-sell]')) { sellPicker(); return; }
    const row = e.target.closest('.auction');
    if (!row) return;
    const a = items.find((x) => x.id === Number(row.dataset.id));
    const btn = e.target.closest('button');
    if (e.target.closest('[data-bid]')) bidDialog(a, load);
    else if (e.target.closest('[data-buyout]')) busy(btn, async () => {
      if (!(await confirmDialog('Achat immédiat', `Acheter <b>${esc(a.domain)}</b> pour <b>${fmt(a.buyout)}</b> bits ?`, 'Acheter'))) return;
      await api(`/auctions/${a.id}/buyout`, {}); toast('Carte achetée !', 'ok'); refreshMe(); load();
    });
    else if (e.target.closest('[data-cancel]')) busy(btn, async () => { await api(`/auctions/${a.id}/cancel`, {}); toast('Vente annulée'); load(); });
    else if (e.target.closest('.card')) openSite(a.site_id);
  });
  on('nd:cards', () => load().catch(() => {}));
  const iv = setInterval(() => { if (document.visibilityState === 'visible') load().catch(() => {}); }, 15000);
  on('nd:leave', () => clearInterval(iv));
  await load();
}

function bidDialog(a, after) {
  modal(`Enchérir sur ${esc(a.domain)}`, `
    <p>Prix actuel : <b>${fmt(a.current_bid ?? a.start_price)}</b> bits · minimum <b>${fmt(a.min_bid)}</b></p>
    <p class="muted small">Tes bits sont bloqués tant que tu mènes et rendus si quelqu'un surenchérit. Une enchère dans la dernière minute prolonge la vente d'une minute.</p>
    <label class="field"><span>Ton enchère (solde : ${fmt(state.me.user.bits)})</span><input type="number" min="${a.min_bid}" value="${a.min_bid}" data-amt></label>
    <button class="btn primary" data-go>Enchérir</button>`, {
    onMount(body, close) {
      $('[data-go]', body).addEventListener('click', (e) => busy(e.target, async () => {
        const r = await api(`/auctions/${a.id}/bid`, { amount: Number($('[data-amt]', body).value) });
        toast(r.bought ? 'Carte achetée !' : 'Enchère placée !', 'ok'); close(); refreshMe(); after();
      }));
    },
  });
}

// Choisir une carte de sa collection pour la vendre.
function sellPicker() {
  modal('Choisir une carte à vendre', `<input type="search" placeholder="Rechercher…" data-q style="margin-bottom:10px">
    <div class="picker"><div class="cards mini-cards" data-grid></div></div><div data-form></div>`, {
    wide: true,
    async onMount(body, close) {
      let rows = [];
      const load = async (q = '') => {
        rows = (await api('/collection?' + new URLSearchParams({ q, sort: 'rarity', limit: 200 }))).items.filter((s) => s.cards);
        $('[data-grid]', body).innerHTML = rows.map((s) => cardHtml(s, { count: parseCards(s.cards).length, holo: s.holo > 0 })).join('') || '<div class="empty">Aucune carte disponible</div>';
      };
      let t;
      $('[data-q]', body).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => load(e.target.value.trim()).catch(toastErr), 200); });
      $('[data-grid]', body).addEventListener('click', (e) => {
        const c = e.target.closest('.card');
        if (!c) return;
        const s = rows.find((x) => x.id === Number(c.dataset.site));
        $$('.card', body).forEach((x) => x.classList.toggle('selected', x === c));
        $('[data-form]', body).innerHTML = auctionForm(parseCards(s.cards), s);
        bindAuctionForm($('[data-form]', body), close);
        $('[data-form]', body).scrollIntoView({ behavior: 'smooth' });
      });
      await load().catch(toastErr);
    },
  });
}

// ======================================================================
// Social : amis + échanges
// ======================================================================
export async function viewSocial(el, { on, query }) {
  let tab = query.tab || 'friends';
  el.innerHTML = `<div class="page-head"><h1>Social</h1></div>
    <div class="tabs"><button data-tab="friends">Amis <span data-c="friendRequests"></span></button><button data-tab="trades">Échanges <span data-c="trades"></span></button></div>
    <div data-body></div>`;
  const counts = () => {
    for (const k of ['friendRequests', 'trades']) {
      const n = state.me.counts[k];
      $(`[data-c=${k}]`, el).innerHTML = n ? `<span class="dot">${n}</span>` : '';
    }
  };
  counts();
  on('nd:me', counts);
  const show = async () => {
    $$('[data-tab]', el).forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const old = $('[data-body]', el);
    const body = old.cloneNode(false); // nouvel élément = pas d'écouteurs accumulés
    old.replaceWith(body);
    body.innerHTML = '<div class="spinner"></div>';
    try { await (tab === 'friends' ? friendsTab(body) : tradesTab(body)); } catch (e) { toastErr(e); }
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b && b.dataset.tab !== tab) { tab = b.dataset.tab; history.replaceState(null, '', '#/social?tab=' + tab); show(); }
  });
  on('nd:social', show);
  await show();
}

async function friendsTab(body) {
  const d = await api('/friends');
  const person = (u, actions) => `<div>${avatarHtml(u.avatar_domain, u.username)}
    <a class="grow" href="#/u/${encodeURIComponent(u.username)}" style="color:var(--text);min-width:0"><b>${esc(u.username)}</b> ${isOnline(u.last_seen) ? '<span class="online"></span>' : ''}
      <div class="muted small">${fmt(u.dex_count)} sites · ${fmt(u.dex_score)} pts</div></a>${actions}</div>`;
  body.innerHTML = `
    <form class="panel" data-add><b>Ajouter un ami</b>
      <div class="row" style="margin-top:8px"><input type="text" name="u" placeholder="Pseudo du joueur" autocomplete="off" style="flex:1" data-search><button class="btn primary">Ajouter</button></div>
      <div class="list" data-sugg></div></form>
    ${d.incoming.length ? `<h2>Demandes reçues</h2><div class="panel list">${d.incoming.map((u) => person(u, `<button class="btn primary sm" data-accept="${u.id}">Accepter</button><button class="btn sm ghost" data-decline="${u.id}">✕</button>`)).join('')}</div>` : ''}
    <h2>Mes amis (${d.friends.length})</h2>
    ${d.friends.length ? `<div class="panel list">${d.friends.map((u) => person(u, `<a class="btn sm" href="#/trade?to=${encodeURIComponent(u.username)}">${ICONS.swap.replace('<svg', '<svg width="16" height="16"')} Échanger</a><button class="btn sm ghost" data-remove="${u.id}" data-name="${esc(u.username)}">✕</button>`)).join('')}</div>`
      : '<div class="panel empty"><b>Pas encore d\'amis</b>Ajoute des joueurs avec leur pseudo pour échanger des cartes.</div>'}
    ${d.outgoing.length ? `<h2>Demandes envoyées</h2><div class="panel list">${d.outgoing.map((u) => person(u, `<button class="btn sm ghost" data-remove="${u.id}">Annuler</button>`)).join('')}</div>` : ''}`;
  const form = $('[data-add]', body);
  let t;
  $('[data-search]', body).addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const q = e.target.value.trim();
      const res = q.length >= 2 ? await api('/users/search?q=' + encodeURIComponent(q)).catch(() => ({ items: [] })) : { items: [] };
      $('[data-sugg]', body).innerHTML = res.items.map((u) => `<a href="#" data-pick="${esc(u.username)}" style="color:var(--text)"><b class="grow">${esc(u.username)}</b><span class="muted small">${fmt(u.dex_count)} sites</span></a>`).join('');
    }, 200);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy($('button', form), async () => {
      const r = await api('/friends/request', { username: form.u.value.trim() });
      toast(r.status === 'friends' ? 'Vous êtes maintenant amis !' : 'Demande envoyée', 'ok');
      document.dispatchEvent(new CustomEvent('nd:social'));
    });
  });
  body.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) { e.preventDefault(); form.u.value = pick.dataset.pick; $('[data-sugg]', body).innerHTML = ''; return; }
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.accept) busy(btn, async () => { await api('/friends/respond', { userId: btn.dataset.accept, accept: true }); toast('Ami ajouté !', 'ok'); refreshMe(); document.dispatchEvent(new CustomEvent('nd:social')); });
    if (btn.dataset.decline) busy(btn, async () => { await api('/friends/respond', { userId: btn.dataset.decline, accept: false }); refreshMe(); document.dispatchEvent(new CustomEvent('nd:social')); });
    if (btn.dataset.remove) busy(btn, async () => {
      if (btn.dataset.name && !(await confirmDialog('Retirer', `Retirer <b>${esc(btn.dataset.name)}</b> de tes amis ?`, 'Retirer', true))) return;
      await api('/friends/remove', { userId: btn.dataset.remove }); document.dispatchEvent(new CustomEvent('nd:social'));
    });
  });
}

const tradeSide = (items, bits) => `<div class="cards mini-cards">${items.map((i) => (i.domain
  ? cardHtml({ id: i.site_id, domain: i.domain, rarity: i.rarity, family: i.family }, { holo: !!i.holo })
  : '<div class="card unknown"><div class="c-art">✕</div><div class="c-name">Disparue</div></div>')).join('')}</div>
  ${bits ? `<div style="margin-top:6px"><span class="pill"><i class="coin"></i>${fmt(bits)}</span></div>` : ''}
  ${!items.length && !bits ? '<span class="muted small">Rien</span>' : ''}`;

async function tradesTab(body) {
  const d = await api('/trades');
  const me = state.me.user.id;
  const label = { accepted: ['good', 'Accepté'], declined: ['bad', 'Refusé'], cancelled: ['', 'Annulé'], invalid: ['warn', 'Invalide'] };
  const render = (t) => {
    const incoming = t.to_id === me;
    const other = incoming ? t.from_name : t.to_name;
    const give = incoming ? t.request : t.offer, get = incoming ? t.offer : t.request;
    const giveBits = incoming ? t.request_bits : t.offer_bits, getBits = incoming ? t.offer_bits : t.request_bits;
    return `<div class="trade" data-id="${t.id}">
      <div class="row"><b class="grow">${incoming ? 'De' : 'Pour'} <a href="#/u/${encodeURIComponent(other)}">${esc(other)}</a></b>
        ${t.status === 'pending' ? `<span class="muted small">${ago(t.created_at)}</span>` : `<span class="tag ${label[t.status][0]}">${label[t.status][1]}</span>`}</div>
      ${t.message ? `<p class="small" style="margin:8px 0 0">« ${esc(t.message)} »</p>` : ''}
      <div class="trade-cols"><div><h4>Tu reçois</h4>${tradeSide(get, getBits)}</div><div><h4>Tu donnes</h4>${tradeSide(give, giveBits)}</div></div>
      ${t.status === 'pending' ? `<div class="row">${incoming
        ? '<button class="btn primary sm" data-act="accept">Accepter</button><button class="btn sm danger" data-act="decline">Refuser</button>'
        : '<button class="btn sm" data-act="cancel">Annuler la proposition</button>'}</div>` : ''}
    </div>`;
  };
  const inc = d.active.filter((t) => t.to_id === me), out = d.active.filter((t) => t.from_id === me);
  body.innerHTML = `<div class="row" style="margin-bottom:6px"><span class="muted grow small">Les échanges se font entre amis.</span><a class="btn primary sm" href="#/social?tab=friends">+ Nouvel échange</a></div>
    <h2>Reçus (${inc.length})</h2>${inc.map(render).join('') || '<div class="panel empty">Aucune proposition reçue</div>'}
    <h2>Envoyés (${out.length})</h2>${out.map(render).join('') || '<div class="panel empty">Aucune proposition en attente</div>'}
    ${d.history.length ? `<h2>Historique</h2>${d.history.map(render).join('')}` : ''}`;
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) {
      const id = b.closest('.trade').dataset.id;
      busy(b, async () => {
        if (b.dataset.act === 'accept' && !(await confirmDialog('Accepter l\'échange', 'Les cartes et bits seront échangés immédiatement.', 'Accepter'))) return;
        try { await api(`/trades/${id}/${b.dataset.act}`, {}); toast(b.dataset.act === 'accept' ? 'Échange réalisé !' : 'Fait', 'ok'); }
        finally { refreshMe(); document.dispatchEvent(new CustomEvent('nd:social')); document.dispatchEvent(new CustomEvent('nd:cards')); }
      });
      return;
    }
    const c = e.target.closest('.card:not(.unknown)');
    if (c) openSite(c.dataset.site);
  });
}

// ======================================================================
// Créateur d'échange
// ======================================================================
export async function viewTrade(el, { query }) {
  const to = query.to;
  const prof = await api('/users/' + encodeURIComponent(to));
  if (prof.relation !== 'friends') { el.innerHTML = '<div class="panel empty"><b>Vous devez être amis</b>Ajoute ce joueur en ami pour échanger.</div>'; return; }
  const sel = { give: new Map(), get: new Map() };
  let side = 'give';
  el.innerHTML = `<div class="page-head"><h1>Échange avec ${esc(prof.username)}</h1></div>
    <div class="panel builder-tray" data-tray></div>
    <div class="tabs" style="margin-top:12px"><button data-side="give">Je donne (ma collection)</button><button data-side="get">Je demande (sa collection)</button></div>
    <input type="search" placeholder="Rechercher…" data-q style="margin-bottom:10px">
    <div class="cards" data-grid></div>`;
  const cfg = state.me.config;
  const tray = () => {
    const mini = (m) => [...m.values()].map((s) => cardHtml(s, { holo: s.pickHolo, attrs: 'data-untray' })).join('');
    $('[data-tray]', el).innerHTML = `
      <div class="trade-cols" style="margin-top:0">
        <div><h4>Je donne (${sel.give.size}/${cfg.maxTradeCards})</h4><div class="cards mini-cards" data-tside="give">${mini(sel.give)}</div>
          <label class="field" style="margin:8px 0 0"><span>+ bits</span><input type="number" min="0" value="${tray.gb || 0}" data-gb></label></div>
        <div><h4>Je demande (${sel.get.size}/${cfg.maxTradeCards})</h4><div class="cards mini-cards" data-tside="get">${mini(sel.get)}</div>
          <label class="field" style="margin:8px 0 0"><span>+ bits</span><input type="number" min="0" value="${tray.rb || 0}" data-rb></label></div>
      </div>
      <input type="text" maxlength="200" placeholder="Message (optionnel)" data-msg value="${esc(tray.msg || '')}">
      <div class="row" style="margin-top:10px"><button class="btn primary" data-send>Envoyer la proposition</button><span class="muted small">Tes bits : ${fmt(state.me.user.bits)}</span></div>`;
  };
  tray();
  const grid = $('[data-grid]', el);
  let rows = [];
  const load = async (q = '') => {
    const qs = new URLSearchParams({ q, sort: 'rarity', limit: 200 });
    if (side === 'get') qs.set('user', prof.username);
    rows = (await api('/collection?' + qs)).items.filter((s) => s.cards);
    $$('[data-side]', el).forEach((b) => b.classList.toggle('on', b.dataset.side === side));
    grid.innerHTML = rows.map((s) => cardHtml(s, { count: parseCards(s.cards).length, holo: s.holo > 0, selected: sel[side].has(s.id) })).join('') || '<div class="empty" style="grid-column:1/-1">Aucune carte disponible</div>';
  };
  let t;
  $('[data-q]', el).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => load(e.target.value.trim()).catch(toastErr), 200); });
  el.addEventListener('input', (e) => {
    if (e.target.matches('[data-gb]')) tray.gb = e.target.value;
    if (e.target.matches('[data-rb]')) tray.rb = e.target.value;
    if (e.target.matches('[data-msg]')) tray.msg = e.target.value;
  });
  el.addEventListener('click', (e) => {
    const sb = e.target.closest('[data-side]');
    if (sb) { side = sb.dataset.side; $('[data-q]', el).value = ''; load().catch(toastErr); return; }
    const untray = e.target.closest('[data-tside] .card');
    if (untray) { sel[untray.parentElement.dataset.tside].delete(Number(untray.dataset.site)); tray(); load($('[data-q]', el).value).catch(() => {}); return; }
    const c = e.target.closest('[data-grid] .card');
    if (c) {
      const s = rows.find((x) => x.id === Number(c.dataset.site));
      const m = sel[side];
      if (m.has(s.id)) m.delete(s.id);
      else {
        if (m.size >= cfg.maxTradeCards) { toast(`Maximum ${cfg.maxTradeCards} cartes`, 'err'); return; }
        const copies = parseCards(s.cards);
        const pick = copies.find((x) => !x.holo) || copies[0];
        m.set(s.id, { ...s, cardId: pick.id, pickHolo: pick.holo });
      }
      c.classList.toggle('selected', m.has(s.id));
      tray();
      return;
    }
    const send = e.target.closest('[data-send]');
    if (send) busy(send, async () => {
      await api('/trades', {
        toUserId: prof.id, offerCards: [...sel.give.values()].map((s) => s.cardId), requestCards: [...sel.get.values()].map((s) => s.cardId),
        offerBits: Number(tray.gb || 0), requestBits: Number(tray.rb || 0), message: tray.msg || '',
      });
      toast('Proposition envoyée !', 'ok');
      location.hash = '#/social?tab=trades';
    });
  });
  await load();
}

// ======================================================================
// Profil
// ======================================================================
export async function viewProfile(el, { params }) {
  const p = await api('/users/' + encodeURIComponent(params.name));
  const rel = {
    self: '<a class="btn sm" href="#/settings">Réglages</a>',
    friends: `<a class="btn primary sm" href="#/trade?to=${encodeURIComponent(p.username)}">Échanger</a>`,
    sent: '<span class="tag">Demande envoyée</span>',
    received: `<button class="btn primary sm" data-accept>Accepter en ami</button>`,
    none: '<button class="btn primary sm" data-add>Ajouter en ami</button>',
  }[p.relation];
  el.innerHTML = `
    <div class="panel"><div class="row" style="gap:16px">
      ${avatarHtml(p.avatarDomain, p.username, 'lg')}
      <div class="grow" style="min-width:0"><h1 style="margin:0">${esc(p.username)} ${isOnline(p.lastSeen) ? '<span class="online"></span>' : ''}</h1>
        <div class="muted small">#${fmt(p.rank)} au classement · inscrit ${ago(p.createdAt)}</div>
        <div class="row" style="margin-top:8px">${rel}<a class="btn sm" href="#/collection?user=${encodeURIComponent(p.username)}">Collection</a></div></div>
    </div></div>
    <div class="quick-grid" style="margin-top:12px">
      <div class="quick"><b>${fmt(p.dexScore)}</b><span>Score</span></div>
      <div class="quick"><b>${fmt(p.dexCount)}</b><span>Sites découverts</span></div>
      <div class="quick"><b>${fmt(p.stats.cards)}</b><span>Cartes</span></div>
      <div class="quick"><b>${fmt(p.packsOpened)}</b><span>Boosters</span></div>
    </div>
    <div class="panel" style="margin-top:12px">${p.stats.tiers.slice().reverse().map((t) => `<div class="tier-row r-${t.id}"><span class="rtext">${t.name}</span>
      <div class="progress"><i style="width:${Math.max(t.found ? 1.5 : 0, (t.found / t.total) * 100)}%"></i></div><span class="muted">${fmt(t.found)}</span></div>`).join('')}</div>
    <h2>Meilleures cartes</h2>
    <div class="cards">${p.best.map((s) => cardHtml(s, { holo: s.holo > 0, count: s.n })).join('') || '<div class="empty" style="grid-column:1/-1">Aucune carte</div>'}</div>`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b?.matches('[data-add]')) busy(b, async () => { await api('/friends/request', { username: p.username }); toast('Demande envoyée', 'ok'); route(); });
    if (b?.matches('[data-accept]')) busy(b, async () => { await api('/friends/respond', { userId: p.id, accept: true }); toast('Ami ajouté !', 'ok'); refreshMe(); route(); });
    const c = e.target.closest('.card');
    if (c) openSite(c.dataset.site);
  });
  const route = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
}

// ======================================================================
// Classement
// ======================================================================
export async function viewTop(el) {
  let by = 'score', scope = 'all';
  el.innerHTML = `<div class="page-head"><h1>Classement</h1></div>
    <div class="tabs"><button data-by="score">Score</button><button data-by="count">Sites</button><button data-by="packs">Boosters</button></div>
    <div class="chips" style="margin-bottom:12px"><button class="chip" data-scope="all">Mondial</button><button class="chip" data-scope="friends">Amis</button></div>
    <div class="panel list" data-list></div>`;
  const load = async () => {
    $$('[data-by]', el).forEach((b) => b.classList.toggle('on', b.dataset.by === by));
    $$('[data-scope]', el).forEach((b) => b.classList.toggle('on', b.dataset.scope === scope));
    const d = await api(`/leaderboard?by=${by}&scope=${scope}`);
    const key = { score: 'dex_score', count: 'dex_count', packs: 'packs_opened' }[by];
    $('[data-list]', el).innerHTML = d.items.map((u, i) => `<a href="#/u/${encodeURIComponent(u.username)}" style="color:var(--text)${u.id === state.me.user.id ? ';background:color-mix(in srgb,var(--accent) 10%,transparent);margin:0 -16px;padding:11px 16px' : ''}">
      <b class="mono" style="width:32px;text-align:right;color:${i < 3 ? 'var(--accent)' : 'var(--muted)'}">${i + 1}</b>${avatarHtml(u.avatar_domain, u.username)}<b class="grow">${esc(u.username)}</b><b class="mono">${fmt(u[key])}</b></a>`).join('') +
      (scope === 'all' ? `<div class="muted small">Ta position : #${fmt(d.myRank)}</div>` : '');
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-by]'); if (b) { by = b.dataset.by; load().catch(toastErr); }
    const s = e.target.closest('[data-scope]'); if (s) { scope = s.dataset.scope; load().catch(toastErr); }
  });
  await load();
}

// ======================================================================
// Recherche dans tout le classement
// ======================================================================
export async function viewSearch(el) {
  el.innerHTML = `<div class="page-head"><h1>Rechercher un site</h1></div>
    <p class="muted">Tape le début d'un nom de domaine pour connaître sa rareté parmi les ${fmt(state.me.config.totalSites)} sites du jeu.</p>
    <input type="search" placeholder="ex : youtube, lemonde, twitch…" data-q autofocus style="margin-bottom:12px">
    <div class="cards" data-grid></div>`;
  let t;
  $('[data-q]', el).addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const q = e.target.value.trim();
      const res = await api('/sites/search?q=' + encodeURIComponent(q)).catch((err) => { toastErr(err); return { items: [] }; });
      $('[data-grid]', el).innerHTML = res.items.map((s) => cardHtml(s, { attrs: s.found_at ? '' : 'style="opacity:.75"' })).join('')
        || (q.length >= 2 ? '<div class="empty" style="grid-column:1/-1"><b>Introuvable</b>Ce site n\'est pas dans le top mondial.</div>' : '');
    }, 220);
  });
  el.addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) openSite(c.dataset.site); });
}

// ======================================================================
// Plus / réglages
// ======================================================================
export async function viewMore(el) {
  const u = state.me.user;
  el.innerHTML = `<h1>Plus</h1>
    <div class="panel list">
      <a href="#/u/${encodeURIComponent(u.username)}" style="color:var(--text)"><b class="grow">Mon profil</b><span class="muted">${esc(u.username)} ›</span></a>
      <a href="#/dex" style="color:var(--text)"><b class="grow">Netdex</b><span class="muted">${fmt(u.dexCount)} sites ›</span></a>
      <a href="#/top" style="color:var(--text)"><b class="grow">Classement</b><span class="muted">›</span></a>
      <a href="#/search" style="color:var(--text)"><b class="grow">Rechercher un site</b><span class="muted">›</span></a>
      <a href="#/settings" style="color:var(--text)"><b class="grow">Réglages & installation</b><span class="muted">›</span></a>
      <a href="#/rules" style="color:var(--text)"><b class="grow">Règles & raretés</b><span class="muted">›</span></a>
      <a href="#/cards" style="color:var(--text)"><b class="grow">Toutes les cartes du jeu</b><span class="muted">›</span></a>
      ${u.isAdmin ? '<a href="#/admin" style="color:var(--text)"><b class="grow">Administration</b><span class="tag accent">admin</span></a>' : ''}
    </div>`;
}

export async function viewRules(el) {
  const st = await api('/stats');
  el.innerHTML = `<h1>Règles</h1>
    <div class="panel">
      <p>Chaque carte est un vrai site d'internet. Plus un site est visité dans le monde, plus sa carte est rare. Le classement vient de la liste <a href="https://tranco-list.eu" target="_blank" rel="noopener">Tranco</a> (top 1 million, agrégée depuis plusieurs mesures de trafic), filtrée des domaines techniques (CDN, DNS, publicité) et des sites adultes.</p>
      <ul>
        <li>1 booster gratuit toutes les <b>3 minutes</b>, même quand l'app est fermée (stock max ${state.me.packs.cap}).</li>
        <li>5 cartes par booster, la 5ᵉ est au moins <b>Peu commune</b>. Les Mythiques sortent environ une fois tous les 10 000 boosters.</li>
        <li>1 % de chance qu'une carte soit <b>HOLO</b> (valeur ×${state.me.config.holoMultiplier}).</li>
        <li>Netdex compte aussi des joueurs automatiques qui ouvrent des boosters, vendent, enchérissent et échangent, avec les mêmes règles que tout le monde.</li>
        <li>Recycle tes doublons en bits, utilise-les aux enchères ou pour des boosters Premium.</li>
        <li>Échanges uniquement entre amis. Enchères ouvertes à tous (commission ${state.me.config.auctionFee * 100} %).</li>
      </ul>
    </div>
    <div class="panel" style="margin-top:12px"><table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr class="muted" style="text-align:left"><th>Rareté</th><th>Sites</th><th>Chance/carte</th><th>Valeur</th></tr>
      ${st.tiers.slice().reverse().map((t) => `<tr class="r-${t.id}" style="border-top:1px solid var(--line)"><td class="rtext" style="padding:8px 0">${t.name}</td><td>${fmt(t.total)}</td><td>${t.chance} %</td><td>${t.value}</td></tr>`).join('')}
    </table></div>`;
}

export async function viewSettings(el, { logout }) {
  const theme = prefs.get('theme', 'dark');
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  el.innerHTML = `<h1>Réglages</h1>
    <div class="panel">
      <b>Installer l'application</b>
      ${standalone ? '<p class="muted">Netdex est installé sur cet appareil ✓</p>'
        : ios ? '<p class="muted">Sur iPhone/iPad : ouvre ce site dans <b>Safari</b>, touche le bouton <b>Partager</b> puis <b>« Sur l\'écran d\'accueil »</b>.</p>'
        : `<p class="muted">Sur Android (Chrome) : menu ⋮ puis <b>« Installer l'application »</b>${window.ndInstall?.available() ? ', ou :' : '.'}</p>${window.ndInstall?.available() ? '<button class="btn primary" data-inst>Installer Netdex</button>' : ''}`}
    </div>
    <div class="panel">
      <b>Affichage</b>
      <div class="row" style="margin-top:10px"><span class="grow">Thème</span><select data-theme-pick style="width:auto"><option value="dark">Sombre</option><option value="light">Clair</option><option value="system">Système</option></select></div>
      <div class="row" style="margin-top:10px"><span class="grow">Ouverture rapide des boosters</span><input type="checkbox" data-fast ${prefs.get('fast', false) ? 'checked' : ''} style="width:22px;height:22px"></div>
    </div>
    <form class="panel" data-pw><b>Changer de mot de passe</b>
      <label class="field" style="margin-top:10px"><span>Actuel</span><input type="password" name="current" autocomplete="current-password" required></label>
      <label class="field"><span>Nouveau (8 caractères min.)</span><input type="password" name="password" autocomplete="new-password" minlength="8" required></label>
      <button class="btn">Mettre à jour</button></form>
    <div class="panel"><button class="btn danger" data-logout>Se déconnecter</button></div>`;
  $('[data-theme-pick]', el).value = theme;
  $('[data-theme-pick]', el).addEventListener('change', (e) => { prefs.set('theme', e.target.value); window.ndApplyTheme(); });
  $('[data-fast]', el).addEventListener('change', (e) => prefs.set('fast', e.target.checked));
  $('[data-inst]', el)?.addEventListener('click', () => window.ndInstall.prompt());
  $('[data-logout]', el).addEventListener('click', logout);
  const f = $('[data-pw]', el);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    busy($('button', f), async () => { await api('/account/password', { current: f.current.value, password: f.password.value }); f.reset(); toast('Mot de passe mis à jour', 'ok'); });
  });
}

export function openNotifications() {
  api('/notifications').then((d) => {
    modal('Notifications', d.items.length ? `<div class="list">${d.items.map((n) => `<a href="${esc(n.link || '#/')}" data-close style="color:var(--text)">
      <span class="grow">${n.read ? '' : '<span class="online" style="background:var(--accent);box-shadow:none"></span> '}${esc(n.text)}</span><span class="muted small">${ago(n.created_at)}</span></a>`).join('')}</div>`
      : '<div class="empty"><b>Rien de neuf</b></div>');
    if (d.items.some((n) => !n.read)) api('/notifications/read', {}).then(refreshMe).catch(() => {});
  }).catch(toastErr);
}

// ======================================================================
// Catalogue : toutes les cartes du jeu
// ======================================================================
export async function viewCatalog(el) {
  const f = { rarity: '', q: '', filter: 'all' };
  let offset = 0, seq = 0;
  el.innerHTML = `${collTabs('all')}
    <div class="page-head"><h1>Toutes les cartes</h1><div class="row"><span class="muted small mono" data-total></span></div></div>
    <div class="row" style="margin-bottom:10px">
      <input type="search" placeholder="Chercher un domaine (ex : twitch, .fr, news)…" data-q style="flex:1;min-width:180px">
      <select data-filter style="width:auto"><option value="all">Toutes</option><option value="owned">Possédées</option><option value="missing">Manquantes</option></select>
    </div>
    <div class="chips" style="margin-bottom:12px">${rarityChips('')}</div>
    <div class="cards" data-grid></div><div class="center" style="margin-top:16px" data-more></div>`;
  const grid = $('[data-grid]', el);
  const load = async (append) => {
    const my = ++seq;
    if (!append) { offset = 0; grid.innerHTML = '<div class="skeleton"></div>'.repeat(6); }
    const res = await api('/catalog?' + new URLSearchParams({ ...f, offset }));
    if (my !== seq) return;
    $('[data-total]', el).textContent = `${fmt(res.total)} cartes au total`;
    const html = res.items.map((s) => cardHtml(s, { count: s.n, missing: !s.n })).join('');
    if (append) grid.insertAdjacentHTML('beforeend', html); else grid.innerHTML = html || '<div class="empty" style="grid-column:1/-1"><b>Aucune carte</b></div>';
    offset += res.items.length;
    $('[data-more]', el).innerHTML = res.more ? '<button class="btn" data-load-more>Charger plus</button>' : '';
  };
  let t;
  $('[data-q]', el).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value.trim(); load().catch(toastErr); }, 250); });
  $('[data-filter]', el).addEventListener('change', (e) => { f.filter = e.target.value; load().catch(toastErr); });
  el.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-r]');
    if (chip) { f.rarity = chip.dataset.r; $$('[data-r]', el).forEach((c) => c.classList.toggle('on', c === chip)); load().catch(toastErr); return; }
    if (e.target.closest('[data-load-more]')) { load(true).catch(toastErr); return; }
    const c = e.target.closest('.card');
    if (c) openSite(c.dataset.site);
  });
  await load();
}

// ======================================================================
// Administration
// ======================================================================
export async function viewAdmin(el) {
  if (!state.me.user.isAdmin) { el.innerHTML = '<div class="empty"><b>Accès réservé</b></div>'; return; }
  el.innerHTML = `<div class="page-head"><h1>Administration</h1><div class="row"><button class="btn primary sm" data-open-free>Booster gratuit</button><button class="btn sm" data-open-prem>Premium gratuit</button></div></div>
    <div data-overview><div class="spinner"></div></div>
    <h2>Offrir</h2>
    <form class="panel" data-give>
      <div class="grid-2">
        <label class="field"><span>Joueur</span><input type="text" name="username" placeholder="pseudo" autocomplete="off" list="adm-users"></label>
        <label class="field" style="display:flex;align-items:end;gap:8px"><input type="checkbox" name="everyone" style="width:18px;height:18px"> Tous les joueurs (humains)</label>
        <label class="field"><span>Bits (négatif pour retirer)</span><input type="number" name="bits" value="0"></label>
        <label class="field"><span>Boosters</span><input type="number" name="packs" value="0" min="0"></label>
        <label class="field"><span>Carte (domaine)</span><input type="text" name="domain" placeholder="ex : google.com" autocomplete="off" list="adm-sites"></label>
        <div class="row"><label class="field" style="flex:1"><span>Exemplaires</span><input type="number" name="count" value="1" min="1" max="100"></label>
          <label class="row" style="margin-top:6px"><input type="checkbox" name="holo" style="width:18px;height:18px"> Holo</label></div>
      </div>
      <datalist id="adm-users"></datalist><datalist id="adm-sites"></datalist>
      <button class="btn primary">Envoyer</button>
    </form>
    <h2>Joueurs</h2>
    <div class="row" style="margin-bottom:10px"><input type="search" placeholder="Rechercher un pseudo…" data-uq style="flex:1">
      <select data-kind style="width:auto"><option value="humans">Humains</option><option value="bots">Bots</option><option value="all">Tous</option></select></div>
    <div class="panel" style="padding:0;overflow-x:auto"><table class="data" data-users></table></div>`;

  const overview = async () => {
    const d = await api('/admin/overview');
    const b = d.bots;
    $('[data-overview]', el).innerHTML = `
      <div class="quick-grid">
        <div class="quick"><b>${fmt(d.counts.humans)}</b><span>Joueurs humains</span></div>
        <div class="quick"><b>${fmt(d.counts.bots)}</b><span>Bots (${fmt(b.active)} actifs/h)</span></div>
        <div class="quick"><b>${fmt(d.counts.cards)}</b><span>Cartes en jeu</span></div>
        <div class="quick"><b>${fmt(d.counts.auctions)}</b><span>Ventes ouvertes</span></div>
        <div class="quick"><b>${b.dbMb} / ${d.dbLimitMb} Mo</b><span>Base de données</span></div>
      </div>
      <div class="panel" style="margin-top:10px"><div class="row">
        <div class="grow"><b>Bots</b> <span class="tag ${b.paused ? 'warn' : 'good'}">${b.paused ? 'en pause' : 'actifs'}</span>
          <div class="muted small">${fmt(b.due)} en attente · dernière passe ${b.lastTick ? ago(b.lastTick) : 'jamais'}${b.dbMb >= d.dbLimitMb ? ' · base presque pleine : ils n\'ouvrent plus de boosters' : ''}</div></div>
        ${Number(d.counts.bots) ? '' : '<button class="btn primary sm" data-seed>Créer 10 000 bots</button>'}
        <button class="btn sm" data-tick>Lancer une passe</button>
        <button class="btn sm" data-pause="${b.paused ? 0 : 1}">${b.paused ? 'Reprendre' : 'Mettre en pause'}</button>
        ${Number(d.counts.bots) ? '<button class="btn sm danger" data-del-bots>Supprimer les bots</button>' : ''}
      </div></div>`;
  };
  const users = async () => {
    const d = await api('/admin/users?' + new URLSearchParams({ q: $('[data-uq]', el).value.trim(), kind: $('[data-kind]', el).value }));
    $('[data-users]', el).innerHTML = `<tr><th>Pseudo</th><th>Bits</th><th>Sites</th><th>Boosters</th><th>Vu</th><th></th></tr>` + d.items.map((u) => `<tr data-id="${u.id}" data-name="${esc(u.username)}">
      <td><a href="#/u/${encodeURIComponent(u.username)}">${esc(u.username)}</a> ${u.is_bot ? '<span class="tag">bot</span>' : ''} ${u.is_admin ? '<span class="tag accent">admin</span>' : ''}</td>
      <td class="num">${fmt(u.bits)}</td><td class="num">${fmt(u.dex_count)}</td><td class="num">${fmt(u.packs_opened)}</td><td class="muted small">${ago(u.last_seen)}</td>
      <td style="white-space:nowrap"><button class="btn sm" data-pick>Choisir</button> <button class="btn sm" data-toggle-admin="${u.is_admin ? 0 : 1}">${u.is_admin ? '− admin' : '+ admin'}</button> <button class="btn sm danger" data-del>Supprimer</button></td></tr>`).join('');
    $('#adm-users').innerHTML = d.items.map((u) => `<option value="${esc(u.username)}">`).join('');
  };
  await Promise.all([overview(), users()]).catch(toastErr);

  let t;
  $('[data-uq]', el).addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => users().catch(toastErr), 200); });
  $('[data-kind]', el).addEventListener('change', () => users().catch(toastErr));
  const form = $('[data-give]', el);
  form.domain.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const r = await api('/sites/search?q=' + encodeURIComponent(form.domain.value)).catch(() => ({ items: [] }));
      $('#adm-sites').innerHTML = r.items.map((s) => `<option value="${esc(s.domain)}">${RARITY[s.rarity].name} #${s.id}</option>`).join('');
    }, 200);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy($('button', form), async () => {
      const body = { username: form.username.value.trim(), everyone: form.everyone.checked, bits: Number(form.bits.value), packs: Number(form.packs.value),
        domain: form.domain.value.trim() || undefined, count: Number(form.count.value), holo: form.holo.checked };
      const r = await api('/admin/give', body);
      toast(`Envoyé à ${r.targets} joueur${r.targets > 1 ? 's' : ''}`, 'ok');
      refreshMe(); overview();
    });
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-open-free]')) return openPackFlow('free', true);
    if (b.matches('[data-open-prem]')) return openPackFlow('premium', true);
    if (b.matches('[data-seed]')) return busy(b, async () => { toast('Création des bots… (≈ 1 min)'); const r = await api('/admin/bots/seed', { count: 10000 }); toast(`${fmt(r.created)} bots créés`, 'ok'); overview(); });
    if (b.matches('[data-tick]')) return busy(b, async () => { const r = await api('/admin/bots/tick', {}); toast(`${r ? r.sessions : 0} sessions de bots jouées`, 'ok'); overview(); });
    if (b.matches('[data-pause]')) return busy(b, async () => { await api('/admin/bots/pause', { paused: b.dataset.pause === '1' }); overview(); });
    if (b.matches('[data-del-bots]')) return busy(b, async () => { if (await confirmDialog('Supprimer les bots', 'Tous les bots et leurs cartes seront supprimés.', 'Supprimer', true)) { await api('/admin/bots/delete', {}); overview(); users(); } });
    const row = b.closest('tr');
    if (!row) return;
    if (b.matches('[data-pick]')) { form.username.value = row.dataset.name; form.everyone.checked = false; form.scrollIntoView({ behavior: 'smooth' }); }
    if (b.matches('[data-toggle-admin]')) busy(b, async () => { await api(`/admin/user/${row.dataset.id}/admin`, { value: b.dataset.toggleAdmin === '1' }); users(); });
    if (b.matches('[data-del]')) busy(b, async () => {
      if (await confirmDialog('Supprimer le compte', `Supprimer définitivement <b>${esc(row.dataset.name)}</b> et toutes ses cartes ?`, 'Supprimer', true)) { await api(`/admin/user/${row.dataset.id}/delete`, {}); users(); overview(); }
    });
  });
}
