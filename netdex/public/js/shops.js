// Boosters scellés, boutiques d'échange, prêts et bourse des boutiques.
import { lineChart } from './chart.js';
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
  const ok = d.items.filter((s) => s.accepts.includes(p.quality));
  modal('Vendre en boutique', `${packCardHtml(p)}
    ${ok.length ? `<label class="field" style="margin-top:12px"><span>Boutique</span><select data-shop>${ok.map((s) => `<option value="${s.id}">${esc(s.name)} — commission ${String(s.feePct).replace('.', ',')} % · ${s.listings} en vente</option>`).join('')}</select></label>
      <label class="field"><span>Prix (bits)</span><input type="number" min="1" value="${Math.max(10, Math.round(30 * p.boost))}" data-price></label>
      <p class="muted small" data-net></p><button class="btn primary" data-go>Mettre en vente</button>`
      : '<div class="empty"><b>Aucune boutique n\'accepte cette qualité</b>Crée la tienne dans Marché › Boutiques.</div>'}`, {
    onMount(body, close) {
      if (!ok.length) return;
      const net = () => {
        const s = ok.find((x) => x.id === Number($('[data-shop]', body).value));
        const price = Number($('[data-price]', body).value) || 0;
        $('[data-net]', body).textContent = `Tu toucheras ${fmt(price - Math.floor((price * s.feePct) / 100))} bits si le booster se vend.`;
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
    <div class="page-head"><h1>Boutiques d'échange</h1><div class="row"><button class="btn primary sm" data-create>Ouvrir ma boutique (${fmt(d.price)} bits)</button></div></div>
    <p class="muted small">Chaque boutique prend une commission sur les boosters scellés vendus chez elle. Son coffre sert à prêter aux joueurs et à verser des dividendes à ses actionnaires.</p>
    ${mine.length ? `<h2>Mes boutiques</h2><div class="shop-grid">${mine.map(shopCard).join('')}</div>` : ''}
    <h2>Toutes les boutiques (${d.items.length})</h2>
    ${d.items.length ? `<div class="shop-grid">${d.items.map(shopCard).join('')}</div>` : '<div class="panel empty"><b>Aucune boutique pour l\'instant</b>Sois le premier à en ouvrir une.</div>'}`;
  $('[data-create]', el).addEventListener('click', () => createShopDialog(d.price));
}

const shopCard = (s) => `<a class="shop-card" href="#/shop/${s.id}">
  <div class="row"><b class="grow">${esc(s.name)}</b><span class="tag">${String(s.feePct).replace('.', ',')} %</span></div>
  <div class="muted small">par ${esc(s.owner)} · ${s.listings} booster${s.listings > 1 ? 's' : ''} en vente · ${fmt(s.salesCount)} ventes</div>
  ${s.description ? `<p class="small" style="margin:6px 0 0">${esc(s.description.slice(0, 120))}</p>` : ''}
  <div class="row small" style="margin-top:8px;gap:6px">${s.accepts.map((q) => `<span class="q-chip q-${q}">${QUAL[q]}</span>`).join('')}</div>
  <div class="row small mono" style="margin-top:8px"><span class="grow">Coffre ${fmt(s.balance)}</span><span>${s.lastPrice ? `Action ${fmt(s.lastPrice)}` : 'Pas encore cotée'}</span></div>
</a>`;

function createShopDialog(price) {
  modal('Ouvrir une boutique', `<p class="muted small" style="margin-top:0">Coût : <b>${fmt(price)} bits</b> (ton solde : ${fmt(state.me.user.bits)}). Tu reçois les 1 000 actions de la boutique.</p>
    ${settingsForm({ name: '', description: '', feePct: 5, accepts: Object.keys(QUAL), divPct: 0, loanRate: 10, loanMax: 1000 })}
    <button class="btn primary" data-go>Ouvrir pour ${fmt(price)} bits</button>`, {
    onMount(body, close) {
      $('[data-go]', body).addEventListener('click', (e) => busy(e.target, async () => {
        const r = await api('/shops', readSettings(body));
        toast('Boutique ouverte !', 'ok'); sfx('legend'); close(); await refreshMe(); location.hash = '#/shop/' + r.id;
      }));
    },
  });
}

const settingsForm = (s) => `<div class="grid-2">
  <label class="field"><span>Nom</span><input type="text" name="name" maxlength="30" value="${esc(s.name)}"></label>
  <label class="field"><span>Commission sur les ventes (0–25 %)</span><input type="number" name="feePct" min="0" max="25" step="0.5" value="${s.feePct}"></label>
</div>
<label class="field"><span>Description</span><input type="text" name="description" maxlength="280" value="${esc(s.description)}"></label>
<div class="field"><span class="muted small" style="font-weight:600;text-transform:uppercase;letter-spacing:.05em;font-size:12px">Qualités de boosters acceptées</span>
  <div class="row" style="margin-top:6px">${Object.entries(QUAL).map(([k, v]) => `<label class="row small" style="gap:4px"><input type="checkbox" name="accepts" value="${k}" ${s.accepts.includes(k) ? 'checked' : ''}> ${v}</label>`).join('')}</div></div>
<div class="grid-2">
  <label class="field"><span>Dividendes : % du coffre versé chaque jour (0–50)</span><input type="number" name="divPct" min="0" max="50" step="0.5" value="${s.divPct}"></label>
  <label class="field"><span>Taux des prêts (intérêts totaux, %)</span><input type="number" name="loanRate" min="0" max="100" step="0.5" value="${s.loanRate}"></label>
  <label class="field"><span>Prêt maximum (bits)</span><input type="number" name="loanMax" min="0" value="${s.loanMax}"></label>
</div>`;
const readSettings = (root) => ({
  name: $('[name=name]', root).value, description: $('[name=description]', root).value, feePct: Number($('[name=feePct]', root).value),
  accepts: $$('[name=accepts]:checked', root).map((x) => x.value), divPct: Number($('[name=divPct]', root).value),
  loanRate: Number($('[name=loanRate]', root).value), loanMax: Number($('[name=loanMax]', root).value),
});

// ======================================================================
// Une boutique
// ======================================================================
export async function viewShop(el, { params, on }) {
  const render = async () => {
    const d = await api('/shops/' + params.id);
    const s = d.shop;
    el.innerHTML = `${marketTabs('shops')}
      <div class="page-head"><h1>${esc(s.name)}</h1><div class="row"><a class="btn sm" href="#/bourse/${s.id}">Action ${s.lastPrice ? fmt(s.lastPrice) : '—'}</a></div></div>
      <div class="panel">
        <div class="muted small">Tenue par <a href="#/u/${encodeURIComponent(s.owner)}">${esc(s.owner)}</a> · ouverte ${ago(s.createdAt)}</div>
        ${s.description ? `<p style="margin:8px 0 0">${esc(s.description)}</p>` : ''}
        <div class="row small" style="margin-top:10px;gap:6px">${s.accepts.map((q) => `<span class="q-chip q-${q}">${QUAL[q]}</span>`).join('')}</div>
      </div>
      <div class="quick-grid" style="margin-top:10px">
        <div class="quick"><b>${String(s.feePct).replace('.', ',')} %</b><span>Commission</span></div>
        <div class="quick"><b>${fmt(s.balance)}</b><span>Coffre (bits)</span></div>
        <div class="quick"><b>${fmt(s.salesCount)}</b><span>Ventes · ${fmt(s.feesTotal)} de commissions</span></div>
        <div class="quick"><b>${String(s.divPct).replace('.', ',')} %</b><span>Dividendes / jour</span></div>
      </div>
      <h2>Boosters en vente (${d.listings.length})</h2>
      ${d.listings.length ? `<div class="sealed-grid">${d.listings.map((l) => packCardHtml(l.pack, `<div class="row" style="gap:6px"><b class="mono grow">${fmt(l.price)}</b>${l.mine
        ? `<button class="btn sm" data-unlist="${l.id}">Retirer</button>` : `<button class="btn primary sm" data-buy="${l.id}" data-price="${l.price}">Acheter</button>`}</div><div class="muted small">par ${esc(l.seller)}</div>`)).join('')}</div>`
        : '<div class="panel empty"><b>Rien en vente</b>Vends un booster scellé depuis l\'accueil.</div>'}
      <h2>Prêt</h2>
      <div class="panel" data-loan-box>${d.owner ? '<span class="muted">C\'est ta boutique.</span>' : d.myLoans.length
        ? d.myLoans.map((l) => `<div>Prêt de <b>${fmt(l.amount)}</b> · ${l.status === 'pending' ? 'en attente de réponse' : `reste ${fmt(l.due_amount - l.paid)} bits · échéance ${new Date(Number(l.due_at)).toLocaleDateString('fr-FR')}`} <a href="#/loans">Mes prêts ›</a></div>`).join('')
        : `<div class="muted small" style="margin-bottom:8px">Taux ${String(s.loanRate).replace('.', ',')} % · jusqu'à ${fmt(s.loanMax)} bits · le propriétaire accepte ou refuse.</div>
          <div class="row"><input type="number" min="1" max="${s.loanMax}" placeholder="Montant" data-amount style="width:130px">
          <select data-days style="width:auto">${[1, 2, 3, 5, 7, 10, 14].map((n) => `<option value="${n}"${n === 7 ? ' selected' : ''}>${n} jour${n > 1 ? 's' : ''}</option>`).join('')}</select>
          <button class="btn" data-request-loan>Demander</button></div><div class="muted small" data-loan-cost style="margin-top:6px"></div>`}</div>
      ${d.owner ? ownerPanel(d) : ''}
      ${d.payouts.length ? `<h2>Derniers dividendes</h2><div class="panel list small">${d.payouts.map((p) => `<div><span class="grow">${new Date(p.day * 864e5).toLocaleDateString('fr-FR')}</span><span class="mono">${fmt(p.amount)} bits · ${p.per_share.toFixed(2).replace('.', ',')} / action</span></div>`).join('')}</div>` : ''}`;
    const amt = $('[data-amount]', el);
    if (amt) {
      const cost = () => { const a = Number(amt.value) || 0; $('[data-loan-cost]', el).textContent = a ? `À rembourser : ${fmt(Math.ceil(a * (1 + s.loanRate / 100)))} bits` : ''; };
      amt.addEventListener('input', cost);
    }
  };
  const ownerPanel = (d) => `<h2>Gestion (propriétaire)</h2>
    ${d.pendingLoans.length ? `<div class="panel"><b>Demandes de prêt</b><div class="list" style="margin-top:6px">${d.pendingLoans.map((l) => `<div>
      <div class="grow"><a href="#/u/${encodeURIComponent(l.username)}">${esc(l.username)}</a> demande <b>${fmt(l.amount)}</b> sur ${l.days} j → rembourse ${fmt(l.due_amount)}
        <div class="muted small">${l.repaid_count} prêt(s) remboursé(s) · ${l.default_count} défaut(s)</div></div>
      <button class="btn primary sm" data-loan-ok="${l.id}">Accepter</button><button class="btn sm" data-loan-no="${l.id}">Refuser</button></div>`).join('')}</div></div>` : ''}
    ${d.activeLoans.length ? `<div class="panel"><b>Prêts en cours</b><div class="list small" style="margin-top:6px">${d.activeLoans.map((l) => `<div><span class="grow">${esc(l.username)} · ${fmt(l.due_amount - l.paid)} restants${l.status === 'defaulted' ? ' <span class="tag bad">défaut</span>' : ''}</span><span class="muted">${new Date(Number(l.due_at)).toLocaleDateString('fr-FR')}</span></div>`).join('')}</div></div>` : ''}
    <div class="panel"><b>Alimenter le coffre</b><div class="row" style="margin-top:8px"><input type="number" min="1" placeholder="Bits" data-dep style="width:140px"><button class="btn" data-deposit>Déposer</button></div>
      <p class="muted small" style="margin:6px 0 0">L'argent du coffre ne peut pas être retiré directement : il sert aux prêts et revient aux actionnaires par les dividendes.</p></div>
    <form class="panel" data-settings><b>Réglages</b><div style="margin-top:10px">${settingsForm(d.shop)}</div><button class="btn primary">Enregistrer</button></form>`;
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
      toast(`Demande envoyée (à rembourser : ${fmt(r.due)})`, 'ok'); again();
    });
    if (b.dataset.loanOk || b.dataset.loanNo) busy(b, async () => {
      await api(`/loans/${b.dataset.loanOk || b.dataset.loanNo}/respond`, { accept: !!b.dataset.loanOk }); toast(b.dataset.loanOk ? 'Prêt accordé' : 'Prêt refusé'); again();
    });
    if (b.matches('[data-deposit]')) busy(b, async () => { await api(`/shops/${params.id}/deposit`, { amount: Number($('[data-dep]', el).value) }); toast('Coffre alimenté', 'ok'); refreshMe(); again(); });
  });
  el.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-settings]')) return;
    e.preventDefault();
    busy($('button', e.target), async () => { await api(`/shops/${params.id}/settings`, readSettings(e.target)); toast('Réglages enregistrés', 'ok'); render(); });
  });
}

// ======================================================================
// Prêts
// ======================================================================
export async function viewLoans(el) {
  const d = await api('/loans');
  const label = { pending: ['', 'En attente'], active: ['good', 'En cours'], defaulted: ['bad', 'Impayé'], repaid: ['', 'Remboursé'], refused: ['', 'Refusé'], expired: ['', 'Expiré'] };
  el.innerHTML = `${marketTabs('loans')}<div class="page-head"><h1>Mes prêts</h1></div>
    <p class="muted small">Le remboursement est prélevé automatiquement à l'échéance. S'il manque des bits, le prêt passe en impayé et le reste est prélevé chaque jour.</p>
    ${d.items.length ? `<div class="panel list">${d.items.map((l) => `<div>
      <div class="grow"><b>${fmt(l.amount)} bits</b> de <a href="#/shop/${l.shop_id}">${esc(l.shop_name)}</a> <span class="tag ${label[l.status][0]}">${label[l.status][1]}</span>
        <div class="muted small">${l.rate} % · à rembourser ${fmt(l.due_amount)} · déjà payé ${fmt(l.paid)}${l.due_at && ['active', 'defaulted'].includes(l.status) ? ` · échéance ${new Date(Number(l.due_at)).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</div></div>
      ${['active', 'defaulted'].includes(l.status) ? `<button class="btn sm primary" data-repay="${l.id}" data-left="${l.due_amount - l.paid}">Rembourser ${fmt(l.due_amount - l.paid)}</button>` : ''}</div>`).join('')}</div>`
      : '<div class="panel empty"><b>Aucun prêt</b>Demande un prêt depuis la page d\'une boutique.</div>'}`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-repay]');
    if (b) busy(b, async () => { await api(`/loans/${b.dataset.repay}/repay`, {}); toast('Prêt remboursé', 'ok'); refreshMe(); viewLoans(el); });
  });
}

