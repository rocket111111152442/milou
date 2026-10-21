// Ouverture de la composition dans Chromium (Playwright) + capture d'une image à un instant donné.
import { chromium } from 'playwright';
import { startServer } from './server.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function openComposition({ query = '' } = {}) {
  const server = await startServer(ROOT);
  const browser = await chromium.launch({
    args: ['--disable-gpu', '--enable-unsafe-swiftshader', '--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/src/index.html${query}`);
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(err);
  const cdp = await page.context().newCDPSession(page);
  const capture = async (t, format = 'png') => {
    await page.evaluate((tt) => window.__seek(tt), t);
    const r = await cdp.send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 95 : undefined, optimizeForSpeed: true });
    return Buffer.from(r.data, 'base64');
  };
  const close = async () => { await browser.close(); server.close(); };
  return { page, capture, close };
}
