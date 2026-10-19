// Filtrage et tri des biens. Utilisé dans le navigateur (page /biens, accueil) ET sur le serveur (rendu SEO),
// pour que les deux donnent exactement les mêmes résultats.
globalThis.AEIFilters = (() => {
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const num = (s) => Number(String(s ?? '').replace(/\s/g, '').replace(',', '.')) || 0;
  const closed = (b) => b.statut === 'vendu' || b.statut === 'loue' || (!b.statut && b.vendu);
  const list = (v) => (Array.isArray(v) ? v : v ? String(v).split('|') : []).map(x => String(x).trim()).filter(Boolean);

  // Lit les paramètres d'URL (?transaction=vente&type=Maison|Villa&ville=Gien&prixMax=300000…)
  const parse = (params) => {
    const get = (k) => (typeof params.get === 'function' ? params.get(k) : params[k]) || '';
    return {
      transaction: ['vente', 'location'].includes(get('transaction')) ? get('transaction') : 'vente',
      types: list(get('type')),
      villes: list(get('ville')),
      prixMin: num(get('prixMin')), prixMax: num(get('prixMax')),
      surfMin: num(get('surfMin')), surfMax: num(get('surfMax')),
      piecesMin: Math.floor(num(get('piecesMin'))), chambresMin: Math.floor(num(get('chambresMin'))),
      equip: list(get('equip')),
      vv: get('vv') === '1',
      clos: get('clos') === '1',
      q: String(get('q')).slice(0, 80),
      sort: ['recent', 'ancien', 'prix-asc', 'prix-desc', 'surface-desc', 'surface-asc'].includes(get('sort')) ? get('sort') : 'recent',
    };
  };

  // Reconstruit l'URL à partir des filtres (seulement les valeurs non par défaut)
  const toQuery = (f) => {
    const p = new URLSearchParams();
    if (f.transaction !== 'vente') p.set('transaction', f.transaction);
    if (f.types.length) p.set('type', f.types.join('|'));
    if (f.villes.length) p.set('ville', f.villes.join('|'));
    ['prixMin', 'prixMax', 'surfMin', 'surfMax', 'piecesMin', 'chambresMin'].forEach(k => { if (f[k]) p.set(k, f[k]); });
    if (f.equip.length) p.set('equip', f.equip.join('|'));
    if (f.vv) p.set('vv', '1');
    if (f.clos) p.set('clos', '1');
    if (f.q) p.set('q', f.q);
    if (f.sort !== 'recent') p.set('sort', f.sort);
    return p.toString();
  };

  const matches = (b, f) => {
    if ((b.transaction || 'vente') !== f.transaction) return false;
    if (!f.clos && closed(b)) return false;
    if (f.types.length && !f.types.some(t => norm(t) === norm(b.type))) return false;
    if (f.villes.length && !f.villes.some(v => norm(v) === norm(b.ville))) return false;
    const prix = num(b.prix);
    if (f.prixMin && !(prix >= f.prixMin)) return false;
    if (f.prixMax && !(prix && prix <= f.prixMax)) return false;
    const s = num(b.surface);
    if (f.surfMin && !(s >= f.surfMin)) return false;
    if (f.surfMax && !(s && s <= f.surfMax)) return false;
    if (f.piecesMin && !(num(b.pieces) >= f.piecesMin)) return false;
    if (f.chambresMin && !(num(b.chambres) >= f.chambresMin)) return false;
    if (f.equip.length) {
      const have = [...(b.equipements || []), b.extra].filter(Boolean).map(norm);
      if (!f.equip.every(e => have.includes(norm(e)))) return false;
    }
    if (f.vv && !b.visiteVirtuelle) return false;
    if (f.q) {
      const hay = norm(`${b.ref} ${b.titre} ${b.ville} ${b.cp} ${b.type}`);
      if (!norm(f.q).split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  };

  const date = (b) => Date.parse(b.publishedAt || b.createdAt || 0) || 0;
  const SORTERS = {
    recent: (a, b) => date(b) - date(a),
    ancien: (a, b) => date(a) - date(b),
    'prix-asc': (a, b) => (num(a.prix) || Infinity) - (num(b.prix) || Infinity),
    'prix-desc': (a, b) => num(b.prix) - num(a.prix),
    'surface-desc': (a, b) => num(b.surface) - num(a.surface),
    'surface-asc': (a, b) => (num(a.surface) || Infinity) - (num(b.surface) || Infinity),
  };

  // Disponibles d'abord ; au sein de chaque groupe, le tri choisi (l'ordre manuel de l'admin sert de départage pour « récent »)
  const apply = (biens, f) => {
    const out = biens.filter(b => matches(b, f));
    const idx = new Map(biens.map((b, i) => [b.id, i]));
    out.sort((a, b) => (closed(a) - closed(b)) || (f.sort === 'recent' ? idx.get(a.id) - idx.get(b.id) : SORTERS[f.sort](a, b)));
    return out;
  };

  // Valeurs proposées dans les filtres, d'après les biens de la transaction choisie
  const facets = (biens, f) => {
    const base = biens.filter(b => (b.transaction || 'vente') === f.transaction && (f.clos || !closed(b)));
    const count = (arr) => { const m = new Map(); arr.forEach(x => m.set(x, (m.get(x) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'fr')); };
    return {
      villes: count(base.map(b => b.ville).filter(Boolean)).sort((a, b) => a[0].localeCompare(b[0], 'fr')),
      types: count(base.map(b => b.type).filter(Boolean)),
      equip: count(base.flatMap(b => [...new Set([...(b.equipements || []), b.extra].filter(Boolean).map(x => x.trim()))])).slice(0, 14),
      transactions: { vente: biens.filter(b => (b.transaction || 'vente') === 'vente' && !closed(b)).length, location: biens.filter(b => b.transaction === 'location' && !closed(b)).length },
      vv: biens.filter(b => b.visiteVirtuelle).length,
    };
  };

  return { parse, toQuery, matches, apply, facets, norm, num, closed };
})();
