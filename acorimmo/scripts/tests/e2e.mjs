// Tests de bout en bout (site public + admin) avec captures d'écran.
// Usage : BASE=http://localhost:3000 OUT=dossier ADMIN_EMAIL=… ADMIN_PASSWORD=… NEW_PASSWORD=… node scripts/tests/e2e.mjs [public|forms|admin|all]
// « public » est en lecture seule (utilisable en production) ; « forms » et « admin » écrivent des données : en local uniquement.
// Regarder les captures produites dans OUT : certains défauts ne se voient que là.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
// Playwright n'est pas une dépendance du site : installé localement (npm i -D playwright) ou globalement
const require = createRequire(import.meta.url);
const pw = (() => { try { return require('playwright'); } catch { return createRequire(process.env.PLAYWRIGHT_GLOBAL || '/opt/node22/lib/node_modules/')('playwright'); } })();
const { chromium, devices } = pw;
const LAUNCH = { args: ['--no-sandbox'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) };

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = process.env.OUT || './shots';
const MODE = process.argv[2] || 'all';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ' — ' + detail : ''}`); };
const shot = async (page, name, full = true) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });

const browser = await chromium.launch(LAUNCH);
const errors = [];
const watch = (page, tag) => {
  page.on('pageerror', e => errors.push(`${tag} JS : ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_TUNNEL|net::ERR/.test(m.text())) errors.push(`${tag} console : ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes('/api/auth/me') && !r.url().includes('google')) errors.push(`${tag} HTTP ${r.status()} ${r.url().replace(BASE, '')}`); });
};

// Fait défiler toute la page (déclenche le chargement paresseux et les animations d'apparition)
const scrollAll = async (page) => {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 150)); }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(800);
};
const brokenImages = (page, sel = 'img') => page.$$eval(sel, imgs => imgs.filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map(i => i.getAttribute('src')));
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

async function publicTests(ctxOpts, tag) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  watch(page, tag);

  // Accueil
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  await shot(page, `${tag}-01-accueil-haut`, false);
  await scrollAll(page);
  const cards = await page.$$eval('#gridBiens .bien', els => els.length);
  check(`${tag} accueil : sélection de biens affichée (≤ 9)`, cards > 0 && cards <= 9, `${cards} cartes`);
  const voirTout = await page.$eval('#voirTout', a => (a.hidden ? '' : a.textContent));
  check(`${tag} accueil : lien « Voir tous les biens »`, /\(\d+\)/.test(voirTout), voirTout);
  check(`${tag} accueil : aucune image cassée`, (await brokenImages(page)).length === 0, (await brokenImages(page)).join(', '));
  check(`${tag} accueil : pas de défilement horizontal`, await noHScroll(page));
  const statBiens = await page.$eval('#statBiens', e => e.dataset.to);
  check(`${tag} accueil : compteur de biens en ligne`, Number(statBiens) > 100, statBiens);
  const avisVisible = await page.$eval('#avis', e => !e.hidden);
  check(`${tag} accueil : bloc avis affiché`, avisVisible, await page.$eval('#avisSub', e => e.textContent));
  await shot(page, `${tag}-02-accueil-complet`);
  // Filtre « À louer »
  await page.click('.filters button[data-filter="location"]');
  await page.waitForTimeout(600);
  const rent = await page.$$eval('#gridBiens .bien', els => els.map(e => e.querySelector('.tag--rent') ? 1 : 0));
  check(`${tag} accueil : filtre « À louer »`, rent.length > 0 && rent.every(Boolean), `${rent.length} cartes`);

  // Recherche depuis l'accueil
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.selectOption('.search select[name="type"]', 'Appartement');
  await page.fill('.search input[name="ville"]', 'Toulon');
  await page.click('.search__submit');
  await page.waitForURL(/\/biens/);
  await page.waitForTimeout(1500);
  const url = page.url();
  const resCards = await page.$$eval('.bien', els => els.length);
  const resVilles = await page.$$eval('.bien .bien__loc', els => els.map(e => e.textContent));
  check(`${tag} recherche : Appartement + Toulon`, /type=Appartement/.test(url) && resCards > 0 && resVilles.every(v => /Toulon/i.test(v)), `${resCards} résultats, ${url.replace(BASE, '')}`);
  check(`${tag} recherche : pas de défilement horizontal`, await noHScroll(page));
  await scrollAll(page);
  check(`${tag} recherche : aucune image cassée`, (await brokenImages(page)).length === 0);
  await shot(page, `${tag}-03-recherche`);
  // Filtres avancés de /biens par l'adresse
  await page.goto(BASE + '/biens?type=Maison%7CVilla&prixMax=600000&chambresMin=3&sort=prix-desc', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const prix = await page.$$eval('.bien .bien__foot strong', els => els.map(e => Number(e.textContent.replace(/[^\d]/g, ''))));
  check(`${tag} /biens : filtres prix ≤ 600 000 et tri décroissant`, prix.length > 0 && prix.every(p => p <= 600000) && prix.every((p, i) => !i || prix[i - 1] >= p), `${prix.length} biens`);
  await shot(page, `${tag}-04-biens-filtres`, false);

  // Fiche d'un bien avec photos (page rendue côté serveur)
  const id = await page.$eval('.bien', e => e.dataset.id);
  await page.goto(`${BASE}/bien/${id}`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const html = await page.content();
  check(`${tag} fiche : titre et données structurées dans le HTML serveur`, /application\/ld\+json/.test(html) && /og:title/.test(html));
  await scrollAll(page);
  const mosaic = await page.$$eval('.mosaic img', imgs => imgs.filter(i => i.offsetParent !== null).map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth })));
  check(`${tag} fiche : photos affichées`, mosaic.length > 0 && mosaic.every(m => m.w > 0 && m.src.startsWith('/')), mosaic.map(m => `${m.src.slice(-20)}:${m.w}px`).join(' '));
  check(`${tag} fiche : aucune image cassée`, (await brokenImages(page)).length === 0, (await brokenImages(page)).join(', '));
  check(`${tag} fiche : pas de défilement horizontal`, await noHScroll(page));
  await shot(page, `${tag}-05-fiche`);
  // Galerie plein écran
  await page.click('.mosaic button');
  await page.waitForTimeout(800);
  const lbImg = await page.$eval('.lb__img', i => i.naturalWidth).catch(() => 0);
  check(`${tag} fiche : galerie plein écran`, lbImg > 0, `${lbImg}px`);
  await shot(page, `${tag}-06-galerie`, false);
  await page.keyboard.press('Escape');
  // Visite virtuelle (lien externe Previsite) et partage
  const vv = await page.$eval('[data-block="visite"]', e => (e.hidden ? '' : e.textContent.trim())).catch(() => '');
  check(`${tag} fiche : visite virtuelle proposée`, /Visite virtuelle/.test(vv), vv.slice(0, 60));
  const share = await page.$$eval('[data-share]', els => els.map(e => e.dataset.share).join(','));
  check(`${tag} fiche : boutons de partage et impression`, /whatsapp/.test(share) && /print/.test(share), share);

  // Page commune
  await page.goto(BASE + '/immobilier/six-fours-les-plages', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await scrollAll(page);
  const villeCards = await page.$$eval('.bien', els => els.length);
  const intro = await page.$eval('.ville', e => e.textContent).catch(() => '');
  check(`${tag} commune Six-Fours : texte + biens`, /Brusc/.test(intro) && villeCards > 0, `${villeCards} biens`);
  check(`${tag} commune : aucune image cassée`, (await brokenImages(page)).length === 0, (await brokenImages(page)).join(', '));
  check(`${tag} commune : pas de défilement horizontal`, await noHScroll(page));
  await shot(page, `${tag}-07-commune`);

  for (const [p, n] of [['/agences.html', '08-agences'], ['/honoraires.html', '09-honoraires'], ['/mentions-legales.html', '10-mentions'], ['/espace-client.html', '11-espace-client']]) {
    await page.goto(BASE + p, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    check(`${tag} ${p} : pas de défilement horizontal`, await noHScroll(page));
    check(`${tag} ${p} : aucune image cassée`, (await brokenImages(page)).length === 0, (await brokenImages(page)).join(', '));
    await shot(page, `${tag}-${n}`);
  }

  // Anglais / allemand
  for (const lang of ['en', 'de']) {
    await page.goto(`${BASE}/?lang=${lang}`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const h1 = await page.$eval('.hero__title', e => e.textContent.replace(/\s+/g, ' ').trim());
    check(`${tag} accueil en ${lang}`, lang === 'en' ? /Sell, buy/.test(h1) : /Verkaufen/.test(h1), h1);
    await shot(page, `${tag}-12-accueil-${lang}`, false);
  }
  await page.goto(`${BASE}/?lang=fr`, { waitUntil: 'load' });
  await ctx.close();
}

async function formsTests() {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  watch(page, 'formulaires');
  const delay = () => page.waitForTimeout(3500); // délai anti-robot des formulaires
  // Contact (accueil)
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.fill('#contactForm [name=nom]', 'Test Contact Achat');
  await page.fill('#contactForm [name=tel]', '0600000001');
  await page.fill('#contactForm [name=email]', 'acheteur.test@exemple.fr');
  await page.selectOption('#contactForm [name=projet]', 'achat');
  await page.fill('#contactForm [name=message]', 'Je cherche un appartement à Toulon, 3 pièces.');
  await page.check('#contactForm [name=consent]');
  await delay();
  await page.click('#contactForm button[type=submit]');
  await page.waitForTimeout(1500);
  const ok = await page.$eval('#contactForm .form-ok', e => (e.hidden ? '' : e.textContent));
  check('formulaire de contact envoyé', /suivi|merci|reçu/i.test(ok), ok.slice(0, 90));
  const code = (ok.match(/[A-Z0-9]{8}/) || [])[0];
  await shot(page, 'form-01-contact', false);

  // Estimation (assistant en 4 étapes)
  await page.goto(BASE + '/#estimation', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.click('#wizard .choice:has-text("Maison")');
  await page.click('#wizard [data-next]');
  await page.fill('#wizard [name=ville]', 'Six-Fours-les-Plages');
  await page.fill('#wizard [name=surface]', '110');
  await page.click('#wizard [data-next]');
  await page.click('#wizard [data-next]');
  await page.fill('#wizard [name=nom]', 'Test Vendeur Estimation');
  await page.fill('#wizard [name=tel]', '0600000002');
  await page.fill('#wizard [name=email]', 'vendeur.test@exemple.fr');
  await page.check('#wizard [name=consent]');
  await delay();
  await page.click('#wizard [data-next]');
  await page.waitForTimeout(2000);
  const done = await page.$eval('#wizard .wizard__done', e => (e.hidden ? '' : e.textContent.replace(/\s+/g, ' ')));
  check('estimation en ligne envoyée (sans fourchette tant qu’aucun prix au m² n’est saisi)', /Merci/.test(done) && !/€\s*–|fourchette/i.test(done), done.slice(0, 140));
  await shot(page, 'form-02-estimation', false);

  // Demande de visite depuis une fiche
  const biens = await (await page.request.get(BASE + '/api/biens')).json();
  const b = biens.find(x => x.statut === 'disponible' && x.transaction === 'vente' && /Six-Fours/.test(x.ville)) || biens[0];
  await page.goto(`${BASE}/bien/${b.id}`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.fill('#visitForm [name=nom]', 'Test Visiteur');
  await page.fill('#visitForm [name=tel]', '0600000003');
  await page.fill('#visitForm [name=email]', 'visiteur.test@exemple.fr');
  await page.check('#visitForm [name=consent]');
  await delay();
  await page.click('#visitForm button[type=submit]');
  await page.waitForTimeout(1500);
  const vok = await page.$eval('#visitForm', f => f.parentElement.textContent.replace(/\s+/g, ' '));
  check('demande de visite envoyée depuis la fiche', /suivi|merci|reçu|enregistr/i.test(vok), b.id);
  // Favori
  await page.click('.fav').catch(() => {});
  await page.waitForTimeout(300);
  const favCount = await page.$eval('[data-fav-count]', e => e.textContent).catch(() => '');
  check('favori ajouté (compteur en-tête)', favCount === '1', favCount);

  // Espace client : favoris, suivi, alerte, rendez-vous
  await page.goto(BASE + '/espace-client.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const favCards = await page.$$eval('.bien', els => els.length);
  check('espace client : favori listé', favCards === 1, `${favCards}`);
  if (code) {
    await page.click('#tab-suivi');
    await page.fill('#trackForm [name=code]', code);
    await page.fill('#trackForm [name=contact]', 'acheteur.test@exemple.fr');
    await page.click('#trackForm button[type=submit]');
    await page.waitForTimeout(1500);
    const suivi = await page.$eval('#trackForm', f => f.parentElement.textContent.replace(/\s+/g, ' ')).catch(() => '');
    check('espace client : suivi de demande par code', /Reçue|reçue|traitement|Nouvelle|étape/i.test(suivi), code);
    await shot(page, 'form-03-suivi', false);
  }
  // Alerte
  await page.click('#tab-alertes');
  await page.waitForTimeout(400);
  const alertForm = page.locator('form:has([name=budgetMax]), #alerteForm').first();
  if (await alertForm.count()) {
    await alertForm.locator('[name=email]').fill('alerte.test@exemple.fr');
    await alertForm.locator('[name=ville], [name=villes]').first().fill('Sanary-sur-Mer').catch(() => {});
    await alertForm.locator('[name=budgetMax]').fill('500000').catch(() => {});
    await alertForm.locator('[name=consent]').check().catch(() => {});
    await delay();
    await alertForm.locator('button[type=submit]').click();
    await page.waitForTimeout(1500);
    const a = await alertForm.evaluate(f => f.parentElement.textContent.replace(/\s+/g, ' '));
    check('espace client : alerte e-mail enregistrée', /enregistr|merci|alerte/i.test(a), a.slice(-120));
    await shot(page, 'form-04-alerte', false);
  } else check('espace client : formulaire d’alerte trouvé', false);
  // Rendez-vous
  await page.click('#tab-rdv');
  await page.waitForTimeout(400);
  const rdv = page.locator('form:has([name=date])').first();
  if (await rdv.count()) {
    const d = new Date(); d.setDate(d.getDate() + 3); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
    await rdv.locator('[name=date]').fill(d.toISOString().slice(0, 10));
    const slot = rdv.locator('[name=creneau]');
    if (await slot.count()) { const opts = await slot.locator('option').evaluateAll(o => o.map(x => x.value).filter(Boolean)); if (opts[0]) await slot.selectOption(opts[0]); }
    await rdv.locator('[name=nom]').fill('Test Rendez-vous');
    await rdv.locator('[name=tel]').fill('0600000004');
    await rdv.locator('[name=consent]').check().catch(() => {});
    await delay();
    await rdv.locator('button[type=submit]').click();
    await page.waitForTimeout(1500);
    const r = await rdv.evaluate(f => f.parentElement.textContent.replace(/\s+/g, ' '));
    check('espace client : demande de rendez-vous', /suivi|merci|enregistr|reçu/i.test(r), r.slice(-120));
    await shot(page, 'form-05-rdv', false);
  } else check('espace client : formulaire de rendez-vous trouvé', false);
  await ctx.close();
}

async function adminTests() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  watch(page, 'admin');
  page.on('dialog', d => d.accept());
  const go = async (hash) => { await page.goto(`${BASE}/admin#${hash}`, { waitUntil: 'load' }); await page.waitForTimeout(1200); };
  const modalSubmit = async (label = 'Enregistrer') => { await page.click(`#modalActions button:has-text("${label}")`); await page.waitForTimeout(1000); };

  await page.goto(`${BASE}/admin`, { waitUntil: 'load' });
  await page.fill('#loginForm [name=email]', process.env.ADMIN_EMAIL);
  await page.fill('#loginForm [name=password]', process.env.ADMIN_PASSWORD);
  await page.click('#loginForm button[type=submit]');
  await page.waitForTimeout(1500);
  if (await page.isVisible('#mustChangeForm')) {
    await shot(page, 'admin-00-mot-de-passe-provisoire', false);
    const pw = page.locator('#mustChangeForm input[type=password]');
    const n = await pw.count();
    for (let i = 0; i < n; i++) await pw.nth(i).fill(i === 0 && n === 3 ? process.env.ADMIN_PASSWORD : process.env.NEW_PASSWORD);
    await page.click('#mustChangeForm button[type=submit]');
    await page.waitForTimeout(1500);
    check('admin : changement imposé du mot de passe provisoire', await page.isVisible('#app'));
  }
  check('admin : connexion', await page.isVisible('#app'));
  await go('tableau-de-bord');
  await shot(page, 'admin-01-tableau-de-bord');

  // Biens
  await go('biens');
  const nb = await page.$$eval('#bList [data-edit]', e => e.length);
  check('admin biens : liste', nb >= 194, `${nb} biens`);
  await shot(page, 'admin-02-biens', false);
  await page.click('#bList [data-edit]');
  await page.waitForTimeout(1200);
  const thumbs = await page.$$eval('#photoGrid img', imgs => imgs.map(i => i.naturalWidth));
  check('admin biens : photos visibles dans le formulaire', thumbs.length > 0 && thumbs.every(w => w > 0), `${thumbs.length} photos`);
  const titre = await page.inputValue('#bienForm [name=titre]');
  await page.fill('#bienForm [name=prix]', '123 456');
  await shot(page, 'admin-03-bien-edition', false);
  await page.click('#saveBtn');
  await page.waitForTimeout(1500);
  const pub = await (await page.request.get(BASE + '/api/biens')).json();
  check('admin biens : modification enregistrée et publiée', pub.some(b => b.titre === titre && b.prix === '123 456'), titre.slice(0, 50));

  // Demandes + pipeline
  await go('demandes');
  const leads = await page.$$eval('#dList [data-id]', e => e.length);
  check('admin demandes : demandes reçues', leads >= 3, `${leads}`);
  await shot(page, 'admin-04-demandes', false);
  await page.click('#dList [data-id]');
  await page.waitForTimeout(1000);
  await page.click('#leadPanel [data-status]:not(.is-active)').catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, 'admin-05-demande-detail', false);
  await page.click('#leadPanel [data-close]').catch(() => {});
  await page.click('button[data-mode="kanban"]').catch(() => {});
  await page.waitForTimeout(800);
  const cols = await page.$$eval('[data-col]', e => e.length);
  check('admin demandes : vue pipeline', cols >= 3, `${cols} colonnes`);
  await shot(page, 'admin-06-pipeline', false);

  // Contacts : fiche, critères de recherche, rapprochement
  await go('contacts');
  const nbc = await page.$$eval('#cList [data-id]', e => e.length);
  check('admin contacts : créés automatiquement depuis les demandes', nbc >= 3, `${nbc}`);
  await page.click('#cList [data-id]:has-text("Test Contact Achat")');
  await page.waitForTimeout(1000);
  await page.click('#cEdit');
  await page.waitForTimeout(500);
  await page.selectOption('#dlgForm [name=c_transaction]', 'vente').catch(() => {});
  await page.fill('#dlgForm [name=c_types]', 'Appartement');
  await page.fill('#dlgForm [name=c_villes]', 'Toulon');
  await page.fill('#dlgForm [name=c_budgetMax]', '300000');
  await modalSubmit();
  await page.waitForTimeout(800);
  const match = await page.$eval('#view', v => v.textContent).catch(() => '');
  const m = match.match(/Biens qui pourraient l’intéresser([\s\S]{0,300})/);
  check('admin contacts : critères saisis + biens correspondants', m && /Toulon/.test(m[1]), m ? m[1].replace(/\s+/g, ' ').slice(0, 120) : '');
  await shot(page, 'admin-07-contact-fiche');
  // Modèle d'e-mail (sans Resend : ouverture de la messagerie)
  const mailBtn = page.locator('#mailForm button');
  check('admin contacts : modèles d’e-mails proposés', await mailBtn.count() > 0 && await page.$$eval('#mailForm [name=m] option', o => o.length) > 0);

  // Tâches
  await go('taches');
  await page.click('#tNew');
  await page.waitForTimeout(500);
  await page.fill('#dlgForm [name=titre]', 'Rappeler Test Contact Achat');
  await modalSubmit();
  const tlist = await page.$eval('#tList', e => e.textContent);
  check('admin tâches : création', /Rappeler Test Contact Achat/.test(tlist));
  await shot(page, 'admin-08-taches', false);

  // Mandat rattaché à un bien
  await go('mandats');
  await page.click('#mNew');
  await page.waitForTimeout(500);
  const firstBien = await page.$$eval('#dlgForm [name=bienId] option', o => o.map(x => x.value).filter(Boolean)[0]);
  await page.selectOption('#dlgForm [name=bienId]', firstBien);
  await page.selectOption('#dlgForm [name=type]', { index: 1 }).catch(() => {});
  await page.fill('#dlgForm [name=prix]', '250000');
  await modalSubmit();
  const mlist = await page.$eval('#mList', e => e.textContent).catch(() => '');
  check('admin mandats : création rattachée à un bien', /\d/.test(mlist) && mlist.length > 20, mlist.replace(/\s+/g, ' ').slice(0, 100));
  await shot(page, 'admin-09-mandats', false);

  // Agenda des visites
  await go('agenda');
  await page.click('#vNew');
  await page.waitForTimeout(500);
  await page.selectOption('#dlgForm [name=bienId]', firstBien);
  await page.fill('#dlgForm [name=heure]', '10:30');
  await page.fill('#dlgForm [name=retour]', 'Visite test, retour positif.');
  await modalSubmit();
  const vlist = await page.$eval('#vList', e => e.textContent).catch(() => '');
  check('admin agenda : visite planifiée', /10:30|10 h 30|10h30/.test(vlist), vlist.replace(/\s+/g, ' ').slice(0, 100));
  await shot(page, 'admin-10-agenda', false);

  // Rapports, communes & avis, utilisateurs
  await go('rapports');
  await page.waitForTimeout(800);
  check('admin rapports : affichés', (await page.$eval('#view', v => v.textContent.length)) > 200);
  await shot(page, 'admin-11-rapports');
  await go('contenu');
  const contenu = await page.$eval('#view', v => v.textContent);
  check('admin communes & avis : contenu initial Acor’Immo', /Brusc/.test(await page.$$eval('#cRows textarea', t => t.map(x => x.value).join(' '))) && /153/.test(await page.inputValue('#aForm [name=nombre]').catch(() => '')), '');
  await shot(page, 'admin-12-contenu');
  await go('utilisateurs');
  await page.fill('#uForm [name=name]', 'Négociateur Test');
  await page.fill('#uForm [name=email]', 'nego.test@exemple.fr');
  await page.click('#uForm button[type=submit]');
  await page.waitForTimeout(1500);
  const ulist = await page.$eval('#uList', e => e.textContent).catch(() => '');
  check('admin utilisateurs : création d’un compte', /nego\.test@exemple\.fr|Négociateur Test/.test(ulist));
  await shot(page, 'admin-13-utilisateurs', false);
  await page.click('.modal__actions button').catch(() => {});
  await go('integrations');
  await shot(page, 'admin-14-integrations', false);

  // Admin sur mobile : pas de défilement horizontal
  const mctx = await browser.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() });
  const mp = await mctx.newPage();
  await mp.goto(`${BASE}/admin#biens`, { waitUntil: 'load' });
  await mp.waitForTimeout(1500);
  check('admin mobile : pas de défilement horizontal', await noHScroll(mp));
  await shot(mp, 'admin-15-mobile-biens', false);
  await mctx.close();
  await ctx.close();
}

if (MODE === 'public' || MODE === 'all') {
  await publicTests({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' }, 'desktop');
  await publicTests({ ...devices['iPhone 13'], locale: 'fr-FR' }, 'mobile');
}
if (MODE === 'forms' || MODE === 'all') await formsTests();
if (MODE === 'admin' || MODE === 'all') await adminTests();
await browser.close();
console.log(`\n${results.filter(r => r.ok).length}/${results.length} vérifications réussies`);
if (errors.length) { console.log(`\nErreurs relevées (${errors.length}) :`); [...new Set(errors)].slice(0, 40).forEach(e => console.log(' - ' + e)); }
