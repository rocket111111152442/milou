(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const { esc, cardHTML } = window.AEICards;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const f = (name) => $(`[data-f="${name}"]`);
  const block = (name) => $(`[data-block="${name}"]`);
  const num = (s) => Number(String(s ?? '').replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.')) || 0;
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');

  $('#year').textContent = new Date().getFullYear();

  // ---------- En-tête, menu, barre de progression ----------
  const header = $('.header');
  const progress = $('.progress');
  const mobileBar = $('.mobile-bar');
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    header.classList.toggle('is-hidden', y > 400 && y > lastY && !document.body.classList.contains('menu-open'));
    mobileBar.classList.toggle('is-visible', y > 300);
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });

  const burger = $('.burger');
  const toggleMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    $('.mobile-menu').setAttribute('aria-hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => toggleMenu(!document.body.classList.contains('menu-open')));
  $$('.mobile-menu a').forEach(a => a.addEventListener('click', () => toggleMenu(false)));

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });

  // ---------- Rendu de la fiche ----------
  const ICONS = {
    surface: '<svg viewBox="0 0 32 32"><rect x="5" y="5" width="22" height="22"/><path d="M5 12h7M20 27v-7"/></svg>',
    pieces: '<svg viewBox="0 0 32 32"><rect x="4" y="6" width="24" height="20"/><path d="M16 6v20M4 16h12"/></svg>',
    chambres: '<svg viewBox="0 0 32 32"><path d="M4 24V10M4 18h24v6M28 24v-6a4 4 0 0 0-4-4H14v4"/><circle cx="9" cy="14" r="2.5"/></svg>',
    terrain: '<svg viewBox="0 0 32 32"><path d="M3 26 13 13l6 7 4-4 6 10z"/><circle cx="23" cy="8" r="3"/></svg>',
    eau: '<svg viewBox="0 0 32 32"><path d="M5 16h22v3a7 7 0 0 1-7 7h-8a7 7 0 0 1-7-7z"/><path d="M8 16V7a3 3 0 0 1 6 0"/></svg>',
  };

  const DPE = { A: '#009c6d', B: '#52b153', C: '#78bd76', D: '#f4e70f', E: '#f0b50f', F: '#eb8235', G: '#d7221f' };
  const GES = { A: '#a3dbfc', B: '#8ab5d2', C: '#7692b1', D: '#5e6f8f', E: '#4d4d6f', F: '#393551', G: '#281b35' };
  const scaleHTML = (title, sub, colors, active, value, unit) => `
    <div class="scale">
      <h3>${title}</h3><p>${sub}</p>
      <ol>${Object.keys(colors).map((l, i) => `
        <li class="${l === active ? 'is-active' : ''}">
          <b style="background:${colors[l]};--w:${34 + i * 9}%;color:${['D', 'E'].includes(l) && colors === DPE ? '#3a2a00' : '#fff'}">${l}</b>
          ${l === active && value ? `<em>${esc(value)} ${unit}</em>` : ''}
        </li>`).join('')}
      </ol>
    </div>`;

  const paragraphs = (text) => esc(text).split(/\n{2,}|\n/).filter(Boolean).map(p => `<p>${p}</p>`).join('');
  const row = (label, value) => value ? `<div><dt>${label}</dt><dd>${value}</dd></div>` : '';
  const plural = (n, word) => `${n} ${word}${num(n) > 1 ? 's' : ''}`;

  const render = (b, all) => {
    const photos = b.photos?.length ? b.photos : b.photo ? [b.photo] : [];
    const prix = b.vendu ? 'Vendu' : b.prix ? `${b.prix} €` : 'Prix sur demande';
    const where = [b.ville, b.cp && `(${b.cp})`].filter(Boolean).join(' ');

    document.title = `${b.titre} – ${b.ville} | AEI Côté Mer`;
    $('meta[name="description"]').setAttribute('content', `${b.type || 'Bien'} à ${b.ville}${b.surface ? `, ${b.surface} m²` : ''}${b.prix && !b.vendu ? `, ${b.prix} €` : ''}. ${String(b.description || '').slice(0, 120)}`);

    f('crumb').textContent = b.ville;
    f('titre').textContent = b.titre;
    f('loc').textContent = [b.type, where].filter(Boolean).join(' · ');
    f('prix').textContent = prix;
    f('prix').classList.toggle('is-sold', !!b.vendu);
    f('ref').textContent = b.ref ? `Réf. ${b.ref}` : '';
    f('prixSide').textContent = b.vendu ? '' : prix;
    const tags = [];
    if (b.vendu) tags.push('<span class="tag tag--sold">Vendu</span>');
    else if (b.badge) tags.push(`<span class="tag ${b.badge === 'Exclusivité' ? 'tag--gold' : b.badge === 'Coup de cœur' ? 'tag--light' : ''}">${esc(b.badge)}</span>`);
    f('tags').innerHTML = tags.join('');

    // Mosaïque : jusqu'à 5 photos, la galerie complète au clic
    const shown = photos.slice(0, 5);
    const mosaic = f('mosaic');
    mosaic.className = `mosaic mosaic--${Math.min(shown.length, 5)}${b.vendu ? ' mosaic--sold' : ''}`;
    mosaic.innerHTML = shown.map((p, i) => `<button type="button" data-i="${i}" aria-label="Agrandir la photo ${i + 1}"><img src="${esc(p)}" alt="${esc(b.titre)} – photo ${i + 1}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}></button>`).join('')
      + (photos.length > 1 ? `<button type="button" class="mosaic__all"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Voir les ${photos.length} photos</button>` : '');
    if (!shown.length) mosaic.hidden = true;
    const info = { titre: b.titre, meta: [b.ville, prix].join(' · '), vendu: b.vendu };
    mosaic.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      window.AEIGallery.open(photos, info, btn.classList.contains('mosaic__all') ? 0 : +btn.dataset.i);
    });

    const eaux = [b.sdb && plural(b.sdb, 'salle') + ' de bains', b.sde && plural(b.sde, 'salle') + " d'eau"].filter(Boolean).join(' · ');
    const facts = [
      b.surface && [ICONS.surface, `${esc(b.surface)} m²`, 'Surface habitable'],
      b.pieces && [ICONS.pieces, esc(b.pieces), 'Pièces'],
      b.chambres && [ICONS.chambres, esc(b.chambres), 'Chambres'],
      b.terrain && [ICONS.terrain, `${esc(b.terrain)} m²`, 'Terrain'],
      eaux && [ICONS.eau, num(b.sdb) + num(b.sde) || '', esc(eaux)],
    ].filter(Boolean);
    f('facts').innerHTML = facts.map(([icon, v, l]) => `<li>${icon}<div><strong>${v}</strong><span>${l}</span></div></li>`).join('');
    f('facts').hidden = !facts.length;

    // Description repliée si longue
    const desc = f('description');
    desc.innerHTML = paragraphs(b.description || '');
    block('description').hidden = !b.description;
    requestAnimationFrame(() => {
      if (desc.scrollHeight > 420) {
        desc.classList.add('is-clamped');
        const more = $('.desc__more');
        more.hidden = false;
        more.onclick = () => {
          const open = desc.classList.toggle('is-clamped');
          more.textContent = open ? 'Lire la suite' : 'Réduire';
        };
      }
    });

    const specs = [
      row('Type de bien', esc(b.type)),
      row('Surface habitable', b.surface && `${esc(b.surface)} m²`),
      row('Terrain', b.terrain && `${esc(b.terrain)} m²`),
      row('Pièces', esc(b.pieces)),
      row('Chambres', esc(b.chambres)),
      row('Salles de bains', esc(b.sdb)),
      row("Salles d'eau", esc(b.sde)),
      row('Niveaux', esc(b.niveaux)),
      row('Année de construction', esc(b.annee)),
      row('Cuisine', esc(b.cuisine)),
      row('Chauffage', esc(b.chauffage)),
    ].join('');
    f('specs').innerHTML = specs;
    block('caracteristiques').hidden = !specs;

    f('equipements').innerHTML = (b.equipements || []).map(e => `<li>${esc(e)}</li>`).join('');
    block('equipements').hidden = !b.equipements?.length;

    // Composition regroupée par niveau, dans l'ordre de saisie
    const levels = new Map();
    (b.composition || []).forEach(r => {
      const k = r.niveau || 'Autres pièces';
      if (!levels.has(k)) levels.set(k, []);
      levels.get(k).push(r);
    });
    f('composition').innerHTML = [...levels].map(([lvl, rooms]) => `
      <div class="level"><h3>${esc(lvl)}</h3><ul>${rooms.map(r => `<li>${esc(r.piece)}${r.surface ? `<span>${esc(r.surface)} m²</span>` : ''}</li>`).join('')}</ul></div>`).join('');
    block('composition').hidden = !levels.size;

    // Énergie : obligatoire dans les annonces, "non communiqué" plutôt que caché
    const energy = f('energie');
    if (b.dpe || b.ges) {
      energy.innerHTML = scaleHTML('Consommation énergétique', 'Diagnostic de performance énergétique (DPE)', DPE, b.dpe, b.dpeKwh, 'kWh/m²/an')
        + scaleHTML('Émissions de gaz à effet de serre', 'Indice GES', GES, b.ges, b.gesCo2, 'kg CO₂/m²/an')
        + (b.energieMin && b.energieMax ? `<p class="energy__cost">Montant estimé des dépenses annuelles d'énergie pour un usage standard : entre <strong>${esc(b.energieMin)} €</strong> et <strong>${esc(b.energieMax)} €</strong>${b.energieRef ? ` (prix de l'énergie de référence : ${esc(b.energieRef)})` : ''}.</p>` : '');
      new IntersectionObserver(([e], obs) => {
        if (!e.isIntersecting) return;
        energy.classList.add('is-in');
        $$('.scale li b', energy).forEach((el, i) => setTimeout(() => { el.style.width = el.style.getPropertyValue('--w'); }, reduced ? 0 : i % 7 * 70));
        obs.disconnect();
      }, { threshold: .3 }).observe(energy);
    } else {
      energy.innerHTML = '<p class="energy__cost">Diagnostic de performance énergétique en cours ou non communiqué.</p>';
    }

    const fin = [
      row('Prix de vente', b.vendu ? 'Vendu' : b.prix && `${esc(b.prix)} €`),
      row('Taxe foncière annuelle', b.taxeFonciere && `${esc(b.taxeFonciere)} €`),
      row('Charges de copropriété annuelles', b.chargesCopro && `${esc(b.chargesCopro)} €`),
      row('Nombre de lots en copropriété', esc(b.lotsCopro)),
    ].join('') + (b.honoraires ? `<p class="specs__note">${esc(b.honoraires)}</p>` : '');
    f('financier').innerHTML = fin;
    block('financier').hidden = !fin;

    // Simulateur de prêt
    const simu = $('#simu');
    const price = num(b.prix);
    block('simulateur').hidden = b.vendu || !price;
    if (price) {
      simu.prix.value = fmt(price);
      simu.apport.value = fmt(price * 0.1);
      const out = $('#simuOut');
      let shownVal = 0, raf;
      const compute = () => {
        const capital = Math.max(0, num(simu.prix.value) - num(simu.apport.value));
        const n = +simu.duree.value * 12;
        const r = num(simu.taux.value) / 100 / 12;
        const target = !capital ? 0 : r ? capital * r / (1 - Math.pow(1 + r, -n)) : capital / n;
        cancelAnimationFrame(raf);
        const from = shownVal, t0 = performance.now();
        const tick = (now) => {
          const p = reduced ? 1 : Math.min(1, (now - t0) / 600);
          shownVal = from + (target - from) * (1 - Math.pow(1 - p, 3));
          out.textContent = fmt(shownVal);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      };
      simu.addEventListener('input', compute);
      simu.addEventListener('submit', e => e.preventDefault());
      compute();
    }

    // Carte du secteur (commune, pas l'adresse exacte)
    if (b.ville) {
      f('map').innerHTML = `<iframe title="Carte du secteur : ${esc(b.ville)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(`${b.ville} ${b.cp || ''} France`)}&z=13&output=embed"></iframe>`;
    } else block('quartier').hidden = true;

    // Formulaire pré-rempli
    const form = $('#visitForm');
    form.message.value = b.vendu
      ? `Bonjour, je souhaite vendre un bien similaire à « ${b.titre} » (${b.ville}). Pouvez-vous me recontacter ?`
      : `Bonjour, je suis intéressé(e) par le bien « ${b.titre} » à ${b.ville}${b.ref ? ` (réf. ${b.ref})` : ''} et souhaite organiser une visite.`;
    form.querySelector('button[type=submit]').textContent = b.vendu ? 'Faire estimer mon bien' : 'Demander une visite';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      $$('input[required]', form).forEach(inp => {
        const valid = inp.type === 'checkbox' ? inp.checked : inp.value.trim() !== '';
        inp.closest('.vf')?.classList.toggle('is-error', !valid);
        if (!valid) ok = false;
      });
      if (!ok) return;
      // TODO : brancher sur l'outil de l'agence (CRM, Formspree, e-mail…)
      $('.vf-ok', form).hidden = false;
      $$('input:not([type=checkbox])', form).forEach(i => { i.value = ''; });
    });

    // Partage
    const url = location.href;
    $('[data-share="whatsapp"]').href = `https://wa.me/?text=${encodeURIComponent(`${b.titre} – ${url}`)}`;
    $('[data-share="mail"]').href = `mailto:?subject=${encodeURIComponent(b.titre)}&body=${encodeURIComponent(`Ce bien pourrait vous intéresser : ${url}`)}`;
    $('[data-share="print"]').addEventListener('click', () => print());
    $('[data-share="copy"]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); toast('Lien copié'); } catch { toast(url); }
    });

    // Biens similaires : même secteur d'abord, en vente uniquement
    const others = all.filter(x => x.id !== b.id && !x.vendu);
    const similar = [...others.filter(x => x.region === b.region), ...others.filter(x => x.region !== b.region)].slice(0, 3);
    f('similaires').innerHTML = similar.map(cardHTML).join('');
    block('similaires').hidden = !similar.length;

    // Données structurées pour les moteurs de recherche
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Offer',
      name: b.titre,
      description: b.description,
      image: photos.map(p => new URL(p, location.href).href),
      price: price || undefined,
      priceCurrency: 'EUR',
      availability: b.vendu ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      seller: { '@type': 'RealEstateAgent', name: 'Agence Européenne Immobilière – Côté Mer', telephone: '+33494072635' },
      itemOffered: {
        '@type': b.type === 'Appartement' ? 'Apartment' : 'SingleFamilyResidence',
        address: { '@type': 'PostalAddress', addressLocality: b.ville, postalCode: b.cp, addressCountry: 'FR' },
        floorSize: b.surface ? { '@type': 'QuantitativeValue', value: num(b.surface), unitCode: 'MTK' } : undefined,
        numberOfRooms: num(b.pieces) || undefined,
      },
    });
    document.head.appendChild(ld);

    $('#ficheLoading').hidden = true;
    $('#fiche').hidden = false;
    $$('.reveal, .block, .similar .bien').forEach((el, i) => {
      if (!el.classList.contains('reveal')) el.classList.add('reveal');
      io.observe(el);
    });
    onScroll();
  };

  let toastEl;
  const toast = (msg) => {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast-mini'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    setTimeout(() => toastEl.classList.remove('is-on'), 2200);
  };

  const missing = () => {
    $('#ficheLoading').hidden = true;
    $('#ficheMissing').hidden = false;
    document.title = 'Bien introuvable | AEI Côté Mer';
  };

  const load = async () => {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return missing();
    for (const url of ['/api/biens', 'data/biens.json']) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const all = await res.json();
        if (!Array.isArray(all)) continue;
        const b = all.find(x => x.id === id);
        return b ? render(b, all) : missing();
      } catch {}
    }
    missing();
  };
  load();
})();
