(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const KEY = 'aei-admin-pw';

  let password = '';
  let biens = [];
  let editing = null; // id du bien en cours de modification, null = nouveau
  let photoUrl = '';
  let filter = 'all';

  const store = {
    get() { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } },
    set(v) { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch {} },
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastTimer;
  const toast = (msg, error = false) => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('is-error', error);
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 3200);
  };

  const api = async (path, opts = {}) => {
    const res = await fetch(path, {
      ...opts,
      headers: { ...(opts.headers || {}), authorization: `Bearer ${password}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/api/login') { logout(); throw new Error('Session expirée, reconnectez-vous'); }
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  };

  // ---------- Connexion ----------
  const showApp = async () => {
    $('#login').hidden = true;
    $('#app').hidden = false;
    await load();
  };
  const logout = () => {
    password = '';
    store.set('');
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#password').value = '';
  };

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginForm button[type=submit]');
    const err = $('#loginError');
    err.hidden = true;
    btn.disabled = true;
    password = $('#password').value;
    try {
      await api('/api/login', { method: 'POST' });
      store.set(password);
      await showApp();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
  $('#logout').addEventListener('click', logout);

  // ---------- Liste ----------
  const load = async () => {
    try {
      const res = await fetch('/api/biens', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      biens = await res.json();
      render();
    } catch {
      $('#summary').textContent = 'Impossible de charger les biens.';
    }
  };

  const render = () => {
    const q = $('#search').value.trim().toLowerCase();
    const enVente = biens.filter(b => !b.vendu).length;
    $('#summary').textContent = `${biens.length} biens · ${enVente} en vente · ${biens.length - enVente} vendus`;

    const rows = biens
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => filter === 'all' || (filter === 'vendu' ? b.vendu : !b.vendu))
      .filter(({ b }) => !q || `${b.titre} ${b.ville} ${b.cp}`.toLowerCase().includes(q));

    $('#list').innerHTML = rows.length ? rows.map(({ b, i }, n) => `
      <li class="item" style="animation-delay:${Math.min(n, 10) * 30}ms">
        ${b.photo ? `<img class="item__img" src="${esc(b.photo)}" alt="" loading="lazy">` : '<div class="item__img"></div>'}
        <div>
          <p class="item__title">${esc(b.titre)}${b.vendu ? '<span class="pill pill--sold">Vendu</span>' : b.badge ? `<span class="pill">${esc(b.badge)}</span>` : ''}</p>
          <p class="item__meta">${esc([b.ville, b.cp].filter(Boolean).join(' · '))}${b.surface ? ` · ${esc(b.surface)} m²` : ''}</p>
        </div>
        <span class="item__price">${b.vendu ? '' : b.prix ? esc(b.prix) + ' €' : '—'}</span>
        <div class="item__actions">
          <button class="icon-btn" data-up="${i}" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-down="${i}" aria-label="Descendre" ${i === biens.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn" data-edit="${esc(b.id)}" aria-label="Modifier">✎</button>
        </div>
      </li>`).join('')
      : '<li class="empty">Aucun bien ne correspond.</li>';
  };

  $('#search').addEventListener('input', render);
  $$('.seg button').forEach(b => b.addEventListener('click', () => {
    $$('.seg button').forEach(x => x.classList.toggle('is-active', x === b));
    filter = b.dataset.f;
    render();
  }));

  const save = async (next, msg) => {
    const prev = biens;
    biens = next;
    render();
    try {
      biens = await api('/api/biens', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next),
      });
      render();
      toast(msg);
      return true;
    } catch (e) {
      biens = prev;
      render();
      toast(e.message, true);
      return false;
    }
  };

  $('#list').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.edit) return openForm(biens.find(b => b.id === btn.dataset.edit));
    const move = (from, to) => {
      const next = [...biens];
      next.splice(to, 0, next.splice(from, 1)[0]);
      save(next, 'Ordre mis à jour');
    };
    if (btn.dataset.up) move(+btn.dataset.up, +btn.dataset.up - 1);
    if (btn.dataset.down) move(+btn.dataset.down, +btn.dataset.down + 1);
  });

  // ---------- Formulaire ----------
  const form = $('#bienForm');
  const drawer = $('#drawer');

  const setPhoto = (url) => {
    photoUrl = url || '';
    $('#photoPreview').src = photoUrl;
    $('#photoPreview').hidden = !photoUrl;
    $('#photoEmpty').hidden = !!photoUrl;
  };

  const openForm = (b = null) => {
    editing = b ? b.id : null;
    form.reset();
    $$('.field', form).forEach(f => f.classList.remove('is-error'));
    $('#formTitle').textContent = b ? 'Modifier le bien' : 'Ajouter un bien';
    $('#deleteBtn').hidden = !b;
    if (b) {
      for (const k of ['titre', 'ville', 'cp', 'prix', 'region', 'surface', 'chambres', 'terrain', 'badge', 'extra']) form.elements[k].value = b[k] ?? '';
      form.elements.vendu.checked = !!b.vendu;
    }
    setPhoto(b?.photo);
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    setTimeout(() => form.elements.titre.focus(), 300);
  };
  const closeForm = () => {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  };

  $('#addBtn').addEventListener('click', () => openForm());
  $$('[data-close]', drawer).forEach(el => el.addEventListener('click', closeForm));
  addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeForm(); });

  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let ok = true;
    for (const name of ['titre', 'ville']) {
      const input = form.elements[name];
      const bad = !input.value.trim();
      input.closest('.field').classList.toggle('is-error', bad);
      if (bad) ok = false;
    }
    if (!ok) return toast('Le titre et la ville sont obligatoires', true);
    if (!$('#photoBusy').hidden) return toast('Patientez, la photo est en cours d’envoi', true);

    const data = Object.fromEntries(['titre', 'ville', 'cp', 'prix', 'region', 'surface', 'chambres', 'terrain', 'badge', 'extra'].map(k => [k, form.elements[k].value.trim()]));
    data.vendu = form.elements.vendu.checked;
    data.photo = photoUrl;

    const btn = $('#saveBtn');
    btn.disabled = true;
    let next;
    if (editing) {
      next = biens.map(b => b.id === editing ? { ...b, ...data } : b);
    } else {
      data.id = `${slug(data.ville)}-${Date.now().toString(36)}`;
      next = [data, ...biens]; // les nouveaux biens apparaissent en premier
    }
    const saved = await save(next, editing ? 'Bien mis à jour' : 'Bien ajouté au site');
    btn.disabled = false;
    if (saved) closeForm();
  });

  $('#deleteBtn').addEventListener('click', async () => {
    const b = biens.find(x => x.id === editing);
    if (!b || !confirm(`Supprimer « ${b.titre} » du site ?`)) return;
    if (await save(biens.filter(x => x.id !== editing), 'Bien supprimé')) closeForm();
  });

  // ---------- Photo : redimensionnée et convertie en WebP avant envoi ----------
  const resize = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1600;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('Conversion impossible')), 'image/webp', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });

  const upload = async (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Format accepté : JPEG, PNG ou WebP', true);
    $('#photoBusy').hidden = false;
    try {
      const blob = await resize(file);
      const { url } = await api('/api/upload', { method: 'POST', headers: { 'content-type': blob.type }, body: blob });
      setPhoto(url);
      toast('Photo ajoutée');
    } catch (e) {
      toast(e.message, true);
    } finally {
      $('#photoBusy').hidden = true;
      $('#photoInput').value = '';
    }
  };

  const zone = $('#photoZone');
  $('#photoInput').addEventListener('change', e => upload(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach(t => zone.addEventListener(t, () => zone.classList.remove('is-drag')));
  zone.addEventListener('drop', e => { e.preventDefault(); upload(e.dataTransfer.files[0]); });

  // ---------- Démarrage ----------
  password = store.get();
  if (password) {
    api('/api/login', { method: 'POST' }).then(showApp).catch(logout);
  }
})();
