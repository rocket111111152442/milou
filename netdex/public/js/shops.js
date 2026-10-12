// Boosters scellés, boutiques d'échange, prêts et parts de boutiques (bourse).
import { api, state, refreshMe, setMe, esc, fmt, $, $$, h, ago, toast, toastErr, modal, confirmDialog, busy, RARITY, sfx } from './core.js';
import { openPackFlow } from './views.js';

const QUAL = { terne: 'Terne', standard: 'Standard', chanceux: 'Chanceux', brillant: 'Brillant', prestige: 'Prestige' };
const pct = (v) => (v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v >= 0.1 ? v.toFixed(2) : v.toPrecision(2)).replace('.', ',') + ' %';
export const oddsHtml = (o) => `<div class="odds">${[5, 4, 3, 2].map((r) => `<div class="r-${r}"><span class="rtext">${RARITY[r].name}${r < 5 ? '+' : ''}</span><b class="mono">${pct(o[r])}</b></div>`).join('')}</div>`;
const marketTabs = (on) => `<div class="tabs"><a href="#/market"${on === 'auctions' ? ' class="on"' : ''}>Enchères</a><a href="#/shops"${on === 'shops' ? ' class="on"' : ''}>Boutiques</a><a href="#/bourse"${on === 'bourse' ? ' class="on"' : ''}>Bourse</a><a href="#/loans"${on === 'loans' ? ' class="on"' : ''}>Mes prêts</a></div>`;
export { marketTabs };

export function packCardHtml(p, actions = '') {
  return `<div class="sealed q-${p.quality}" data-pack="${p.id}">
    <div class="sealed-top"><span class="q-badge">${esc(p.qualityName || QUAL[p.quality])}</span>${p.boost > 1 ? `<span class="mono small">×${String(p.boost).replace('.', ',')}</span>` : ''}</div>
    <div class="sealed-logo">netdex_</div>
    ${oddsHtml(p.odds)}
    ${actions}
  </div>`;
}

// ======================================================================
// Boosters scellés (accueil)
// ======================================================================
export async function sealedSection(el) {
  const draw = async () => {
    const d = await api('/packs/sealed');
    el.innerHTML = `<div class="row" style="margin-bottom:8px"><b class="grow">Mes boosters scellés <span class="muted small">${d.items.length}/${d.max}</span></b>
      <button class="btn sm" data-seal ${state.me.packs.available ? '' : 'disabled'}>Garder un booster scellé</button></div>
      <p class="muted small" style="margin:0 0 10px">Garde ton prochain booster fermé avec sa qualité et ses chances : ouvre-le plus tard ou revends-le dans une boutique d'échange.</p>
      ${d.items.length ? `<div class="sealed-grid">${d.items.map((p) => packCardHtml(p, p.listing
        ? `<div class="small muted">En vente ${fmt(p.listing.price)} bits chez <a href="#/shop/${p.listing.shopId}">${esc(p.listing.shopName)}</a></div>`
        : `<div class="row" style="gap:6px"><button class="btn primary sm" data-open-sealed="${p.id}">Ouvrir</button><button class="btn sm" data-sell-sealed="${p.id}">Vendre</button></div>`)).join('')}</div>`
        : '<div class="muted small">Aucun booster scellé.</div>'}`;
  };
  await draw();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-seal]')) busy(b, async () => {
      const r = await api('/packs/seal', {});
      setMe(r.me); sfx(r.pack.quality === 'standard' ? 'pop' : r.pack.quality === 'prestige' ? 'legend' : 'rare');
      toast(`Booster ${r.pack.qualityName} gardé scellé !`, 'ok'); await draw();
    });
    if (b.dataset.openSealed) busy(b, async () => {
      const r = await api(`/packs/sealed/${b.dataset.openSealed}/open`, {});
      await openPackFlow('free', false, r); await draw();
    });
    if (b.dataset.sellSealed) sellSealedDialog(Number(b.dataset.sellSealed), draw);
  });
}

async function sellSealedDialog(packId, after) {
  const [d, mine] = await Promise.all([api('/shops'), api('/packs/sealed')]);
  const p = mine.items.find((x) => x.id === packId);
  const ok = d.items.filter((s) => s.isOpen && s.accepts.includes(p.quality));
  modal('Vendre en boutique', `${packCardHtml(p)}
    ${ok.length ? `<label class="field" style="margin-top:12px"><span>Boutique</span><select data-shop>${ok.map((s) => `<option value="${s.id}">${esc(s.name)} — commission ${String(s.feePct).replace('.', ',')} %${s.listingFee ? ` + ${s.listingFee} bits de dépôt` : ''} · ${s.listings} en vente</option>`).join('')}</select></label>
      <label class="field"><span>Prix (bits)</span><input type="number" min="1" value="${Math.max(10, Math.round(30 * p.boost))}" data-price></label>
      <p class="muted small" data-net></p><button class="btn primary" data-go>Mettre en vente</button>`
      : '<div class="empty"><b>Aucune boutique n\'accepte cette qualité</b>Crée la tienne dans Marché › Boutiques.</div>'}`, {
    onMount(body, close) {
      if (!ok.length) return;
      const net = () => {
        const s = ok.find((x) => x.id === Number($('[data-shop]', body).value));
        const price = Number($('[data-price]', body).value) || 0;
        const limits = [s.minPrice ? `prix minimum ${fmt(s.minPrice)}` : '', s.maxPrice ? `prix maximum ${fmt(s.maxPrice)}` : ''].filter(Boolean).join(' · ');
        $('[data-net]', body).textContent = `Tu toucheras ${fmt(price - Math.floor((price * s.feePct) / 100))} bits si le booster se vend${s.listingFee ? ` (frais de dépôt de ${fmt(s.listingFee)} bits payés maintenant)` : ''}.${limits ? ` Cette boutique impose : ${limits}.` : ''}`;
      };
      body.addEventListener('input', net); net();
      $('[data-go]', body).addEventListener('click', (e) => busy(e.target, async () => {
        await api(`/shops/${$('[data-shop]', body).value}/list`, { packId, price: Number($('[data-price]', body).value) });
        toast('Booster mis en vente', 'ok'); close(); after();
      }));
    },
  });
}

