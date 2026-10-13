/* Hero : végétation générative qui pousse puis ondule au vent (souris + vent réel). */
(() => {
  const canvas = document.getElementById("garden");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W, H, dpr, plants = [], pollen = [], t0 = performance.now();
  let mouseX = 0.5, wind = 0, windTarget = 0, running = true;

  const rand = (a, b) => a + Math.random() * (b - a);

  function branch(len, depth, maxDepth) {
    const b = { len, depth, kids: [], off: 0, phase: Math.random() * 6.28 };
    if (depth < maxDepth) {
      const n = depth < 2 ? 2 : Math.random() < 0.35 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const k = branch(len * rand(0.66, 0.8), depth + 1, maxDepth);
        k.off = (i - (n - 1) / 2) * rand(0.32, 0.6) + rand(-0.12, 0.12);
        b.kids.push(k);
      }
    }
    return b;
  }

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    plants = [];
    const count = W < 700 ? 6 : 11;
    for (let i = 0; i < count; i++) {
      const u = (i + rand(0.1, 0.9)) / count;
      // plus haut à droite pour laisser respirer le titre
      const tall = 0.45 + 0.55 * Math.pow(u, 0.8);
      const maxDepth = W < 700 ? 7 : 8;
      plants.push({
        x: u * W,
        root: branch(H * rand(0.09, 0.14) * tall, 0, maxDepth),
        maxDepth,
        delay: rand(0, 0.9),
        hue: rand(78, 100),
        lean: rand(-0.15, 0.15)
      });
    }
    pollen = Array.from({ length: W < 700 ? 30 : 60 }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: rand(0.6, 1.8), v: rand(0.15, 0.5), p: Math.random() * 6.28
    }));
  }

  function drawBranch(b, x, y, ang, grow, plant, time) {
    const local = Math.min(Math.max(grow - b.depth, 0), 1);
    if (local <= 0) return;
    const sway = (wind * 0.06 + Math.sin(time * 1.3 + b.phase + plant.x * 0.004) * 0.025) * (b.depth + 1) * 0.55;
    const a = ang + b.off + sway;
    const L = b.len * local;
    const x2 = x + Math.sin(a) * L;
    const y2 = y - Math.cos(a) * L;
    const d = b.depth / plant.maxDepth;

    ctx.strokeStyle = `hsla(${plant.hue}, ${30 + d * 50}%, ${14 + d * 38}%, ${0.55 + d * 0.4})`;
    ctx.lineWidth = Math.max((plant.maxDepth - b.depth) * 0.9, 0.5);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();

    if (!b.kids.length && local >= 1) {
      ctx.fillStyle = `hsla(${plant.hue}, 85%, 68%, 0.8)`;
      ctx.beginPath();
      ctx.ellipse(x2, y2, 2.6, 5.2, a, 0, 6.283);
      ctx.fill();
    }
    for (const k of b.kids) drawBranch(k, x2, y2, a, grow, plant, time);
  }

  function frame(now) {
    if (!running) return;
    const time = (now - t0) / 1000;
    // vent : souris + vent réel (km/h) récupéré par main.js
    const real = Math.min((window.MD_WIND || 8) / 40, 1);
    windTarget = (mouseX - 0.5) * 2.2 + Math.sin(time * 0.4) * (0.3 + real);
    wind += (windTarget - wind) * 0.03;

    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";

    for (const p of plants) {
      const grow = reduce ? p.maxDepth + 1 : Math.max(0, (time - p.delay) * 2.6);
      drawBranch(p.root, p.x, H + 4, p.lean, grow, p, time);
    }

    ctx.fillStyle = "rgba(196, 242, 106, 0.55)";
    for (const q of pollen) {
      q.y -= q.v; q.x += Math.sin(time + q.p) * 0.3 + wind * 0.4;
      if (q.y < -10) { q.y = H + 10; q.x = Math.random() * W; }
      if (q.x > W + 10) q.x = -10; if (q.x < -10) q.x = W + 10;
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(time * 0.8 + q.p));
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (!reduce) requestAnimationFrame(frame);
  }

  addEventListener("mousemove", e => (mouseX = e.clientX / innerWidth), { passive: true });
  addEventListener("touchmove", e => (mouseX = e.touches[0].clientX / innerWidth), { passive: true });
  let rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => { build(); if (reduce) frame(performance.now()); }, 200);
  });

  new IntersectionObserver(([e]) => {
    const was = running;
    running = e.isIntersecting;
    if (running && !was && !reduce) requestAnimationFrame(frame);
  }).observe(canvas);

  build();
  requestAnimationFrame(frame);
})();
