// Galerie photos plein écran, partagée par les pages du site.
// Usage : AEIGallery.open(photos, { titre, meta, vendu }, indexDeDepart)
window.AEIGallery = (() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  document.body.insertAdjacentHTML('beforeend', `
<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Photos du bien" hidden>
  <div class="lb__top">
    <div><p class="lb__title"></p><p class="lb__meta"></p></div>
    <div class="lb__actions">
      <a href="#contact" class="btn btn--gold btn--sm lb__cta">Demander une visite</a>
      <button type="button" class="lb__close" aria-label="Fermer la galerie">✕</button>
    </div>
  </div>
  <div class="lb__stage">
    <button type="button" class="lb__nav lb__prev" aria-label="Photo précédente">←</button>
    <img class="lb__img" alt="">
    <button type="button" class="lb__nav lb__next" aria-label="Photo suivante">→</button>
  </div>
  <div class="lb__bottom">
    <span class="lb__count"></span>
    <div class="lb__thumbs"></div>
  </div>
</div>`);

  const lb = $('#lightbox');
  const img = $('.lb__img', lb);
  let photos = [], index = 0, lastFocus = null;

  const show = (i, dir = 0) => {
    index = (i + photos.length) % photos.length;
    img.classList.remove('is-in');
    img.style.setProperty('--from', `${dir * 40}px`);
    img.onload = () => requestAnimationFrame(() => img.classList.add('is-in'));
    img.src = photos[index];
    img.alt = `Photo ${index + 1} sur ${photos.length}`;
    $('.lb__count', lb).textContent = `${index + 1} / ${photos.length}`;
    $$('.lb__thumbs button', lb).forEach((t, n) => {
      t.classList.toggle('is-active', n === index);
      if (n === index) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
    });
    if (photos.length > 1) new Image().src = photos[(index + 1) % photos.length]; // précharge la suivante
  };

  const open = (list, info = {}, start = 0) => {
    photos = list.filter(Boolean);
    if (!photos.length) return;
    $('.lb__title', lb).textContent = info.titre || '';
    $('.lb__meta', lb).textContent = info.meta || '';
    $('.lb__cta', lb).hidden = !!info.vendu;
    $('.lb__thumbs', lb).innerHTML = photos.length > 1
      ? photos.map((p, n) => `<button type="button" data-n="${n}" aria-label="Photo ${n + 1}"><img src="${esc(p)}" alt=""></button>`).join('')
      : '';
    lb.classList.toggle('is-single', photos.length < 2);
    lastFocus = document.activeElement;
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    show(start);
    $('.lb__close', lb).focus();
  };

  const close = () => {
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { lb.hidden = true; img.removeAttribute('src'); }, reduced ? 0 : 400);
    lastFocus?.focus();
  };

  $('.lb__close', lb).addEventListener('click', close);
  $('.lb__prev', lb).addEventListener('click', () => show(index - 1, -1));
  $('.lb__next', lb).addEventListener('click', () => show(index + 1, 1));
  $('.lb__thumbs', lb).addEventListener('click', (e) => {
    const t = e.target.closest('button[data-n]');
    if (t) show(+t.dataset.n, +t.dataset.n > index ? 1 : -1);
  });
  $('.lb__cta', lb).addEventListener('click', close);
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb__stage')) close(); });

  addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight' && photos.length > 1) show(index + 1, 1);
    if (e.key === 'ArrowLeft' && photos.length > 1) show(index - 1, -1);
    if (e.key === 'Tab') { // garde le focus dans la galerie
      const f = $$('button, a', lb).filter(el => !el.hidden && el.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });

  // balayage au doigt
  let touchX = null;
  $('.lb__stage', lb).addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $('.lb__stage', lb).addEventListener('touchend', (e) => {
    if (touchX === null || photos.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    touchX = null;
  });

  return { open, close };
})();