// ======================================================================
// Liste des boutiques
// ======================================================================
export async function viewShops(el) {
  const d = await api('/shops');
  const mine = d.items.filter((s) => s.ownerId === state.me.user.id);
  el.innerHTML = `${marketTabs('shops')}
    <div class="page-head"><h1>Boutiques d'échange</h1><div class="row"><button class="btn primary sm" data-create>Ouvrir ma boutique (dès ${fmt(d.price)} bits)</button></div></div>
    <p class="muted small">Chaque boutique prend une commission sur les boosters scellés vendus chez elle. Son coffre sert à prêter aux joueurs et à verser des dividendes à ceux qui ont acheté des parts.</p>
    ${mine.length ? `<h2>Mes boutiques</h2><div class="shop-grid">${mine.map(shopCard).join('')}</div>` : ''}
    <h2>Toutes les boutiques (${d.items.length})</h2>
    ${d.items.length ? `<div class="shop-grid">${d.items.map(shopCard).join('')}</div>` : '<div class="panel empty"><b>Aucune boutique pour l\'instant</b>Sois le premier à en ouvrir une.</div>'}`;
  $('[data-create]', el).addEventListener('click', () => createShopDialog(d.tiers, d.colors));
}

const num = (v) => String(v).replace('.', ',');
const shopTitle = (s) => `${s.emoji ? `<span class="shop-emoji">${esc(s.emoji)}</span> ` : ''}${esc(s.name)}`;
const shopCard = (s) => `<a class="shop-card" href="#/shop/${s.id}"${s.color ? ` style="border-top:3px solid ${s.color}"` : ''}>
  <div class="row"><b class="grow">${shopTitle(s)}</b>${!s.isOpen ? '<span class="tag bad">Fermée</span>' : ''}${s.tier === 'premium' ? '<span class="tag premium">Premium</span>' : ''}<span class="tag">${num(s.feePct)} %</span></div>
  <div class="muted small">par ${esc(s.owner)} · ${s.listings} booster${s.listings > 1 ? 's' : ''} en vente · ${fmt(s.salesCount)} ventes</div>
  ${s.description ? `<p class="small" style="margin:6px 0 0">${esc(s.description.slice(0, 120))}</p>` : ''}
  <div class="row small" style="margin-top:8px;gap:6px">${s.accepts.map((q) => `<span class="q-chip q-${q}">${QUAL[q]}</span>`).join('')}</div>
  <div class="row small mono" style="margin-top:8px"><span class="grow">Coffre ${fmt(s.balance)}</span><span>Part ${fmt(s.sharePrice)} · ${s.sharesLeft} dispo</span></div>
</a>`;

function createShopDialog(tiers, colors) {
  let tier = 'standard';
  modal('Ouvrir une boutique', `<p class="muted small" style="margin-top:0">Ton solde : ${fmt(state.me.user.bits)} bits. Tous les réglages restent modifiables ensuite.</p>
    <div class="tier-pick">
      <button type="button" class="tier-opt on" data-tier="standard"><b>Standard</b><span class="mono">${fmt(tiers.standard.price)} bits</span><span>Commission jusqu'à ${tiers.standard.maxFee} %</span></button>
      <button type="button" class="tier-opt premium" data-tier="premium"><b>Premium</b><span class="mono">${fmt(tiers.premium.price)} bits</span><span>Commission jusqu'à ${tiers.premium.maxFee} %</span><span>Boosters achetés chez toi : chances +${Math.round((tiers.premium.packBonus - 1) * 100)} %</span></button>
    </div>
    ${settingsForm(DEFAULTS, colors, tiers.standard.maxFee)}
    <button class="btn primary" data-go>Ouvrir pour ${fmt(tiers.standard.price)} bits</button>`, {
    onMount(body, close) {
      wireSettings(body);
      body.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tier]');
        if (!t) return;
        tier = t.dataset.tier;
        $$('[data-tier]', body).forEach((x) => x.classList.toggle('on', x === t));
        $('[name=feePct]', body).max = tiers[tier].maxFee;
        $('[data-fee-label]', body).textContent = `Commission sur chaque vente (0–${tiers[tier].maxFee} %)`;
        $('[data-go]', body).textContent = `Ouvrir pour ${fmt(tiers[tier].price)} bits`;
      });
      $('[data-go]', body).addEventListener('click', (e) => busy(e.target, async () => {
        const r = await api('/shops', { ...readSettings(body), tier });
        toast('Boutique ouverte !', 'ok'); sfx('legend'); close(); await refreshMe(); location.hash = '#/shop/' + r.id;
      }));
    },
  });
}

const DEFAULTS = { transferFee: 0, name: '', description: '', emoji: '', color: '', isOpen: true, feePct: 5, listingFee: 0, minPrice: 0, maxPrice: 0, sellerMax: 0, holderDiscount: 0,
  accepts: Object.keys(QUAL), sharePrice: 10, sharesMax: 1000, maxPerPlayer: 1000, buybackPct: 0, divMode: 'coffre', divPct: 0,
  loanRate: 10, loanDaily: 0, loanFee: 0, loanLate: 0, loanMin: 1, loanMax: 1000, loanMinDays: 1, loanMaxDays: 14, loanAuto: 0 };

const field = (name, label, v, attrs = '', help = '') => `<label class="field"><span>${label}</span><input type="number" name="${name}" value="${v}" ${attrs}>${help ? `<small class="muted">${help}</small>` : ''}</label>`;
const section = (title, desc, body, open = false) => `<details class="settings-sec"${open ? ' open' : ''}><summary><b>${title}</b><span class="muted small">${desc}</span></summary><div class="settings-body">${body}</div></details>`;

