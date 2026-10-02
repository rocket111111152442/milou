// Rendu final : vidéo MP4 (H.264, yuv420p, sans audio, < 4 Mo) + poster JPG.
// Usage : npm run render            (vidéo + poster)
//         npm run render -- --stills 0,36,60,100,125   (aperçus PNG dans out/stills)
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'out');
const VIDEO_FILE = path.join(OUT, 'hero-hors-champ.mp4');
const POSTER_FILE = path.join(OUT, 'hero-hors-champ-poster.jpg');
const MAX_BYTES = 4 * 1024 * 1024 * 0.97; // marge de sécurité sous 4 Mo
const POSTER_SECONDS = 5.25; // logo net, slogan affiché, light leak passé
let crf = Number(process.env.CRF ?? 16);

// Navigateur : celui de Remotion par défaut, ou un Chromium local via REMOTION_BROWSER.
const browserExecutable = process.env.REMOTION_BROWSER || null;
// Seulement derrière un proxy HTTPS d'inspection (ex. sandbox) : REMOTION_IGNORE_CERT=1
const chromiumOptions = process.env.REMOTION_IGNORE_CERT ? { ignoreCertificateErrors: true } : {};

fs.mkdirSync(OUT, { recursive: true });
execFileSync('node', [path.join(ROOT, 'scripts/make-placeholder-logos.mjs')], { stdio: 'inherit', cwd: ROOT });

const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'HeroHorsChamp', browserExecutable, chromiumOptions });

const stillsArg = process.argv.indexOf('--stills');
if (stillsArg > -1) {
  const frames = process.argv[stillsArg + 1].split(',').map(Number);
  fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
  for (const frame of frames) {
    await renderStill({ composition, serveUrl, frame, output: path.join(OUT, 'stills', `${String(frame).padStart(3, '0')}.png`), browserExecutable, chromiumOptions });
  }
  console.log('stills ok');
  process.exit(0);
}

const frameDir = path.join(OUT, 'master.mkv');
// 1) Master quasi sans perte, rendu une seule fois.
await renderMedia({
  composition, serveUrl, codec: 'h264', crf: 1, pixelFormat: 'yuv420p', muted: true, imageFormat: 'png',
  outputLocation: frameDir.replace('.mkv', '.mp4'), browserExecutable, chromiumOptions,
  onProgress: ({ progress }) => process.stdout.write(`\rrendu ${(progress * 100).toFixed(0)}%   `),
});
console.log();
const master = frameDir.replace('.mkv', '.mp4');

// 2) Encodage final : on remonte le CRF jusqu'à passer sous 4 Mo.
for (;;) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', master, '-an', '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'grain',
    '-crf', String(crf), '-pix_fmt', 'yuv420p', '-r', String(composition.fps), '-movflags', '+faststart', VIDEO_FILE]);
  const size = fs.statSync(VIDEO_FILE).size;
  console.log(`CRF ${crf} → ${(size / 1024 / 1024).toFixed(2)} Mo`);
  if (size <= MAX_BYTES) break;
  crf += 1;
}
fs.rmSync(master);

// 3) Poster.
await renderStill({
  composition, serveUrl, frame: Math.round(POSTER_SECONDS * composition.fps), output: POSTER_FILE,
  imageFormat: 'jpeg', jpegQuality: 92, browserExecutable, chromiumOptions,
});
console.log('OK :', VIDEO_FILE, POSTER_FILE);
