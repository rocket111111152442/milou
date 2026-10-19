// Petits outils d'interface partagés
export const $ = (s, c = document) => c.querySelector(s);
export const $$ = (s, c = document) => [...c.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtDate = (iso, withTime = true) => iso ? new Date(iso).toLocaleString('fr-FR', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }) : '—';
export const fmtNum = (n) => Number(n || 0).toLocaleString('fr-FR');
export const toNumber = (s) => Number(String(s ?? '').replace(/\s/g, '').replace(',', '.')) || 0;
// Les photos d'origine du site sont en chemin relatif (img/…)
export const src = (p) => (/^img\//.test(p || '') ? '/' + p : p || '');

let toastTimer;
export function toast(msg, error = false) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast';
    t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.toggle('is-error', error);
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 3600);
}

// Fenêtre de dialogue : renvoie la valeur du bouton cliqué (null si fermée)
export function modal({ title, html, actions = [{ label: 'OK', value: true, primary: true }] }) {
  const m = $('#modal');
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modalActions').innerHTML = actions.map((a, i) => `<button type="button" class="btn ${a.primary ? (a.danger ? 'btn--danger-fill' : 'btn--red') : 'btn--ghost'}" data-i="${i}">${esc(a.label)}</button>`).join('');
  m.hidden = false;
  const last = document.activeElement;
  $('#modalActions button:last-child').focus();
  return new Promise(resolve => {
    const done = (v) => {
      m.hidden = true;
      m.removeEventListener('click', onClick);
      removeEventListener('keydown', onKey);
      last?.focus?.();
      resolve(v);
    };
    const onClick = (e) => {
      const b = e.target.closest('#modalActions button');
      if (b) done(actions[+b.dataset.i].value);
      else if (e.target === m) done(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') done(null); };
    m.addEventListener('click', onClick);
    addEventListener('keydown', onKey);
  });
}

export const confirmDialog = (title, text, label = 'Confirmer', danger = true) =>
  modal({ title, html: `<p>${esc(text)}</p>`, actions: [{ label: 'Annuler', value: false }, { label, value: true, primary: true, danger }] });

// Affiche les erreurs renvoyées par l'API à côté des champs concernés
export function showFieldErrors(form, errors = {}) {
  $$('.field', form).forEach(f => { f.classList.remove('is-error'); $('.field__err', f)?.remove(); });
  Object.entries(errors).forEach(([name, msg]) => {
    const field = form.elements[name]?.closest?.('.field');
    if (!field) return;
    field.classList.add('is-error');
    field.insertAdjacentHTML('beforeend', `<small class="field__err">${esc(msg)}</small>`);
  });
}

export function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Patientez…'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}

export function openDrawer(el) { el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
export function closeDrawer(el) { el.classList.remove('is-open'); el.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
