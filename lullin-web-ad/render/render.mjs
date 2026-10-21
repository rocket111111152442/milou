// Rendu final image par image.
// Pour chaque image à 60 i/s, SUB sous-images sont capturées sur l'intervalle de l'image (obturateur 360° à 60 i/s,
// soit l'équivalent de 180° à 30 i/s), puis moyennées par FFmpeg (tmix) : flou de mouvement réel, texte net à l'arrêt.
// Le travail est découpé en blocs répartis sur plusieurs processus Chromium.
//   node render/render.mjs [--workers 4] [--sub 4] [--from 0] [--to <frames>] [--out output/tmp]
import fs from 'node:fs';
import path from 'node:path';
import { spawn, fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import timeline from '../src/timeline.json' with { type: 'json' };

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []));
const FPS = timeline.fps;
const TOTAL = timeline.totalBeats * timeline.beatFrames + timeline.tailFrames;
const SUB = +(args.sub ?? 4);
const WORKERS = +(args.workers ?? 4);
const CHUNK = +(args.chunk ?? 24);
const FROM = +(args.from ?? 0), TO = +(args.to ?? TOTAL);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, args.out ?? 'output/tmp');

async function renderChunk(comp, c, frames) {
  const file = path.join(OUT, `chunk_${String(c).padStart(4, '0')}.mkv`);
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) return file; // reprise possible
  const tmp = file + '.part.mkv';
  const vf = SUB > 1 ? `tmix=frames=${SUB}:weights='${Array(SUB).fill(1).join(' ')}',select='not(mod(n+1\\,${SUB}))',setpts=N/(${FPS}*TB)` : 'setpts=N/(' + FPS + '*TB)';
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'png', '-i', '-',
    '-vf', vf, '-r', String(FPS), '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'bgr0', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg ' + code)))));
  for (const i of frames) {
    for (let j = 0; j < SUB; j++) {
      const t = Math.max(0, (i - 0.5 + (j + 0.5) / SUB) / FPS);
      const png = await comp.capture(SUB > 1 ? t : i / FPS);
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    }
  }
  ff.stdin.end();
  await done;
  fs.renameSync(tmp, file);
  return file;
}

if (process.env.RENDER_WORKER) {
  const { openComposition } = await import('./browser.mjs');
  const comp = await openComposition();
  process.on('message', async (msg) => {
    if (msg.type === 'chunk') {
      const t0 = Date.now();
      await renderChunk(comp, msg.c, msg.frames);
      process.send({ type: 'done', c: msg.c, ms: Date.now() - t0 });
    } else if (msg.type === 'exit') { await comp.close(); process.exit(0); }
  });
  process.send({ type: 'ready' });
} else {
  fs.mkdirSync(OUT, { recursive: true });
  const chunks = [];
  for (let s = FROM, c = Math.floor(FROM / CHUNK); s < TO; s += CHUNK, c++) chunks.push({ c, frames: Array.from({ length: Math.min(CHUNK, TO - s) }, (_, k) => s + k) });
  console.log(`${TO - FROM} images × ${SUB} sous-images, ${chunks.length} blocs, ${WORKERS} processus`);
  const queue = [...chunks];
  let finished = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: WORKERS }, () => new Promise((resolve) => {
    const w = fork(fileURLToPath(import.meta.url), process.argv.slice(2), { env: { ...process.env, RENDER_WORKER: '1' } });
    const next = () => { const job = queue.shift(); if (job) w.send({ type: 'chunk', ...job }); else w.send({ type: 'exit' }); };
    w.on('message', (m) => {
      if (m.type === 'ready') next();
      if (m.type === 'done') { finished++; console.log(`bloc ${m.c} ok (${(m.ms / 1000).toFixed(1)} s) — ${finished}/${chunks.length} — ${((Date.now() - t0) / 1000).toFixed(0)} s écoulées`); next(); }
    });
    w.on('exit', resolve);
  })));
  const list = chunks.map((k) => `file '${path.join(OUT, `chunk_${String(k.c).padStart(4, '0')}.mkv`)}'`).join('\n');
  fs.writeFileSync(path.join(OUT, 'chunks.txt'), list + '\n');
  console.log(`terminé en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