const settingsForm = (s, colors, maxFee = s.maxFee || 25) => `
${section('Général', 'nom, description, apparence, ouverture', `
  <div class="grid-2">
    <label class="field"><span>Nom</span><input type="text" name="name" maxlength="30" value="${esc(s.name)}"></label>
    <label class="field"><span>Emoji (facultatif)</span><input type="text" name="emoji" maxlength="8" value="${esc(s.emoji || '')}" placeholder="🏪"></label>
  </div>
  <label class="field"><span>Description</span><input type="text" name="description" maxlength="280" value="${esc(s.description)}"></label>
  <div class="field"><span class="field-label">Couleur</span><div class="row color-pick" style="gap:6px;margin-top:6px">
    <label><input type="radio" name="color" value="" ${!s.color ? 'checked' : ''}><i style="background:var(--surface-2)">∅</i></label>
    ${colors.map((c) => `<label><input type="radio" name="color" value="${c}" ${s.color === c ? 'checked' : ''}><i style="background:${c}"></i></label>`).join('')}</div></div>
  <label class="row small" style="gap:6px"><input type="checkbox" name="isOpen" ${s.isOpen !== false ? 'checked' : ''}> Boutique ouverte (décoche pour suspendre ventes, prêts et achats de parts)</label>`, true)}
${section('Ventes de boosters', 'commission, frais, prix, qualités', `
  <div class="grid-2">
    <label class="field"><span data-fee-label>Commission sur chaque vente (0–${maxFee} %)</span><input type="number" name="feePct" min="0" max="${maxFee}" step="0.5" value="${s.feePct}"></label>
    ${field('listingFee', 'Frais de dépôt par booster (bits)', s.listingFee, 'min="0"', 'Payés par le vendeur à la mise en vente, même si le booster ne se vend pas.')}
    ${field('minPrice', 'Prix minimum d\'un booster (0 = libre)', s.minPrice, 'min="0"')}
    ${field('maxPrice', 'Prix maximum d\'un booster (0 = libre)', s.maxPrice, 'min="0"')}
    ${field('sellerMax', 'Boosters en vente par vendeur (0 = 20)', s.sellerMax, 'min="0" max="20"')}
    ${field('holderDiscount', 'Réduction de commission pour tes actionnaires (%)', s.holderDiscount, 'min="0" max="100" step="5"', '50 % = ils paient moitié moins de commission.')}
  </div>
  <div class="field"><span class="field-label">Qualités de boosters acceptées</span>
    <div class="row" style="margin-top:6px">${Object.entries(QUAL).map(([k, v]) => `<label class="row small" style="gap:4px"><input type="checkbox" name="accepts" value="${k}" ${s.accepts.includes(k) ? 'checked' : ''}> ${v}</label>`).join('')}</div></div>`)}
${section('Parts (bourse)', 'prix, nombre, dividendes, rachat', `
  <div class="grid-2">
    ${field('sharePrice', 'Prix d\'une part (bits)', s.sharePrice, 'min="1"', 'Ce que paie un joueur par part. Tout va dans le coffre.')}
    ${field('sharesMax', 'Parts mises en vente (sur 1 000)', s.sharesMax, 'min="0" max="1000"')}
    ${field('maxPerPlayer', 'Parts maximum par joueur', s.maxPerPlayer, 'min="1" max="1000"')}
    ${field('buybackPct', 'Rachat des parts (% du prix, 0 = jamais)', s.buybackPct, 'min="0" max="100" step="5"', 'Si 80 % : un joueur peut revendre une part 10 bits à la boutique pour 8 bits.')}
    ${field('transferFee', 'Taxe sur les reventes entre joueurs (%)', s.transferFee || 0, 'min="0" max="20" step="0.5"', 'Prélevée sur le prix quand un joueur vend ses parts à un autre ; elle va dans le coffre.')}
  </div>
  <div class="grid-2">
    <label class="field"><span>Dividendes</span><select name="divMode">
      <option value="coffre" ${s.divMode !== 'fixe' ? 'selected' : ''}>Un % du coffre, partagé entre les parts</option>
      <option value="fixe" ${s.divMode === 'fixe' ? 'selected' : ''}>Un % fixe du prix de chaque part</option></select></label>
    ${field('divPct', 'Pourcentage versé chaque jour', s.divPct, 'min="0" max="50" step="0.1"')}
  </div>
  <p class="muted small" data-div-help style="margin:0"></p>`)}
${section('Prêts', 'intérêts selon la durée, frais, retard', `
  <div class="grid-2">
    ${field('loanRate', 'Intérêts de base (%)', s.loanRate, 'min="0" max="200" step="0.5"')}
    ${field('loanDaily', 'Intérêts en plus par jour de durée (%)', s.loanDaily, 'min="0" max="20" step="0.1"', 'Plus le prêt est long, plus il coûte.')}
    ${field('loanFee', 'Frais de dossier (bits)', s.loanFee, 'min="0"')}
    ${field('loanLate', 'Pénalité de retard (% du reste, par jour)', s.loanLate, 'min="0" max="20" step="0.5"')}
    ${field('loanMin', 'Prêt minimum (bits)', s.loanMin, 'min="1"')}
    ${field('loanMax', 'Prêt maximum (bits, 0 = pas de prêts)', s.loanMax, 'min="0"')}
    ${field('loanMinDays', 'Durée minimum (jours)', s.loanMinDays, 'min="1" max="30"')}
    ${field('loanMaxDays', 'Durée maximum (jours)', s.loanMaxDays, 'min="1" max="30"')}
    ${field('loanAuto', 'Accepter automatiquement jusqu\'à (bits, 0 = jamais)', s.loanAuto, 'min="0"', 'Seulement pour les joueurs sans impayé.')}
  </div>
  <p class="muted small" data-loan-help style="margin:0"></p>`)}`;

const readSettings = (root) => {
  const n = (k) => Number($(`[name=${k}]`, root).value);
  return {
    name: $('[name=name]', root).value, description: $('[name=description]', root).value, emoji: $('[name=emoji]', root).value,
    color: $('[name=color]:checked', root)?.value || '', isOpen: $('[name=isOpen]', root).checked,
    accepts: $$('[name=accepts]:checked', root).map((x) => x.value), divMode: $('[name=divMode]', root).value,
    ...Object.fromEntries(['feePct', 'listingFee', 'minPrice', 'maxPrice', 'sellerMax', 'holderDiscount', 'sharePrice', 'sharesMax', 'maxPerPlayer', 'buybackPct', 'transferFee', 'divPct',
      'loanRate', 'loanDaily', 'loanFee', 'loanLate', 'loanMin', 'loanMax', 'loanMinDays', 'loanMaxDays', 'loanAuto'].map((k) => [k, n(k)])),
  };
};
// Exemples calculés en direct sous les réglages de parts et de prêts.
function wireSettings(root, balance = 0) {
  const upd = () => {
    const s = readSettings(root);
    const per = s.divMode === 'fixe' ? (s.sharePrice * s.divPct) / 100 : (balance * s.divPct) / 100 / 1000;
    $('[data-div-help]', root).textContent = s.divMode === 'fixe'
      ? `Chaque part rapporte ${num(+per.toFixed(3))} bit par jour (${num(s.divPct)} % de ${s.sharePrice}). 10 parts = ${num(+(per * 10).toFixed(2))} bits/jour, payés par le coffre.`
      : `Chaque jour, ${num(s.divPct)} % du coffre est partagé entre les 1 000 parts${balance ? ` : aujourd'hui ${num(+per.toFixed(3))} bit par part` : ''}. Les parts non vendues restent à la boutique.`;
    const due = (a, d) => Math.ceil(a * (1 + (s.loanRate + s.loanDaily * d) / 100)) + s.loanFee;
    $('[data-loan-help]', root).textContent = `Exemple pour 1 000 bits : ${s.loanMinDays} j → ${fmt(due(1000, s.loanMinDays))} à rembourser · ${s.loanMaxDays} j → ${fmt(due(1000, s.loanMaxDays))}.`;
  };
  root.addEventListener('input', upd); root.addEventListener('change', upd); upd();
}

