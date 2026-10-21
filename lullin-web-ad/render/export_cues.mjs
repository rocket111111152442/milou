// Exporte les repères sonores déclarés par les scènes (même horloge que l'image) → audio/cues.json
import fs from 'node:fs';
import path from 'node:path';
import { openComposition, ROOT } from './browser.mjs';
const { page, close } = await openComposition();
const cues = await page.evaluate(() => window.__cues);
fs.writeFileSync(path.join(ROOT, 'audio/cues.json'), JSON.stringify(cues, null, 1));
console.log(`${cues.length} repères → audio/cues.json`);
await close();
