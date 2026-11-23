// Parcours visuel de bout en bout (mode démonstration). Usage : SHOTS_DIR=captures node scripts/ui-smoke.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const SHOTS = process.env.SHOTS_DIR || 'screenshots';
fs.mkdirSync(SHOTS, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  const B = process.env.BASE_URL || 'http://localhost:5173';
  await page.goto(B + '/inscription');
  await page.fill('#dn', 'Camille Durand');
  await page.fill('#em', `camille${Date.now()}@exemple.fr`);
  await page.fill('#pw', 'motdepasse-solide');
  await page.fill('#org', 'Atelier Durand');
  await page.click('button[type=submit]');
  await page.waitForURL('**/bienvenue');
  await page.screenshot({ path: SHOTS + '/01-onboarding.png' });
  // Parcours d'onboarding : on avance jusqu'au récapitulatif.
  for (let i = 0; i < 20; i++) {
    const cont = page.getByRole('button', { name: 'Continuer' });
    if (await cont.count() === 0) break;
    if (i === 2) await page.getByRole('button', { name: 'Consultant·e / indépendant·e' }).click();
    if (i === 6) await page.screenshot({ path: SHOTS + '/02-onboarding-tasks.png' });
    await cont.click();
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: SHOTS + '/03-recap.png', fullPage: true });
  await page.getByRole('button', { name: /Activer/ }).click();
  await page.waitForURL(B + '/');
  await page.waitForTimeout(800);
  await page.screenshot({ path: SHOTS + '/04-workspace-empty.png' });
  const say = async (t) => { await page.fill('#composer', t); await page.keyboard.press('Enter'); await page.waitForTimeout(1800); };
  await say('Fais-moi le point sur ma journée');
  await page.screenshot({ path: SHOTS + '/05-briefing.png' });
  await say('Montre-moi le mail de Sophie');
  await page.screenshot({ path: SHOTS + '/06-mail-sophie.png' });
  await say('Propose-lui un créneau jeudi après-midi');
  await page.waitForTimeout(800);
  await page.screenshot({ path: SHOTS + '/07-slots-reply.png' });
  await say('oui');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SHOTS + '/08-sent.png' });
  await say('Montre-moi le mail de Service comptabilité');
  await page.screenshot({ path: SHOTS + '/09-injection.png' });
  await page.goto(B + '/connexions'); await page.waitForTimeout(800);
  await page.screenshot({ path: SHOTS + '/10-connections.png', fullPage: true });
  await page.goto(B + '/agenda'); await page.waitForTimeout(800);
  await page.screenshot({ path: SHOTS + '/11-agenda.png' });
  // Petit écran
  const m = await browser.newContext({ ...require('playwright').devices['iPhone 13'], locale: 'fr-FR', storageState: await ctx.storageState() });
  const mp = await m.newPage();
  await mp.goto(B + '/');
  await mp.waitForTimeout(1500);
  await mp.screenshot({ path: SHOTS + '/12-mobile-workspace.png', fullPage: true });
  await mp.goto(B + '/validations'); await mp.waitForTimeout(800);
  await mp.screenshot({ path: SHOTS + '/13-mobile-approvals.png' });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log('mobile horizontal overflow:', overflow);
  console.log('console errors:', JSON.stringify(errors.slice(0, 10)));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
