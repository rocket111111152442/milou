import React from 'react';
import { useCurrentFrame } from 'remotion';
import { COLORS, GRAIN_OPACITY, SAFE_X, VIDEO } from './config';
import { courierPrime } from './fonts';

const { width: W, height: H, fps } = VIDEO;
const INSET_Y = 40;
const ARM = 34;

/** Coins de viseur, ● REC clignotant, timecode 00:00:SS:FF — dans la zone de sécurité. */
export const Viewfinder: React.FC = () => {
  const f = useCurrentFrame();
  const x0 = SAFE_X + 24, x1 = W - SAFE_X - 24, y0 = INSET_Y, y1 = H - INSET_Y;
  const corners = [
    [x0, y0, 1, 1],
    [x1, y0, -1, 1],
    [x0, y1, 1, -1],
    [x1, y1, -1, -1],
  ];
  const ss = Math.floor(f / fps), ff = f % fps;
  const tc = `00:00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
  const recOn = f % fps < fps * 0.62; // période 1 s → 8 cycles exacts sur 8 s
  const label: React.CSSProperties = { position: 'absolute', fontFamily: courierPrime, fontSize: 18, color: COLORS.ink, opacity: 0.5, letterSpacing: '0.12em', lineHeight: 1 };
  return (
    <>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        {corners.map(([x, y, sx, sy], i) => (
          <path key={i} d={`M${x},${y + sy * ARM} L${x},${y} L${x + sx * ARM},${y}`} fill="none" stroke={COLORS.ink} strokeOpacity={0.32} strokeWidth={1.6} />
        ))}
      </svg>
      <div style={{ ...label, left: x0 + 18, top: y0 + 18, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: COLORS.rec, opacity: recOn ? 1 : 0.12, boxShadow: recOn ? `0 0 8px ${COLORS.rec}` : 'none' }} />
        <span style={{ opacity: recOn ? 1 : 0.35 }}>REC</span>
      </div>
      <div style={{ ...label, right: W - x1 + 18, top: y0 + 18 }}>{tc}</div>
    </>
  );
};

/** Grain pellicule animé (bruit fractal, nouvelle graine à chaque image). */
export const Grain: React.FC = () => {
  const f = useCurrentFrame();
  // Rendu à mi-résolution puis agrandi : grain plus « pellicule » et vidéo plus légère.
  return (
    <svg
      width={W / 2}
      height={H / 2}
      style={{ position: 'absolute', left: 0, top: 0, transform: 'scale(2)', transformOrigin: '0 0', opacity: GRAIN_OPACITY }}
    >
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={1} seed={f + 1} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
};