// ======================================================================
// Une boutique
// ======================================================================
export async function viewShop(el, { params }) {
  const render = async () => {
    const d = await api('/shops/' + params.id);
    const s = d.shop;
    const dayOpts = [];
    for (let n = s.loanMinDays; n <= s.loanMaxDays; n++) dayOpts.push(n);
    el.innerHTML = `${marketTabs('shops')}
      <div class="page-head"><h1>${shopTitle(s)}</h1>${!s.isOpen ? '<span class="tag bad">Fermée</span>' : ''}${s.tier === 'premium' ? '<span class="tag premium">Premium</span>' : ''}<div class="row"><a class="btn sm" href="#/bourse/${s.id}">Parts à ${fmt(s.sharePrice)}</a></div></div>
      ${s.tier === 'premium' ? `<div class="event-banner"><b>Boutique Premium</b> Les boosters achetés ici gagnent +${Math.round((s.packBonus - 1) * 100)} % de chances (une fois par booster). Les chances affichées incluent déjà ce bonus.</div>` : ''}
      <div class="panel"${s.color ? ` style="border-top:3px solid ${s.color}"` : ''}>
        <div class="muted small">Tenue par <a href="#/u/${encodeURIComponent(s.owner)}">${esc(s.owner)}</a> · ouverte ${ago(s.createdAt)}${s.withdrawnTotal ? ` · le propriétaire s'est versé ${fmt(s.withdrawnTotal)} bits du coffre` : ''}</div>
        ${s.description ? `<p style="margin:8px 0 0">${esc(s.description)}</p>` : ''}
        <div class="row small" style="margin-top:10px;gap:6px">${s.accepts.map((q) => `<span class="q-chip q-${q}">${QUAL[q]}</span>`).join('')}</div>
      </div>
      <div class="quick-grid" style="margin-top:10px">
        <div class="quick"><b>${num(s.feePct)} %</b><span>Commission${d.holderFee != null ? ` · ${num(d.holderFee)} % pour toi (actionnaire)` : s.holderDiscount ? ` · −${num(s.holderDiscount)} % pour les actionnaires` : ''}</span></div>
        <div class="quick"><b>${fmt(s.balance)}</b><span>Coffre (bits)</span></div>
        <div class="quick"><b>${fmt(s.salesCount)}</b><span>Ventes · ${fmt(s.feesTotal)} de commissions</span></div>
        <div class="quick"><b>${fmt(s.sharePrice)}</b><span>Prix d'une part · ${s.sharesLeft} dispo</span></div>
      </div>
      ${s.listingFee || s.minPrice || s.maxPrice || s.sellerMax ? `<p class="muted small">Conditions de vente : ${[s.listingFee ? `${fmt(s.listingFee)} bits de frais de dépôt` : '', s.minPrice ? `prix minimum ${fmt(s.minPrice)}` : '', s.maxPrice ? `prix maximum ${fmt(s.maxPrice)}` : '', s.sellerMax ? `${s.sellerMax} booster(s) par vendeur` : ''].filter(Boolean).join(' · ')}.</p>` : ''}
      <h2>Boosters en vente (${d.listings.length})</h2>
      ${d.listings.length ? `<div class="sealed-grid">${d.listings.map((l) => packCardHtml(l.pack, `${l.bonus ? '<div class="small" style="color:var(--r-legendary)">+15 % inclus à l\'achat</div>' : ''}<div class="row" style="gap:6px"><b class="mono grow">${fmt(l.price)}</b>${l.mine
        ? `<button class="btn sm" data-unlist="${l.id}">Retirer</button>` : `<button class="btn primary sm" data-buy="${l.id}" data-price="${l.price}" ${s.isOpen ? '' : 'disabled'}>Acheter</button>`}</div><div class="muted small">par ${esc(l.seller)}</div>`)).join('')}</div>`
        : '<div class="panel empty"><b>Rien en vente</b>Vends un booster scellé depuis l\'accueil.</div>'}
      <h2>Prêt</h2>
      <div class="panel" data-loan-box>${d.owner ? '<span class="muted">C\'est ta boutique.</span>' : d.myLoans.length
        ? d.myLoans.map((l) => `<div>Prêt de <b>${fmt(l.amount)}</b> · ${l.status === 'pending' ? 'en attente de réponse' : `reste ${fmt(l.due_amount - l.paid)} bits · échéance ${new Date(Number(l.due_at)).toLocaleDateString('fr-FR')}`} <a href="#/loans">Mes prêts ›</a></div>`).join('')
        : !s.isOpen ? '<span class="muted">Boutique fermée : pas de prêt pour le moment.</span>' : !s.loanMax ? '<span class="muted">Cette boutique ne fait pas de prêts.</span>'
          : `<div class="muted small" style="margin-bottom:8px">De ${fmt(s.loanMin)} à ${fmt(s.loanMax)} bits · ${num(s.loanRate)} % ${s.loanDaily ? `+ ${num(s.loanDaily)} % par jour` : ''}${s.loanFee ? ` + ${fmt(s.loanFee)} bits de frais` : ''}${s.loanLate ? ` · retard : +${num(s.loanLate)} % par jour` : ''}${s.loanAuto ? ` · accord immédiat jusqu'à ${fmt(s.loanAuto)} bits` : ' · le propriétaire accepte ou refuse'}.</div>
          <div class="row"><input type="number" min="${s.loanMin}" max="${s.loanMax}" placeholder="Montant" data-amount style="width:130px">
          <select data-days style="width:auto">${dayOpts.map((n) => `<option value="${n}"${n === Math.min(7, s.loanMaxDays) ? ' selected' : ''}>${n} jour${n > 1 ? 's' : ''}</option>`).join('')}</select>
          <button class="btn" data-request-loan>Demander</button></div><div class="muted small" data-loan-cost style="margin-top:6px"></div>`}</div>
      ${d.owner ? ownerPanel(d) : ''}
      ${d.payouts.length ? `<h2>Derniers dividendes</h2><div class="panel list small">${d.payouts.map((p) => `<div><span class="grow">${new Date(p.day * 864e5).toLocaleDateString('fr-FR')}</span><span class="mono">${fmt(p.amount)} bits · ${num(p.per_share.toFixed(3))} / part</span></div>`).join('')}</div>` : ''}`;
    const amt = $('[data-amount]', el);
    if (amt) {
      const cost = () => {
        const a = Number(amt.value) || 0, days = Number($('[data-days]', el).value);
        $('[data-loan-cost]', el).textContent = a ? `À rembourser : ${fmt(Math.ceil(a * (1 + (s.loanRate + s.loanDaily * days) / 100)) + s.loanFee)} bits dans ${days} jour${days > 1 ? 's' : ''}` : '';
      };
      amt.addEventListener('input', cost); $('[data-days]', el).addEventListener('change', cost);
    }
    const form = $('[data-settings]', el);
    if (form) wireSettings(form, s.balance);
  };
  const ownerPanel = (d) => `<h2>Gestion (propriétaire)</h2>
    ${d.pendingLoans.length ? `<div class="panel"><b>Demandes de prêt</b><div class="list" style="margin-top:6px">${d.pendingLoans.map((l) => `<div>
      <div class="grow"><a href="#/u/${encodeURIComponent(l.username)}">${esc(l.username)}</a> demande <b>${fmt(l.amount)}</b> sur ${l.days} j → rembourse ${fmt(l.due_amount)}
        <div class="muted small">${l.repaid_count} prêt(s) remboursé(s) · ${l.default_count} défaut(s)</div></div>
      <button class="btn primary sm" data-loan-ok="${l.id}">Accepter</button><button class="btn sm" data-loan-no="${l.id}">Refuser</button></div>`).join('')}</div></div>` : ''}
    ${d.activeLoans.length ? `<div class="panel"><b>Prêts en cours</b><div class="list small" style="margin-top:6px">${d.activeLoans.map((l) => `<div><span class="grow">${esc(l.username)} · ${fmt(l.due_amount - l.paid)} restants${l.status === 'defaulted' ? ' <span class="tag bad">défaut</span>' : ''}</span><span class="muted">${new Date(Number(l.due_at)).toLocaleDateString('fr-FR')}</span></div>`).join('')}</div></div>` : ''}
    ${d.shop.tier !== 'premium' ? `<div class="panel"><div class="row"><div class="grow"><b>Passer Premium</b><div class="muted small">Commission jusqu'à 40 % et +15 % de chances sur les boosters achetés chez toi.</div></div><button class="btn primary sm" data-upgrade>5 000 bits</button></div></div>` : ''}
    <div class="panel"><b>Coffre : ${fmt(d.shop.balance)} bits</b>
      <div class="row" style="margin-top:8px;flex-wrap:wrap;gap:8px"><input type="number" min="1" placeholder="Bits" data-dep style="width:120px"><button class="btn" data-deposit>Déposer</button>
        <input type="number" min="1" max="${d.withdrawRoom}" placeholder="Bits" data-wd style="width:120px"><button class="btn" data-withdraw ${d.withdrawRoom ? '' : 'disabled'}>Retirer</button></div>
      <p class="muted small" style="margin:6px 0 0">Tu peux te verser jusqu'à ${d.withdrawPct} % du coffre par jour (encore ${fmt(d.withdrawRoom)} bits aujourd'hui). Les retraits sont affichés publiquement sur la page de la boutique.</p></div>
    <form class="panel" data-settings><b>Réglages</b><div style="margin-top:10px">${settingsForm(d.shop, d.colors)}</div><button class="btn primary">Enregistrer</button></form>
    <div class="panel danger-zone"><div class="row"><div class="grow"><b>Supprimer la boutique</b><div class="muted small">Les boosters en vente sont rendus aux vendeurs, les prêts en cours sont annulés, les détenteurs de parts sont remboursés au prix d'une part avec le coffre ; ce qui reste du coffre te revient. Le prix d'ouverture n'est pas remboursé.</div></div>
      <button class="btn sm danger" data-delete-shop>Supprimer</button></div></div>`;
  await render();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const again = () => render().catch(toastErr);
    if (b.dataset.buy) busy(b, async () => {
      if (!(await confirmDialog('Acheter ce booster', `Acheter ce booster scellé pour <b>${fmt(b.dataset.price)}</b> bits ? Il ira dans tes boosters scellés.`, 'Acheter'))) return;
      await api(`/listings/${b.dataset.buy}/buy`, {}); toast('Booster acheté ! Il est dans tes boosters scellés.', 'ok'); sfx('coin'); refreshMe(); again();
    });
    if (b.dataset.unlist) busy(b, async () => { await api(`/listings/${b.dataset.unlist}/cancel`, {}); toast('Annonce retirée'); again(); });
    if (b.matches('[data-request-loan]')) busy(b, async () => {
      const r = await api(`/shops/${params.id}/loan`, { amount: Number($('[data-amount]', el).value), days: Number($('[data-days]', el).value) });
      toast(r.status === 'active' ? `Prêt accordé ! À rembourser : ${fmt(r.due)} bits` : `Demande envoyée (à rembourser : ${fmt(r.due)})`, 'ok'); refreshMe(); again();
    });
    if (b.dataset.loanOk || b.dataset.loanNo) busy(b, async () => {
      await api(`/loans/${b.dataset.loanOk || b.dataset.loanNo}/respond`, { accept: !!b.dataset.loanOk }); toast(b.dataset.loanOk ? 'Prêt accordé' : 'Prêt refusé'); again();
    });
    if (b.matches('[data-upgrade]')) busy(b, async () => {
      if (!(await confirmDialog('Passer Premium', 'Payer <b>5 000 bits</b> pour passer ta boutique en Premium ?', 'Passer Premium'))) return;
      await api(`/shops/${params.id}/upgrade`, {}); toast('Boutique Premium !', 'ok'); sfx('legend'); refreshMe(); again();
    });
    if (b.matches('[data-deposit]')) busy(b, async () => { await api(`/shops/${params.id}/deposit`, { amount: Number($('[data-dep]', el).value) }); toast('Coffre alimenté', 'ok'); refreshMe(); again(); });
    if (b.matches('[data-withdraw]')) busy(b, async () => { await api(`/shops/${params.id}/withdraw`, { amount: Number($('[data-wd]', el).value) }); toast('Bits versés sur ton compte', 'ok'); refreshMe(); again(); });
    if (b.matches('[data-delete-shop]')) busy(b, async () => {
      if (!(await confirmDialog('Supprimer la boutique', 'Cette action est <b>définitive</b>. Les boosters en vente sont rendus, les prêts annulés, les détenteurs de parts remboursés avec le coffre, et le reste du coffre te revient.', 'Supprimer définitivement'))) return;
      const r = await api(`/shops/${params.id}/delete`, {});
      toast(`Boutique supprimée. ${fmt(r.refunded)} bits rendus aux détenteurs de parts, ${fmt(r.toOwner)} bits pour toi.`, 'ok'); refreshMe(); location.hash = '#/shops';
    });
  });
  el.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-settings]')) return;
    e.preventDefault();
    busy($('button[class*=primary]', e.target), async () => { await api(`/shops/${params.id}/settings`, readSettings(e.target)); toast('Réglages enregistrés', 'ok'); render(); });
  });
}

// ======================================================================
// Prêts
// ======================================================================
export async function viewLoans(el) {
  const d = await api('/loans');
  const label = { pending: ['', 'En attente'], active: ['good', 'En cours'], defaulted: ['bad', 'Impayé'], repaid: ['', 'Remboursé'], refused: ['', 'Refusé'], expired: ['', 'Expiré'] };
  el.innerHTML = `${marketTabs('loans')}<div class="page-head"><h1>Mes prêts</h1></div>
    <p class="muted small">Le remboursement est prélevé automatiquement à l'échéance. S'il manque des bits, le prêt passe en impayé, la pénalité de retard de la boutique s'ajoute, et le reste est prélevé chaque jour.</p>
    ${d.items.length ? `<div class="panel list">${d.items.map((l) => `<div>
      <div class="grow"><b>${fmt(l.amount)} bits</b> de <a href="#/shop/${l.shop_id}">${esc(l.shop_name)}</a> <span class="tag ${label[l.status]?.[0] || ''}">${label[l.status]?.[1] || l.status}</span>
        <div class="muted small">${num(l.rate)} % sur ${l.days} j · à rembourser ${fmt(l.due_amount)} · déjà payé ${fmt(l.paid)}${l.due_at && ['active', 'defaulted'].includes(l.status) ? ` · échéance ${new Date(Number(l.due_at)).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</div></div>
      ${['active', 'defaulted'].includes(l.status) ? `<button class="btn sm primary" data-repay="${l.id}" data-left="${l.due_amount - l.paid}">Rembourser ${fmt(l.due_amount - l.paid)}</button>` : ''}</div>`).join('')}</div>`
      : '<div class="panel empty"><b>Aucun prêt</b>Demande un prêt depuis la page d\'une boutique.</div>'}`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-repay]');
    if (b) busy(b, async () => { await api(`/loans/${b.dataset.repay}/repay`, {}); toast('Prêt remboursé', 'ok'); refreshMe(); viewLoans(el); });
  });
}

