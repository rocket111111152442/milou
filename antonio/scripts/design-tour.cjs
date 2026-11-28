// Captures de toutes les pages (ordinateur + téléphone) pour la revue visuelle.
// Usage : SHOTS_DIR=dossier [TAG=avant] node scripts/design-tour.cjs  (API :8787 et Vite :5173 lancés)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const B = process.env.BASE_URL || 'http://localhost:5173';
const OUT = process.env.SHOTS_DIR || 'screenshots';
const TAG = process.env.TAG || 'shot';
fs.mkdirSync(OUT, { recursive: true });
const ROUTES = ['/app', '/point', '/messages', '/agenda', '/taches', '/validations', '/historique', '/modeles', '/regles', '/connexions', '/integrations', '/profil', '/consommation', '/abonnement'];
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const setup = await browser.newContext();
  const email = `design${Date.now()}@test.example`;
  const H = { Origin: B, 'Content-Type': 'application/json' };
  let r = await setup.request.post(B + '/api/auth/register', { headers: H, data: { email, password: 'motdepasse-solide', displayName: 'Camille Durand', withDemo: true } });
  if (!r.ok()) throw new Error('register ' + r.status() + ' ' + (await r.text()));
  await setup.request.put(B + '/api/profile', { headers: H, data: { firstName: 'Camille', company: 'Atelier Durand', jobRole: 'Gérante' } });
  r = await setup.request.post(B + '/api/onboarding/complete', { headers: H, data: {} }); if (!r.ok()) throw new Error('onboarding ' + r.status() + ' ' + (await r.text()));
  for (const t of ['Fais-moi le point sur ma journée', 'Montre-moi le mail de Sophie', 'Propose-lui un créneau jeudi après-midi']) {
    await setup.request.post(B + '/api/assistant/message', { headers: H, data: { text: t } });
  }
  const state = await setup.storageState();
  const fresh = await browser.newContext();
  await fresh.request.post(B + '/api/auth/register', { headers: H, data: { email: 'o' + email, password: 'motdepasse-solide', displayName: 'Léa Martin' } });
  const freshState = await fresh.storageState();
  const views = [['desk', { viewport: { width: 1440, height: 900 } }], ['mob', devices['iPhone 13']]];
  for (const [name, opts] of views) {
    const anon = await browser.newContext({ ...opts, locale: 'fr-FR' });
    for (const [p, slug] of [['/', 'landing'], ['/connexion', 'connexion'], ['/inscription', 'inscription']]) {
      const pg = await anon.newPage(); pg.on('pageerror', e => errors.push(`${p}: ${e}`));
      await pg.goto(B + p, { waitUntil: 'networkidle' }); await pg.waitForTimeout(900);
      await pg.screenshot({ path: `${OUT}/${TAG}-${name}-${slug}.png`, fullPage: slug === 'landing' && name === 'desk' ? false : false });
      if (slug === 'landing') { await pg.evaluate(() => window.scrollTo(0, 1400)); await pg.waitForTimeout(900); await pg.screenshot({ path: `${OUT}/${TAG}-${name}-landing2.png` }); }
      await pg.close();
    }
    const onb = await browser.newContext({ ...opts, locale: 'fr-FR', storageState: freshState });
    const op = await onb.newPage(); op.on('pageerror', e => errors.push(`onb: ${e}`));
    await op.goto(B + '/bienvenue', { waitUntil: 'networkidle' }); await op.waitForTimeout(900);
    await op.screenshot({ path: `${OUT}/${TAG}-${name}-bienvenue.png` });
    const ctx = await browser.newContext({ ...opts, locale: 'fr-FR', storageState: state });
    for (const route of ROUTES) {
      const pg = await ctx.newPage(); pg.on('pageerror', e => errors.push(`${route}: ${e}`));
      await pg.goto(B + route, { waitUntil: 'networkidle' }); await pg.waitForTimeout(1200);
      await pg.screenshot({ path: `${OUT}/${TAG}-${name}${route.replace(/\//g, '-')}.png` });
      const overflow = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) errors.push(`${name}${route}: débordement horizontal`);
      const menu = await pg.locator('.studio-menu-button').boundingBox();
      if (!menu || menu.x + menu.width > (pg.viewportSize()?.width ?? 0)) errors.push(`${name}${route}: bouton menu hors écran`);
      await pg.close();
    }
  }
  console.log('erreurs :', JSON.stringify(errors, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
