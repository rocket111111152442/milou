// Prévisualisation : node render/preview.mjs <dossier> <t1> <t2> ...  (temps en secondes, ou "b12.5" en temps musicaux)
import fs from 'node:fs';
import path from 'node:path';
import { openComposition } from './browser.mjs';

const [outDir, ...times] = process.argv.slice(2);
const safe = process.env.SAFE ? '?safe=1' : '';
fs.mkdirSync(outDir, { recursive: true });
const { page, capture, close } = await openComposition({ query: safe });
const beat = 28 / 60;
for (const raw of times) {
  const t = raw.startsWith('b') ? parseFloat(raw.slice(1)) * beat : parseFloat(raw);
  const png = await capture(t);
  const name = path.join(outDir, `f_${t.toFixed(3).padStart(7, '0')}.png`);
  fs.writeFileSync(name, png);
  console.log(name);
}
if (process.env.CUES) fs.writeFileSync(process.env.CUES, JSON.stringify(await page.evaluate(() => window.__cues), null, 1));
await close();