// ======================================================================
// Bourse : on achète des parts directement à la boutique
// ======================================================================
const offersHtml = (o, withShop = true) => {
  if (!o.received.length && !o.sent.length) return '';
  const left = (x) => { const h = Math.max(0, Math.round((x.expiresAt - Date.now()) / 3600e3)); return `expire dans ${h} h`; };
  return `<div class="panel" style="margin-top:10px"><b>Offres de parts</b>
    ${o.received.length ? `<div class="muted small" style="margin-top:8px">Reçues</div><div class="list small">${o.received.map((x) => `<div class="row" style="gap:8px;align-items:flex-start">
      <div class="grow"><b>${esc(x.buyer)}</b> veut ${x.qty} part${x.qty > 1 ? 's' : ''}${withShop ? ` de <a href="#/bourse/${x.shopId}">${esc(x.shopName)}</a>` : ''} à <b>${fmt(x.price)}</b> la part
        <div class="muted">Tu recevrais ${fmt(x.total - x.tax)} bits${x.tax ? ` (taxe de la boutique : ${fmt(x.tax)})` : ''} · tu en as ${x.sellerQty} · ${left(x)}</div></div>
      <button class="btn primary sm" data-offer-ok="${x.id}">Accepter</button><button class="btn sm" data-offer-no="${x.id}">Refuser</button></div>`).join('')}</div>` : ''}
    ${o.sent.length ? `<div class="muted small" style="margin-top:8px">Envoyées (bits bloqués jusqu'à la réponse)</div><div class="list small">${o.sent.map((x) => `<div class="row" style="gap:8px">
      <span class="grow">À <b>${esc(x.seller)}</b> : ${x.qty} part${x.qty > 1 ? 's' : ''}${withShop ? ` de <a href="#/bourse/${x.shopId}">${esc(x.shopName)}</a>` : ''} à ${fmt(x.price)} · ${fmt(x.total)} bits · ${left(x)}</span>
      <button class="btn sm" data-offer-cancel="${x.id}">Annuler</button></div>`).join('')}</div>` : ''}</div>`;
};
// Actions sur les offres (Accepter / Refuser / Annuler), puis redessin de la page.
function offerClick(e, redraw) {
  const b = e.target.closest('[data-offer-ok],[data-offer-no],[data-offer-cancel]');
  if (!b) return false;
  busy(b, async () => {
    if (b.dataset.offerCancel) { await api(`/offers/${b.dataset.offerCancel}/cancel`, {}); toast('Offre annulée, tes bits sont revenus'); }
    else {
      const r = await api(`/offers/${b.dataset.offerOk || b.dataset.offerNo}/respond`, { accept: !!b.dataset.offerOk });
      toast(r.status === 'accepted' ? `Parts vendues : +${fmt(r.received)} bits` : 'Offre refusée', r.status === 'accepted' ? 'ok' : undefined);
    }
    refreshMe(); redraw();
  });
  return true;
}
function offerDialog(shop, holder, after) {
  modal(`Offre à ${esc(holder.username)}`, `<p class="muted small" style="margin-top:0">${esc(holder.username)} a ${holder.qty} part${holder.qty > 1 ? 's' : ''} de ${esc(shop.name)}. Propose un prix par part : tes bits sont bloqués jusqu'à sa réponse (48 h au plus), et rendus s'il refuse.</p>
    <div class="grid-2"><label class="field"><span>Nombre de parts</span><input type="number" min="1" max="${holder.qty}" value="${Math.min(holder.qty, 5)}" data-oq></label>
    <label class="field"><span>Prix par part (bits)</span><input type="number" min="1" value="${Math.ceil(shop.sharePrice * 1.1)}" data-op></label></div>
    <p class="small" data-ot></p><button class="btn primary" data-go>Envoyer l'offre</button>`, {
    onMount(body, close) {
      const upd = () => { const t = (Number($('[data-oq]', body).value) || 0) * (Number($('[data-op]', body).value) || 0); $('[data-ot]', body).innerHTML = `Total : <b>${fmt(t)}</b> bits (prix de la boutique : ${fmt(shop.sharePrice)} par part)`; };
      body.addEventListener('input', upd); upd();
      $('[data-go]', body).addEventListener('click', (e) => busy(e.target, async () => {
        await api(`/bourse/${shop.id}/offer`, { sellerId: holder.id, qty: Number($('[data-oq]', body).value), price: Number($('[data-op]', body).value) });
        toast('Offre envoyée', 'ok'); close(); refreshMe(); after();
      }));
    },
  });
}
const perDayText = (v) => (v >= 1 ? fmt(Math.round(v * 10) / 10) : num(+v.toFixed(3)));
export async function viewBourse(el) {
  const [d, pf] = await Promise.all([api('/shops'), api('/portfolio')]);
  const rows = d.items.slice().sort((a, b) => b.divPerShare / b.sharePrice - a.divPerShare / a.sharePrice);
  el.innerHTML = `${marketTabs('bourse')}<div class="page-head"><h1>Bourse</h1></div>
    <div class="panel how"><b>Comment ça marche</b>
      <ol class="small" style="margin:6px 0 0;padding-left:18px">
        <li>Tu achètes des <b>parts</b> d'une boutique, au prix fixé par son propriétaire. Tes bits vont dans le <b>coffre</b> de la boutique.</li>
        <li>Chaque jour, la boutique te verse des <b>dividendes</b> selon ton nombre de parts.</li>
        <li>Si la boutique le propose, tu peux lui <b>revendre</b> tes parts (au pourcentage de rachat qu'elle a choisi).</li>
        <li>Tu peux aussi <b>racheter des parts à un autre joueur</b> : fais-lui une offre depuis la page de la boutique. Il accepte ou refuse ; tes bits sont bloqués en attendant et rendus en cas de refus.</li>
      </ol></div>
    <div class="panel" style="margin-top:10px"><div class="row"><b class="grow">Mes parts</b>${pf.items.length ? `<span class="mono small">≈ ${perDayText(pf.perDay)} bits / jour</span>` : ''}</div>
      ${pf.items.length ? `<div class="list small" style="margin-top:6px">${pf.items.map((x) => `<a href="#/bourse/${x.id}" style="color:var(--text)"><span class="grow">${x.emoji ? esc(x.emoji) + ' ' : ''}${esc(x.name)} · ${x.qty} part${x.qty > 1 ? 's' : ''}
          <span class="muted">· payé ${fmt(x.paid)} · déjà touché ${fmt(x.received)}</span></span><span class="mono">+${perDayText(x.perDay)}/j</span></a>`).join('')}</div>
        <div class="muted small" style="margin-top:6px">Total payé ${fmt(pf.paid)} bits · dividendes touchés ${fmt(pf.received)} bits</div>`
        : '<div class="muted small" style="margin-top:6px">Tu n\'as pas encore de parts. Choisis une boutique ci-dessous.</div>'}</div>
    ${offersHtml(pf.offers || { received: [], sent: [] })}
    <div class="panel" style="padding:0;overflow-x:auto;margin-top:10px"><table class="data"><tr><th>Boutique</th><th style="text-align:right">Prix / part</th><th style="text-align:right">Rapporte / jour</th><th style="text-align:right">Rentabilisée en</th><th style="text-align:right">Dispo</th><th style="text-align:right">Rachat</th></tr>
      ${rows.map((s) => {
        const days = s.divPerShare > 0 ? Math.ceil(s.sharePrice / s.divPerShare) : null;
        return `<tr data-go="${s.id}" style="cursor:pointer"><td><b>${shopTitle(s)}</b>${!s.isOpen ? ' <span class="tag bad">Fermée</span>' : ''}</td><td class="num">${fmt(s.sharePrice)}</td>
          <td class="num">${s.divPerShare > 0 ? perDayText(s.divPerShare) : '—'}</td><td class="num">${days ? `${fmt(days)} j` : '—'}</td>
          <td class="num">${s.sharesLeft}</td><td class="num">${s.buybackPct ? `${num(s.buybackPct)} %` : 'non'}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="muted center" style="padding:20px">Aucune boutique</td></tr>'}</table></div>
    <p class="muted small">« Rentabilisée en » : nombre de jours de dividendes pour récupérer le prix d'une part, au rythme actuel. Les dividendes peuvent changer si le propriétaire modifie ses réglages ou si le coffre se vide.</p>`;
  el.onclick = (e) => {
    if (offerClick(e, () => viewBourse(el))) return;
    const r = e.target.closest('[data-go]'); if (r) location.hash = '#/bourse/' + r.dataset.go;
  };
}

