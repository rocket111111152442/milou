// Comportements communs des pages secondaires : en-tête, menu mobile, barre de progression, apparitions
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  const header = $('.header');
  const progress = $('.progress');
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    header?.classList.toggle('is-hidden', y > 400 && y > lastY && !document.body.classList.contains('menu-open'));
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });

  const burger = $('.burger');
  const toggleMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    burger?.setAttribute('aria-expanded', open);
    $('.mobile-menu')?.setAttribute('aria-hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger?.addEventListener('click', () => toggleMenu(!document.body.classList.contains('menu-open')));
  $$('.mobile-menu a').forEach(a => a.addEventListener('click', () => toggleMenu(false)));

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { threshold: .1 });
  $$('.reveal').forEach(el => io.observe(el));
})();