// ======================================================================
// Bourse
// ======================================================================
export async function viewBourse(el) {
  const [d, pf] = await Promise.all([api('/shops'), api('/portfolio')]);
  const quoted = d.items.slice().sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  el.innerHTML = `${marketTabs('bourse')}<div class="page-head"><h1>Bourse</h1></div>
    <p class="muted small">Chaque boutique a 1 000 actions. Le cours est le prix du dernier échange. Les actionnaires touchent chaque jour les dividendes fixés par la boutique.</p>
    <div class="panel"><div class="row"><b class="grow">Mon portefeuille</b><span class="mono">${fmt(pf.value)} bits</span></div>
      ${pf.items.length ? `<div class="list small" style="margin-top:6px">${pf.items.map((x) => `<a href="#/bourse/${x.id}" style="color:var(--text)"><span class="grow">${esc(x.name)} · ${x.qty} action${x.qty > 1 ? 's' : ''}${x.locked ? ` (${x.locked} en vente)` : ''}</span>
        <span class="mono">${x.last_price ? fmt(x.qty * x.last_price) : '—'}</span></a>`).join('')}</div>` : '<div class="muted small" style="margin-top:6px">Aucune action.</div>'}
      ${pf.orders.length ? `<div class="muted small" style="margin-top:8px">${pf.orders.length} ordre(s) en attente</div>` : ''}</div>
    <div class="panel" style="padding:0;overflow-x:auto;margin-top:10px"><table class="data"><tr><th>Boutique</th><th style="text-align:right">Cours</th><th style="text-align:right">24 h</th><th style="text-align:right">Capitalisation</th><th style="text-align:right">Volume 24 h</th><th style="text-align:right">Div./j</th></tr>
      ${quoted.map((s) => `<tr data-go="${s.id}" style="cursor:pointer"><td><b>${esc(s.name)}</b></td><td class="num">${s.lastPrice ? fmt(s.lastPrice) : '—'}</td>
        <td class="num">${s.change24h == null ? '—' : `<span class="${s.change24h >= 0 ? 'up' : 'down'}">${s.change24h >= 0 ? '+' : ''}${String(s.change24h).replace('.', ',')} %</span>`}</td>
        <td class="num">${s.marketCap ? fmt(s.marketCap) : '—'}</td><td class="num">${fmt(s.volume24h)}</td><td class="num">${String(s.divPct).replace('.', ',')} %</td></tr>`).join('') || '<tr><td colspan="6" class="muted center" style="padding:20px">Aucune boutique cotée</td></tr>'}</table></div>`;
  el.addEventListener('click', (e) => { const r = e.target.closest('[data-go]'); if (r) location.hash = '#/bourse/' + r.dataset.go; });
}