export async function viewStock(el, { params }) {
  let last = null;
  const render = async () => {
    const d = last = await api('/bourse/' + params.id);
    const s = d.shop, h = d.holding;
    const resale = s.buybackPct ? Math.floor((s.sharePrice * s.buybackPct) / 100) : 0;
    const maxBuy = Math.max(0, Math.min(s.sharesLeft, s.maxPerPlayer - h.qty, Math.floor(d.bits / s.sharePrice)));
    const kind = { achat: 'a acheté', revente: 'a revendu', retrait: 's\'est versé' };
    el.innerHTML = `${marketTabs('bourse')}
      <div class="page-head"><h1>${shopTitle(s)}</h1><div class="row"><a class="btn sm" href="#/shop/${s.id}">Voir la boutique</a></div></div>
      <div class="quick-grid">
        <div class="quick"><b>${fmt(s.sharePrice)}</b><span>Prix d'une part (bits)</span></div>
        <div class="quick"><b>${s.divPerShare > 0 ? perDayText(s.divPerShare) : '0'}</b><span>Dividende par part et par jour</span></div>
        <div class="quick"><b>${s.sharesLeft} / ${s.sharesMax}</b><span>Parts encore à vendre</span></div>
        <div class="quick"><b>${resale ? fmt(resale) : 'Non'}</b><span>${resale ? `Rachat d'une part (${num(s.buybackPct)} %)` : 'La boutique ne rachète pas'}</span></div>
      </div>
      <p class="muted small">Coffre ${fmt(s.balance)} bits · dividendes : ${s.divMode === 'fixe' ? `${num(s.divPct)} % du prix d'une part par jour` : `${num(s.divPct)} % du coffre par jour, partagé entre les 1 000 parts`} · ${s.holders} détenteur${s.holders > 1 ? 's' : ''}${s.withdrawnTotal ? ` · le propriétaire s'est versé ${fmt(s.withdrawnTotal)} bits` : ''}</p>
      <div class="grid-2">
        <div class="panel"><b>Acheter des parts</b>
          ${d.owner ? '<p class="muted small">C\'est ta boutique : tu règles le prix et les dividendes dans ses réglages.</p>' : !s.isOpen ? '<p class="muted small">Boutique fermée pour le moment.</p>' : !s.sharesLeft ? '<p class="muted small">La boutique n\'a plus de parts à vendre : fais une offre à un détenteur (liste plus bas).</p>' : `
          <label class="field" style="margin-top:10px"><span>Nombre de parts</span><input type="number" min="1" max="${Math.max(1, maxBuy)}" value="${Math.min(Math.max(1, maxBuy), 10)}" data-qty></label>
          <p class="small" data-buy-total></p>
          <button class="btn primary" style="width:100%" data-buy-shares ${maxBuy ? '' : 'disabled'}>Acheter</button>
          <p class="muted small" style="margin:8px 0 0">Tes bits : ${fmt(d.bits)} · maximum ${s.maxPerPlayer} parts par joueur</p>`}
        </div>
        <div class="panel"><b>Mes parts : ${h.qty}</b>
          ${h.qty ? `<div class="small" style="margin-top:6px">Payé ${fmt(h.paid)} bits · dividendes touchés ${fmt(h.received)} bits · ≈ ${perDayText(s.divPerShare * h.qty)} bits par jour</div>
            ${resale ? `<label class="field" style="margin-top:10px"><span>Revendre à la boutique</span><input type="number" min="1" max="${h.qty}" value="${h.qty}" data-sell-qty></label>
              <p class="small" data-sell-total></p><button class="btn" style="width:100%" data-sell-shares>Revendre</button>` : '<p class="muted small">Cette boutique ne rachète pas ses parts : tu les gardes et tu touches les dividendes.</p>'}`
            : '<p class="muted small">Tu n\'as pas de parts de cette boutique.</p>'}
        </div>
      </div>
      <div class="grid-2" style="margin-top:10px">
        <div class="panel"><b>Derniers mouvements</b><div class="list small" style="margin-top:6px">${d.recent.map((g) => `<div><span class="grow">${esc(g.username || '?')} ${kind[g.kind] || g.kind} ${g.qty ? `${g.qty} part${g.qty > 1 ? 's' : ''} · ` : ''}${fmt(g.amount)} bits</span><span class="muted">${ago(g.at)}</span></div>`).join('') || '<div class="muted">Aucun mouvement</div>'}</div></div>
        <div class="panel"><b>Détenteurs</b>${!d.owner ? '<div class="muted small">Propose-leur un prix pour racheter leurs parts.</div>' : ''}<div class="list small" style="margin-top:6px">${d.holders.map((x) => `<div class="row" style="gap:8px"><span class="grow">${esc(x.username)}</span><span class="mono">${x.qty} part${x.qty > 1 ? 's' : ''}</span>${!d.owner && x.id !== state.me.user.id ? `<button class="btn sm" data-offer-to="${x.id}">Faire une offre</button>` : ''}</div>`).join('') || '<div class="muted">Personne pour l\'instant</div>'}</div></div>
      </div>
      ${offersHtml(d.offers || { received: [], sent: [] }, false)}
      ${d.payouts.length ? `<h2>Dividendes versés</h2><div class="panel list small">${d.payouts.map((p) => `<div><span class="grow">${new Date(p.day * 864e5).toLocaleDateString('fr-FR')}</span><span class="mono">${fmt(p.amount)} bits · ${num(p.per_share.toFixed(3))} / part</span></div>`).join('')}</div>` : ''}`;
    const q = $('[data-qty]', el);
    if (q) {
      const upd = () => { const n = Number(q.value) || 0; $('[data-buy-total]', el).innerHTML = n ? `Coût : <b>${fmt(n * s.sharePrice)}</b> bits → environ <b>${perDayText(s.divPerShare * n)}</b> bits de dividendes par jour` : ''; };
      q.addEventListener('input', upd); upd();
    }
    const sq = $('[data-sell-qty]', el);
    if (sq) {
      const upd = () => { const n = Number(sq.value) || 0; $('[data-sell-total]', el).innerHTML = n ? `Tu récupères <b>${fmt(Math.floor((n * s.sharePrice * s.buybackPct) / 100))}</b> bits` : ''; };
      sq.addEventListener('input', upd); upd();
    }
  };
  await render();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (offerClick(e, render)) return;
    if (b.dataset.offerTo) { const h = last.holders.find((x) => String(x.id) === b.dataset.offerTo); if (h) offerDialog(last.shop, h, render); return; }
    if (b.matches('[data-buy-shares]')) busy(b, async () => {
      const r = await api(`/bourse/${params.id}/buy`, { qty: Number($('[data-qty]', el).value) });
      toast(`Parts achetées (${fmt(r.cost)} bits). Tu en as ${r.qty}.`, 'ok'); sfx('coin'); refreshMe(); render();
    });
    if (b.matches('[data-sell-shares]')) busy(b, async () => {
      const r = await api(`/bourse/${params.id}/sell`, { qty: Number($('[data-sell-qty]', el).value) });
      toast(`Parts revendues : +${fmt(r.amount)} bits`, 'ok'); refreshMe(); render();
    });
  });
}
