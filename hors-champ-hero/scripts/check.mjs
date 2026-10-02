// Vérifie les specs du MP4 final avec ffprobe + la jonction de boucle (image 191 → image 0).
import { execFileSync } from 'child_process';
import fs from 'fs';

const file = process.argv[2] || 'out/hero-hors-champ.mp4';
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-count_frames', '-of', 'json', file]));
const v = probe.streams.find(s => s.codec_type === 'video');
const audio = probe.streams.filter(s => s.codec_type === 'audio');
const size = fs.statSync(file).size;
const checks = [
  ['Dimensions 1920×804', `${v.width}×${v.height}`, v.width === 1920 && v.height === 804],
  ['24 fps', v.r_frame_rate, v.r_frame_rate === '24/1'],
  ['192 images', v.nb_read_frames, Number(v.nb_read_frames) === 192],
  ['Durée 8 s', probe.format.duration, Math.abs(Number(probe.format.duration) - 8) < 0.01],
  ['Codec H.264', v.codec_name, v.codec_name === 'h264'],
  ['yuv420p', v.pix_fmt, v.pix_fmt === 'yuv420p'],
  ['Aucune piste audio', `${audio.length} piste(s)`, audio.length === 0],
  ['Poids < 4 Mo', `${(size / 1024 / 1024).toFixed(2)} Mo (${size} octets)`, size < 4 * 1024 * 1024],
];

// Jonction de boucle : on compare la dernière et la première image, en excluant la bande
// du haut (timecode qui avance, REC) — le grain change à chaque image par nature.
const crop = 'crop=1920:700:0:104';
const grab = n => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${n}),${crop},scale=480:-1,format=gray`, '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
const a = grab(191), b = grab(0), c = grab(100);
const mad = (x, y) => x.reduce((s, val, i) => s + Math.abs(val - y[i]), 0) / x.length;
const seam = mad(a, b), ref = mad(c, b);
checks.push(['Boucle : écart moyen image 191 ↔ 0', `${seam.toFixed(2)} niveaux /255 (logo vs noir : ${ref.toFixed(1)})`, seam < 1.5]);

let ok = true;
for (const [name, val, pass] of checks) { console.log(`${pass ? '✔' : '✘'} ${name.padEnd(36)} ${val}`); ok &&= pass; }
process.exit(ok ? 0 : 1);
