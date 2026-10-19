// Envoi des formulaires du site vers l'API (/api/leads), partagé par toutes les pages.
// La validation est faite deux fois : ici pour aider la personne, et sur le serveur pour la sécurité.
window.SiteForms = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
  const PHONE_RE = /^(\+33|0033|0)[1-9]\d{8}$|^\+\d{8,15}$/;
  const cleanPhone = (s) => String(s || '').replace(/[\s.\-()]/g, '');

  // Heure d'ouverture du formulaire : les robots envoient instantanément
  const opened = new WeakMap();
  const touch = (form) => { if (!opened.has(form)) opened.set(form, Date.now()); };
  document.addEventListener('focusin', (e) => { const f = e.target.closest?.('form'); if (f) touch(f); });

  // Affiche (ou efface) le message d'erreur sous un champ
  function setError(input, msg) {
    const field = input?.closest('.field, .consent, .vf, .vf-consent, .choices') || input;
    if (!field) return;
    field.classList.toggle('is-error', Boolean(msg));
    let el = field.querySelector(':scope > .err');
    if (msg) {
      if (!el) { el = document.createElement('small'); el.className = 'err'; el.setAttribute('role', 'alert'); field.appendChild(el); }
      el.textContent = msg;
      input.setAttribute?.('aria-invalid', 'true');
    } else {
      el?.remove();
      input.removeAttribute?.('aria-invalid');
    }
  }

  // Règles communes : nom, téléphone, e-mail, consentement
  function checkContact(form, { requireTel = false, requireEmail = false, requireName = true } = {}) {
    const errs = {};
    const nom = form.elements.nom, tel = form.elements.tel, email = form.elements.email, consent = form.elements.consent;
    if (requireName && nom && nom.value.trim().length < 2) errs.nom = 'Indiquez votre nom';
    if (tel && tel.value.trim() && !PHONE_RE.test(cleanPhone(tel.value))) errs.tel = 'Numéro invalide (ex. 06 12 34 56 78)';
    if (email && email.value.trim() && !EMAIL_RE.test(email.value.trim())) errs.email = 'Adresse e-mail invalide';
    if (requireTel && tel && !tel.value.trim()) errs.tel = 'Le téléphone est nécessaire';
    if (requireEmail && email && !email.value.trim()) errs.email = 'L’e-mail est nécessaire';
    if (!requireTel && !requireEmail && tel && email && !tel.value.trim() && !email.value.trim()) errs.tel = 'Indiquez un téléphone ou un e-mail';
    if (consent && !consent.checked) errs.consent = 'Votre accord est nécessaire pour traiter la demande';
    return errs;
  }

  function showErrors(form, errs) {
    [...form.querySelectorAll('.is-error')].forEach(f => { f.classList.remove('is-error'); f.querySelector(':scope > .err')?.remove(); });
    Object.entries(errs).forEach(([name, msg]) => {
      const el = form.elements[name];
      setError(el instanceof RadioNodeList ? el[0] : el, msg);
    });
    const first = form.querySelector('.is-error input, .is-error select, .is-error textarea');
    first?.focus({ preventScroll: false });
    return !Object.keys(errs).length;
  }

  async function submit(form, payload) {
    touch(form);
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-requested-with': 'site' },
      body: JSON.stringify({
        ...payload,
        consent: Boolean(form.elements.consent?.checked),
        website: form.elements.website?.value || '',
        startedAt: opened.get(form) || Date.now() - 5000,
        source: location.pathname + location.hash,
        origine: (() => { try { return document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch { return ''; } })(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.errors) showErrors(form, data.errors);
      throw new Error(data.error || 'Envoi impossible. Réessayez ou appelez-nous.');
    }
    return data;
  }

  // Photos jointes (estimation) : réduites à 1600 px et converties en JPEG avant l'envoi
  const resize = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('Image illisible'))), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });

  async function uploadPhoto(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Format accepté : JPEG, PNG ou WebP');
    const blob = await resize(file);
    const res = await fetch('/api/leads/photo', { method: 'POST', headers: { 'content-type': blob.type, 'x-requested-with': 'site' }, body: blob });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Envoi de la photo impossible');
    return data;
  }

  // Message de confirmation affiché après l'envoi
  const confirmation = (code, emailSent) => `
    <p>${emailSent ? 'Un e-mail de confirmation vient de vous être envoyé.' : 'Votre demande est enregistrée.'} Un membre de l’équipe vous recontacte rapidement.</p>
    ${code ? `<p class="track-code">Votre code de suivi : <strong>${esc(code)}</strong><br><a href="/espace-client.html#suivi">Suivre ma demande</a></p>` : ''}`;

  return { submit, showErrors, checkContact, setError, uploadPhoto, confirmation, esc };
})();
