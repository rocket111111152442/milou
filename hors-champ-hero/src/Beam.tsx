import React from 'react';
import { useCurrentFrame } from 'remotion';
import { COLORS, TIMING, VIDEO } from './config';
import { LOOP, easeInOut, ramp, rand } from './anim';

const { width: W, height: H } = VIDEO;
const CX = W / 2;
const APEX_Y = -140;
const BASE_HW = 560; // demi-largeur du faisceau en bas de l'image, ouvert

/** Intensité du faisceau : 0 à l'image 0, 0 à la dernière image → boucle parfaite. */
export const useBeam = () => {
  const f = useCurrentFrame();
  const open = ramp(f, TIMING.beamOpen, easeInOut);
  const swell = ramp(f, TIMING.beamSwell);
  const close = ramp(f, TIMING.close, easeInOut);
  const level = 0.62 - 0.14 * ramp(f, [3.3, 4.0]) + 0.32 * swell;
  const intensity = open * level * (1 - close);
  const spread = (0.18 + 0.82 * open) * (1 - 0.82 * close);
  return { intensity, spread };
};

const halfWidthAt = (y: number, spread: number) =>
  ((y - APEX_Y) / (H - APEX_Y)) * BASE_HW * spread;

export const Beam: React.FC = () => {
  const f = useCurrentFrame();
  const { intensity, spread } = useBeam();
  if (intensity <= 0.0005) return null;
  const hw = BASE_HW * spread;
  const flicker = 1 + 0.025 * Math.sin((f / LOOP()) * Math.PI * 2 * 16) * Math.sin((f / LOOP()) * Math.PI * 2 * 5);
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: intensity * flicker }}>
      <defs>
        <linearGradient id="beamV" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={COLORS.accent} stopOpacity={0.75} />
          <stop offset="0.55" stopColor={COLORS.accent} stopOpacity={0.28} />
          <stop offset="1" stopColor={COLORS.accent} stopOpacity={0.1} />
        </linearGradient>
        <radialGradient id="hot" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={COLORS.ink} stopOpacity={0.55} />
          <stop offset="0.35" stopColor={COLORS.accent} stopOpacity={0.35} />
          <stop offset="1" stopColor={COLORS.accent} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={COLORS.accent} stopOpacity={0.3} />
          <stop offset="1" stopColor={COLORS.accent} stopOpacity={0} />
        </radialGradient>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={46} />
        </filter>
        <filter id="softer" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={20} />
        </filter>
      </defs>
      <g filter="url(#soft)">
        <polygon points={`${CX - 6},${APEX_Y} ${CX + 6},${APEX_Y} ${CX + hw},${H + 60} ${CX - hw},${H + 60}`} fill="url(#beamV)" />
      </g>
      <g filter="url(#softer)" opacity={0.55}>
        <polygon points={`${CX - 3},${APEX_Y} ${CX + 3},${APEX_Y} ${CX + hw * 0.38},${H + 60} ${CX - hw * 0.38},${H + 60}`} fill="url(#beamV)" />
      </g>
      <ellipse cx={CX} cy={H - 10} rx={hw * 1.15} ry={120} fill="url(#pool)" />
      <ellipse cx={CX} cy={0} rx={300 * (0.5 + 0.5 * spread)} ry={190} fill="url(#hot)" />
    </svg>
  );
};

// Poussière : trajectoires périodiques sur la durée de la boucle.
const DUST = Array.from({ length: 110 }, (_, i) => ({
  x: CX + (rand(i) - 0.5) * 1100,
  y: rand(i + 500) * H,
  r: 0.8 + rand(i + 900) ** 2 * 2.6,
  blur: rand(i + 1300) > 0.82,
  kx: 1 + Math.floor(rand(i + 1700) * 2),
  ky: 1 + Math.floor(rand(i + 2100) * 2),
  ax: 10 + rand(i + 2500) * 26,
  ay: 14 + rand(i + 2900) * 30,
  ph: rand(i + 3300) * Math.PI * 2,
  tw: 2 + Math.floor(rand(i + 3700) * 4),
}));

export const Dust: React.FC = () => {
  const f = useCurrentFrame();
  const { intensity, spread } = useBeam();
  if (intensity <= 0.0005) return null;
  const T = (f / LOOP()) * Math.PI * 2;
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <filter id="dof" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation={2.2} />
        </filter>
      </defs>
      {DUST.map((d, i) => {
        const x = d.x + d.ax * Math.sin(T * d.kx + d.ph);
        const y = d.y + d.ay * Math.sin(T * d.ky + d.ph * 1.7) - 8 * Math.sin(T);
        const hw = halfWidthAt(y, spread);
        const inBeam = Math.max(0, 1 - (Math.abs(x - CX) / Math.max(hw, 1)) ** 2);
        const tw = 0.55 + 0.45 * Math.sin(T * d.tw + d.ph);
        const a = inBeam * tw * Math.min(1, intensity * 1.6);
        if (a < 0.01) return null;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={d.blur ? d.r * 2.4 : d.r}
            fill={COLORS.ink}
            opacity={a * (d.blur ? 0.35 : 0.8)}
            filter={d.blur ? 'url(#dof)' : undefined}
          />
        );
      })}
    </svg>
  );
};