export async function viewStock(el, { params, on }) {
  let side = 'buy', type = 'limit';
  const render = async () => {
    const d = await api('/bourse/' + params.id);
    const s = d.shop;
    const bestAsk = d.asks[0]?.price, bestBid = d.bids[0]?.price;
    el.innerHTML = `${marketTabs('bourse')}
      <div class="page-head"><h1>${esc(s.name)}</h1><div class="row"><a class="btn sm" href="#/shop/${s.id}">Voir la boutique</a></div></div>
      <div class="row" style="align-items:baseline;gap:12px"><span class="big-value">${s.lastPrice ? fmt(s.lastPrice) : '—'}</span><span class="muted">bits / action</span>
        ${s.change24h == null ? '' : `<span class="delta ${s.change24h >= 0 ? 'up' : 'down'}">${s.change24h >= 0 ? '+' : ''}${String(s.change24h).replace('.', ',')} % 24 h</span>`}</div>
      <div class="muted small">Capitalisation ${s.marketCap ? fmt(s.marketCap) : '—'} · coffre ${fmt(s.balance)} · dividendes ${String(s.divPct).replace('.', ',')} % du coffre / jour · ${s.holders} actionnaire${s.holders > 1 ? 's' : ''}</div>
      <div class="chart" style="margin-top:10px" data-chart></div>
      <div class="grid-2" style="margin-top:10px">
        <div class="panel"><b>Carnet d'ordres</b>
          <table class="data book" style="margin-top:6px"><tr><th>Vente</th><th style="text-align:right">Prix</th><th style="text-align:right">Qté</th></tr>
            ${d.asks.slice().reverse().map((a) => `<tr class="ask" data-px="${a.price}"><td>${a.orders} ordre${a.orders > 1 ? 's' : ''}</td><td class="num">${fmt(a.price)}</td><td class="num">${a.qty}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aucune offre de vente</td></tr>'}
            <tr><td colspan="3" class="center muted small">écart ${bestAsk && bestBid ? fmt(bestAsk - bestBid) : '—'}</td></tr>
            ${d.bids.map((b) => `<tr class="bid" data-px="${b.price}"><td>${b.orders} ordre${b.orders > 1 ? 's' : ''}</td><td class="num">${fmt(b.price)}</td><td class="num">${b.qty}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aucune offre d\'achat</td></tr>'}
          </table></div>
        <form class="panel" data-order>
          <div class="tabs" style="margin-bottom:10px"><button type="button" data-side="buy">Acheter</button><button type="button" data-side="sell">Vendre</button></div>
          <div class="chips" style="margin-bottom:10px"><button type="button" class="chip" data-type="limit">À cours limité</button><button type="button" class="chip" data-type="market">Au marché</button></div>
          <label class="field"><span>Quantité</span><input type="number" name="qty" min="1" max="1000" value="10"></label>
          <label class="field" data-price-field><span>Prix limite (bits / action)</span><input type="number" name="price" min="1" value="${s.lastPrice || bestAsk || bestBid || 10}"></label>
          <p class="muted small" data-total></p>
          <button class="btn primary" style="width:100%">Passer l'ordre</button>
          <p class="muted small" style="margin:8px 0 0">Tes bits : ${fmt(d.bits)} · tes actions : ${d.holding.qty}${d.holding.locked ? ` (${d.holding.locked} en vente)` : ''}</p>
        </form>
      </div>
      ${d.myOrders.length ? `<h2>Mes ordres en attente</h2><div class="panel list small">${d.myOrders.map((o) => `<div><span class="grow"><span class="tag ${o.side === 'buy' ? 'good' : 'bad'}">${o.side === 'buy' ? 'Achat' : 'Vente'}</span> ${o.qty - o.filled}/${o.qty} à ${fmt(o.price)}</span><button class="btn sm" data-cancel-order="${o.id}">Annuler</button></div>`).join('')}</div>` : ''}
      <div class="grid-2" style="margin-top:10px">
        <div class="panel"><b>Derniers échanges</b><div class="list small" style="margin-top:6px">${d.trades.map((t) => `<div><span class="grow mono">${fmt(t.price)} × ${t.qty}</span><span class="muted">${ago(t.at)}</span></div>`).join('') || '<div class="muted">Aucun échange</div>'}</div></div>
        <div class="panel"><b>Principaux actionnaires</b><div class="list small" style="margin-top:6px">${d.holders.map((x) => `<div><span class="grow">${esc(x.username)}</span><span class="mono">${x.qty} (${(x.qty / 10).toFixed(1).replace('.', ',')} %)</span></div>`).join('')}</div></div>
      </div>`;
    const pts = d.history.map((x) => ({ x: Number(x.at), y: x.price }));
    if (pts.length) lineChart($('[data-chart]', el), pts, { format: (v) => fmt(Math.round(v)), label: 'Cours', height: 180 });
    else $('[data-chart]', el).innerHTML = '<div class="muted small">Pas encore d\'échange : le cours apparaîtra au premier ordre exécuté.</div>';
    const f = $('[data-order]', el);
    const sync = () => {
      $$('[data-side]', f).forEach((b) => b.classList.toggle('on', b.dataset.side === side));
      $$('[data-type]', f).forEach((b) => b.classList.toggle('on', b.dataset.type === type));
      $('[data-price-field]', f).style.display = type === 'limit' ? '' : 'none';
      const qty = Number(f.qty.value) || 0, px = type === 'limit' ? Number(f.price.value) || 0 : side === 'buy' ? bestAsk : bestBid;
      $('[data-total]', f).textContent = px ? `≈ ${fmt(qty * px)} bits${type === 'market' ? ' (au meilleur prix disponible)' : ''}` : type === 'market' ? 'Personne en face pour l\'instant.' : '';
      $('button:not([type])', f).className = `btn ${side === 'buy' ? 'primary' : 'danger'}`;
      $('button:not([type])', f).textContent = `${side === 'buy' ? 'Acheter' : 'Vendre'} ${type === 'market' ? 'au marché' : 'à cours limité'}`;
    };
    sync();
    f.addEventListener('input', sync);
    f.addEventListener('click', (e) => {
      const sb = e.target.closest('[data-side]'); if (sb) { side = sb.dataset.side; sync(); }
      const tb = e.target.closest('[data-type]'); if (tb) { type = tb.dataset.type; sync(); }
    });
    $$('[data-px]', el).forEach((r) => r.addEventListener('click', () => { type = 'limit'; f.price.value = r.dataset.px; side = r.classList.contains('ask') ? 'buy' : 'sell'; sync(); }));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      busy($('button:not([type])', f), async () => {
        const r = await api(`/bourse/${params.id}/order`, { side, type, qty: Number(f.qty.value), price: Number(f.price.value) });
        toast(r.filled ? `${r.filled} action(s) échangée(s) à ${fmt(r.avgPrice)} en moyenne${r.resting ? ` · ${r.resting} en attente` : ''}` : r.resting ? 'Ordre placé dans le carnet' : 'Aucune contrepartie : rien d\'exécuté', r.filled ? 'ok' : '');
        if (r.filled) sfx('coin');
        refreshMe(); render();
      });
    });
  };
  await render();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cancel-order]');
    if (b) busy(b, async () => { await api(`/orders/${b.dataset.cancelOrder}/cancel`, {}); toast('Ordre annulé'); refreshMe(); render(); });
  });
  const iv = setInterval(() => { if (document.visibilityState === 'visible' && !el.contains(document.activeElement)) render().catch(() => {}); }, 20000);
  on('nd:leave', () => clearInterval(iv));
}
