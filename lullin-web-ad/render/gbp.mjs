// Export des visuels Google Business Profile : node render/gbp.mjs [dossier] [id ...]
// Rendu Chromium à ×2 puis JPEG qualité 92 sans sous-échantillonnage de chrominance (contours lime nets).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';
import { ROOT } from './browser.mjs';

const out = path.resolve(ROOT, process.argv[2] || 'output/google-business');
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });
const server = await startServer(ROOT);
const base = `http://127.0.0.1:${server.address().port}/gbp/index.html`;
const browser = await chromium.launch({ args: ['--disable-gpu', '--font-render-hinting=none', '--force-color-profile=srgb'] });
const probe = await browser.newPage();
await probe.goto(base + '?img=logo');
await probe.waitForFunction(() => window.__images);
const ids = only.length ? only : await probe.evaluate(() => window.__images);
await probe.close();
const NAMES = { logo: '01_logo', couverture: '02_couverture', 'sites-vitrines': '03_sites-vitrines', 'boutiques-en-ligne': '04_boutiques-en-ligne', refonte: '05_refonte',
  maintenance: '06_maintenance', seo: '07_referencement-seo', 'reseaux-sociaux': '08_reseaux-sociaux', 'photo-video': '09_photo-video', automatisations: '10_automatisations-ia', devis: '11_demander-un-devis', methode: '12_notre-methode' };
for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`${base}?img=${id}`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__error); if (err) throw new Error(err);
  const { w, h } = await page.evaluate(() => window.__size);
  await page.setViewportSize({ width: w, height: h });
  const png = path.join(out, `${NAMES[id]}.png`);
  await page.screenshot({ path: png, clip: { x: 0, y: 0, width: w, height: h } });
  const jpg = path.join(out, `LullinWeb_GoogleBusiness_${NAMES[id]}_${w * 2}x${h * 2}.jpg`);
  execFileSync('python3', ['-I', '-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], quality=92, subsampling=0, optimize=True)', png, jpg]);
  fs.unlinkSync(png);
  console.log(`${path.basename(jpg)}  ${(fs.statSync(jpg).size / 1024).toFixed(0)} Ko`);
  await page.close();
}
await browser.close(); server.close();
