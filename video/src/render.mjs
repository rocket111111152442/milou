import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const [,, mode, outDir, ...times] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto('file://' + process.cwd() + '/index.html');
await page.evaluate(() => window.ready);
fs.mkdirSync(outDir, { recursive: true });
const list = mode === 'all' ? Array.from({ length: 450 }, (_, i) => i / 30) : times.map(Number);
for (let i = 0; i < list.length; i++) {
  await page.evaluate(t => window.render(t), list[i]);
  const name = mode === 'all' ? `f${String(i).padStart(4, '0')}.png` : `t${list[i].toFixed(2)}.png`;
  await page.screenshot({ path: `${outDir}/${name}` });
}
await browser.close();
