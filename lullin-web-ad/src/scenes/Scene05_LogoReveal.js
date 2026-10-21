import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { h, css } from '../engine/dom.js';
import { E, prog, kf, lerp, clamp } from '../engine/ease.js';
import { b } from '../engine/time.js';
import { Scene, cue } from '../components/TransitionController.js';
import { Headline } from '../components/TypographySystem.js';
import { logoSVG, LOGO_VIEWBOX } from '../components/BrandLogo.js';
import { S5_LOGO, S6_LOGO } from './shared.js';

// SCÈNE 05 — LE MOMENT SIGNATURE (27 → 36 temps, 12,6 → 16,8 s)
// Fragmentation → chorégraphie → convergence → révélation.
// Les 5 pièces sont extrudées à partir des tracés EXACTS du fichier officiel (aucune forme redessinée).
// Au verrouillage, l'image WebGL est remplacée au pixel près par le SVG officiel (couleurs exactes).

const START = b(27), END = b(36);
const LOCK = b(33);
const FOV = 30;
const ARRIVE = { 3: LOCK - 0.32, 2: LOCK - 0.24, 4: LOCK - 0.16, 0: LOCK - 0.08, 1: LOCK };
const TEXT_IN = LOCK + 0.16;

const flipWinding = (geo) => {
  for (const name of ['position', 'normal', 'uv']) {
    const a = geo.getAttribute(name); if (!a) continue;
    const n = a.itemSize, arr = a.array;
    for (let i = 0; i < a.count; i += 3) for (let k = 0; k < n; k++) {
      const i1 = (i + 1) * n + k, i2 = (i + 2) * n + k; const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
    }
  }
};

