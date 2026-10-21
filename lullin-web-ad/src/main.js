// Point d'entrée : construit les 8 scènes puis expose window.__seek(t) au moteur de rendu.
// Chaque image est une fonction pure du temps : aucun requestAnimationFrame, aucune transition CSS.
import { DURATION, T } from './engine/time.js';
import { loadLogo } from './components/BrandLogo.js';
import { GlobalFX, CUES } from './components/TransitionController.js';
import { Scene01_Hook } from './scenes/Scene01_Hook.js';
import { Scene02_GridAssembly } from './scenes/Scene02_GridAssembly.js';
import { Scene03_WebsiteReveal } from './scenes/Scene03_WebsiteReveal.js';
import { Scene04_Services } from './scenes/Scene04_Services.js';
import { Scene05_LogoReveal } from './scenes/Scene05_LogoReveal.js';
import { Scene06_ResponsiveDemo } from './scenes/Scene06_ResponsiveDemo.js';
import { Scene07_FinalMessage } from './scenes/Scene07_FinalMessage.js';
import { Scene08_BrandOutro } from './scenes/Scene08_BrandOutro.js';

async function boot() {
  const faces = ['400', '500', '600', '700'].flatMap((w) => [`${w} 100px "Space Grotesk"`, `${w} 100px "DM Sans"`]);
  await Promise.all(faces.map((f) => document.fonts.load(f, 'AÉÀazé.,•&’')));
  await document.fonts.ready;
  await loadLogo();

  const stage = document.getElementById('stage');
  const fx = new GlobalFX(stage);
  const ctx = { fx };
  const scenes = [Scene01_Hook, Scene02_GridAssembly, Scene03_WebsiteReveal, Scene04_Services,
    Scene05_LogoReveal, Scene06_ResponsiveDemo, Scene07_FinalMessage, Scene08_BrandOutro].map((S, i) => new S(stage, ctx, i + 1));
  stage.append(fx.el); // effets globaux au-dessus de tout
  for (const s of scenes) if (s.init) await s.init();

  const params = new URLSearchParams(location.search);
  if (params.has('safe')) document.body.classList.add('debug-safe');

  window.__seek = (t) => {
    for (const s of scenes) s.update(t);
    fx.update(t);
  };
  window.__scenes = scenes;
  window.__duration = DURATION;
  window.__fps = T.fps;
  window.__cues = CUES.sort((a, b) => a.time - b.time);
  window.__seek(0);
  window.__ready = true;
}

boot().catch((e) => { window.__error = String(e && e.stack || e); console.error(e); });