export class Scene05_LogoReveal extends Scene {
  constructor(stage, ctx) {
    super(stage, 'Scene05_LogoReveal', { pre: 0.02, post: 0.06, z: 6 });
    this.ctx = ctx;
    this.root.style.background = 'var(--bg)';
    // Lueur lime (impulsion) DERRIÈRE le logo : le canvas WebGL est transparent.
    this.glow = h('div', { class: 'abs', style: { width: '1200px', height: '1200px', left: '-60px', top: `${S5_LOGO.cy - 600}px`, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(194,249,58,0.32), rgba(194,249,58,0.08) 45%, rgba(194,249,58,0) 100%)', opacity: 0 } });
    this.root.append(this.glow);
    this.canvasWrap = h('div', { class: 'layer' });
    this.root.append(this.canvasWrap);
    this.rings = [0, 1, 2].map((k) => { const r = h('div', { class: 'abs', style: { border: `${k === 1 ? 3 : 2}px solid ${k === 1 ? 'var(--lime)' : 'var(--cream)'}`, borderRadius: '50%', opacity: 0 } }); this.root.append(r); return r; });
    this.flat = h('div', { class: 'abs', style: { transformOrigin: '0 0', opacity: 0 } });
    this.root.append(this.flat);
    this.title = new Headline(this.root, { lines: [['LULLIN', 'WEB.']], size: 150, x: 540, y: 1170, align: 'center', maxWidth: 900 });
    this.sub = h('div', { class: 'abs', style: { width: '1080px', top: '1352px', textAlign: 'center', font: '500 50px var(--body)', color: 'rgba(240,240,232,0.9)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' } }, 'Votre présence. Notre expertise.');
    this.root.append(this.sub);

    cue(START + 0.02, 'drone', { dur: 1.0 });
    [13.08, 13.16, 13.24, 13.32].forEach((tt, i) => cue(tt, 'detach', { pitch: i }));
    cue(13.62, 'flyby', { dur: 0.72 });
    cue(14.3, 'whoosh_rev', { dur: 0.45 });
    for (const [k, tt] of Object.entries(ARRIVE)) if (+k !== 1) cue(tt, 'snap', { pitch: +k });
    cue(LOCK, 'lock_impact');
    cue(TEXT_IN, 'word_hit', { gain: 0.6 });
    cue(16.55, 'logo_slide', { dur: 0.3 });
  }

  async init() {
    this.title.fit();
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(1); r.setSize(1080, 1920, false);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping;
    Object.assign(r.domElement.style, { position: 'absolute', left: 0, top: 0, width: '1080px', height: '1920px' });
    this.canvasWrap.append(r.domElement);
    this.renderer = r;
    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(FOV, 1080 / 1920, 20, 60000);

    // Éclairage calibré : une face orientée vers la caméra restitue la couleur officielle (ambiante + clé ≈ π).
    scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.58));
    this.key = new THREE.DirectionalLight(0xffffff, Math.PI * 0.46); scene.add(this.key); scene.add(this.key.target);
    this.rim = new THREE.DirectionalLight(0xffffff, Math.PI * 0.9); scene.add(this.rim); scene.add(this.rim.target);

    const svgText = await (await fetch('/assets/logo/lullin-mark.svg')).text();
    const data = new SVGLoader().parse(svgText);
    const box = new THREE.Box3();
    const pieces = data.paths.map((p, i) => {
      const color = new THREE.Color().setStyle(p.userData.style.fill);
      const geo = new THREE.ExtrudeGeometry(SVGLoader.createShapes(p), { depth: 80, bevelEnabled: true, bevelThickness: 12, bevelSize: 9, bevelOffset: -9, bevelSegments: 5, curveSegments: 28 });
      geo.scale(1, -1, 1); flipWinding(geo);
      geo.computeBoundingBox();
      box.union(geo.boundingBox);
      return { geo, color, i };
    });
    this.center = box.getCenter(new THREE.Vector3());
    this.size = box.getSize(new THREE.Vector3());
    this.visual = { x: this.center.x, y: -this.center.y }; // centre visuel du symbole dans le repère SVG
    this.group = new THREE.Group(); scene.add(this.group);
    this.pieces = pieces.map(({ geo, color, i }) => {
      const bb = geo.boundingBox; const c = bb.getCenter(new THREE.Vector3());
      geo.translate(-c.x, -c.y, -(80 + 12)); // pivot au centre de la pièce, face avant à z = 0
      const cap = new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0, emissive: color.clone(), emissiveIntensity: 0 });
      const side = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.78), roughness: 0.6, metalness: 0 });
      const mesh = new THREE.Mesh(geo, [cap, side]);
      this.group.add(mesh);
      return { mesh, cap, home: new THREE.Vector3(c.x - this.center.x, c.y - this.center.y, 0), i };
    });
    this.choreo();

    // Échelle finale (raccord avec le SVG officiel)
    this.ppu = S5_LOGO.visibleWidth / this.size.x; // pixels par unité au plan avant
    this.D = 1920 / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * this.ppu);
    this.dy = (960 - S5_LOGO.cy) / this.ppu;
    const svgSize = LOGO_VIEWBOX * this.ppu;
    const flat = logoSVG(svgSize);
    this.flat.append(flat);
    this.flatBase = { size: svgSize, left: 540 - this.visual.x * this.ppu, top: S5_LOGO.cy - this.visual.y * this.ppu };
    this.renderer.compile(scene, this.camera);
  }

  /** Positions et rotations de chaque pièce : objet abstrait → éclatement → trajectoires → retour au repos. */
  choreo() {
    const D2R = Math.PI / 180;
    // Objet abstrait : les 5 pièces en éventail autour de l'axe vertical (la lime cachée à l'arrière).
    const cluster = {
      0: { p: [0, 0, 0], r: [0, 0, 0] },
      3: { p: [0, 60, 40], r: [0, 72, 0] },
      2: { p: [0, -40, -40], r: [0, -72, 0] },
      4: { p: [0, -60, -90], r: [0, 144, 0] },
      1: { p: [0, 40, -160], r: [0, -144, 0] },
    };
    const spread = {
      0: { p: [-250, 380, -200], r: [-40, -130, 70] },
      1: { p: [-650, 300, -450], r: [60, 200, -40] },
      2: { p: [-560, -560, 250], r: [150, 60, -90] },
      3: { p: [380, 760, -150], r: [-120, 40, 160] },
      4: { p: [560, -520, 350], r: [80, -160, 110] },
    };
    // Position du sommet de la traversée lime (près de la caméra) et retour.
    this.limeFly = { a: new THREE.Vector3(-650, 300, -450), b: new THREE.Vector3(700, -200, 900) };
    this.cfg = Object.fromEntries(Object.keys(cluster).map((k) => [k, {
      cp: new THREE.Vector3(...cluster[k].p), cr: cluster[k].r.map((v) => v * D2R),
      sp: new THREE.Vector3(...spread[k].p), sr: spread[k].r.map((v) => v * D2R),
      td: { 3: 13.05, 2: 13.13, 4: 13.21, 0: 13.29, 1: 13.37 }[k], ta: ARRIVE[k],
    }]));
  }

  pose(piece, t) {
    const c = this.cfg[piece.i];
    const out = E.outCubic(prog(t, c.td, c.td + 0.75));
    const back = E.inOutCubic(prog(t, c.ta - 0.95, c.ta));
    const backR = E.outQuart(prog(t, c.ta - 0.95, c.ta));
    const pos = new THREE.Vector3().copy(c.cp).lerp(c.sp, out);
    const drift = (1 - back) * out;
    pos.x += Math.sin(t * 1.3 + piece.i) * 60 * drift; pos.y += Math.cos(t * 1.1 + piece.i * 2) * 60 * drift;
    const spin = (t - c.td) * 0.6 * drift;
    let rot = c.cr.map((v, k) => lerp(v, c.sr[k], out) + (k === 1 ? spin : 0));
    if (piece.i === 1) {
      // Traversée de la branche lime : elle fend le cadre puis fait face à la caméra.
      const f = E.inOutQuad(prog(t, 13.55, 14.3));
      if (t >= 13.55) {
        pos.copy(this.limeFly.a).lerp(this.limeFly.b, f);
        pos.y += Math.sin(f * Math.PI) * 380;
        const face = E.inOutCubic(prog(t, 13.85, 14.3));
        rot = c.sr.map((v, k) => lerp(v + (k === 1 ? 1.2 : 0), 0, face));
      }
      if (t >= 14.3) { pos.copy(this.limeFly.b); rot = [0, 0, 0]; }
      const lb = E.inOutCubic(prog(t, 14.42, c.ta));
      if (t >= 14.42) { pos.copy(this.limeFly.b).lerp(piece.home, lb); pos.z += Math.sin(lb * Math.PI) * -600; rot = [Math.sin(lb * Math.PI) * 0.6, Math.sin(lb * Math.PI) * -1.4, 0]; }
      if (t >= c.ta) { pos.copy(piece.home); rot = [0, 0, 0]; }
      return { pos, rot };
    }
    pos.lerp(piece.home, back);
    rot = rot.map((v) => v * (1 - backR));
    return { pos, rot };
  }

  camera3(t) {
    // Caméra : orbite autour de l'objet → poursuite de la branche lime → collée à sa surface → recul brutal → face.
    const target = new THREE.Vector3(0, -this.dy, 0);
    const lime = this.pieces[1];
    const limePos = this.pose(lime, t).pos;
    const az = kf(t, [[START, -58], [13.55, 18, E.outQuad], [14.3, 0, E.inOutCubic], [14.75, -14, E.outExpo], [LOCK - 0.05, 0, E.inOutCubic]]);
    const el = kf(t, [[START, 16], [13.55, 6, E.outQuad], [14.3, 0, E.inOutCubic], [14.75, 7, E.outExpo], [LOCK - 0.05, 0, E.inOutCubic]]);
    const dist = kf(t, [[START, 4300], [13.55, 3100, E.outQuad], [14.12, 1400, E.inQuad], [14.3, 300, E.outCubic], [14.33, 280, E.linear], [14.75, 6600, E.outExpo], [LOCK - 0.05, this.D, E.inOutCubic]]);
    const follow = kf(t, [[13.5, 0], [14.15, 1, E.inOutCubic], [14.33, 1], [14.78, 0, E.outExpo]]);
    target.lerp(new THREE.Vector3(limePos.x, limePos.y, limePos.z), follow);
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    const pos = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(dist).add(target);
    // Vibration de quelques images au verrouillage
    const sk = t >= LOCK && t < LOCK + 0.09 ? (1 - (t - LOCK) / 0.09) : 0;
    const shake = new THREE.Vector3(Math.sin(t * 310) * 7, Math.cos(t * 270) * 7, 0).multiplyScalar(sk / this.ppu * 1.0);
    this.camera.position.copy(pos).add(shake);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target.clone().add(shake));
    this.camera.rotateZ(THREE.MathUtils.degToRad(kf(t, [[START, -8], [13.55, 4], [14.3, 0], [14.75, -3, E.outExpo], [LOCK - 0.05, 0, E.inOutCubic]])));
    this.camera.updateMatrixWorld();
    // Lumières attachées au regard (éclairage constant de face)
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, this.camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    this.key.position.copy(this.camera.position).addScaledVector(right, 2600).addScaledVector(up, 3200);
    this.key.target.position.copy(target);
    this.rim.position.copy(target).addScaledVector(fwd, 6000).addScaledVector(right, -4000).addScaledVector(up, 2500);
    this.rim.target.position.copy(target);
  }

  render(t) {
    const handoff = prog(t, LOCK + 0.02, LOCK + 0.1); // WebGL → SVG officiel
    const glOn = handoff < 1;
    css(this.canvasWrap, 'display', glOn ? 'block' : 'none');
    if (glOn) {
      for (const p of this.pieces) {
        const { pos, rot } = this.pose(p, t);
        p.mesh.position.copy(pos);
        p.mesh.rotation.set(rot[0], rot[1], rot[2], 'YXZ');
      }
      const pulse = t >= LOCK ? Math.exp(-(t - LOCK) * 9) : 0;
      this.pieces[1].cap.emissiveIntensity = 0.55 * pulse;
      this.camera3(t);
      this.renderer.render(this.scene, this.camera);
    }

    // SVG officiel + glissement vers l'en-tête du site (scène 6)
    const mv = E.inOutCubic(prog(t, 16.5, END + 0.05));
    const fb = this.flatBase;
    const s1 = S6_LOGO.svgSize / fb.size;
    const x = lerp(fb.left, S6_LOGO.cx - (fb.size * s1) / 2, mv), y = lerp(fb.top, S6_LOGO.cy - (fb.size * s1) / 2, mv);
    css(this.flat, 'transform', `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${lerp(1, s1, mv).toFixed(5)})`);
    css(this.flat, 'opacity', handoff.toFixed(3));

    // Impulsion lumineuse + ondulation géométrique au verrouillage
    css(this.glow, 'opacity', (t >= LOCK ? 0.25 + 0.75 * Math.exp(-(t - LOCK) * 5) : 0).toFixed(3) * (1 - mv));
    this.rings.forEach((r, k) => {
      const q = prog(t, LOCK + k * 0.05, LOCK + 0.75 + k * 0.1);
      const s = 520 + E.outCubic(q) * (1300 + k * 300);
      css(r, 'width', `${s}px`); css(r, 'height', `${s}px`);
      css(r, 'transform', `translate(${(540 - s / 2).toFixed(1)}px, ${(S5_LOGO.cy - s / 2).toFixed(1)}px)`);
      css(r, 'opacity', (q > 0 && q < 1 ? (1 - q) * (k === 1 ? 0.9 : 0.45) : 0).toFixed(3));
    });

    // Texte
    const tin = E.outExpo(prog(t, TEXT_IN - 0.12, TEXT_IN + 0.08));
    const tout = E.inQuart(prog(t, 16.42, 16.62));
    this.title.word(0, { y: 1 - E.outExpo(prog(t, TEXT_IN - 0.12, TEXT_IN + 0.06)) - tout, s: lerp(1.12, 1, tin) });
    this.title.word(1, { y: 1 - E.outExpo(prog(t, TEXT_IN - 0.06, TEXT_IN + 0.12)) - tout, s: lerp(1.12, 1, tin) });
    const sp = E.outCubic(prog(t, 15.85, 16.2));
    css(this.sub, 'opacity', (sp * (1 - E.inQuad(prog(t, 16.4, 16.58)))).toFixed(3));
    css(this.sub, 'transform', `translateY(${lerp(26, 0, sp).toFixed(1)}px)`);
  }
}
