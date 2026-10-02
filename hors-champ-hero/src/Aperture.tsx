import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { COLORS, TIMING, VIDEO } from './config';
import { ease, ramp } from './anim';

const CX = VIDEO.width / 2;
const CY = VIDEO.height / 2;
const R = 150; // rayon du diaphragme à l'écran
const BLADES = 6;
// L'icône SVG (viewBox 200, cercle r=92) est affichée à la même échelle que les lames.
const ICON_SIZE = (200 * R) / 92;

function bladePath(i: number, open: number) {
  const th = (i / BLADES) * Math.PI * 2 - Math.PI / 2;
  const r = R * open;
  const p = [CX + r * Math.cos(th), CY + r * Math.sin(th)];
  const d = [-Math.sin(th), Math.cos(th)];
  const o = [Math.cos(th), Math.sin(th)];
  const a = [p[0] - d[0] * R * 0.15, p[1] - d[1] * R * 0.15];
  const b = [p[0] + d[0] * R * 1.25, p[1] + d[1] * R * 1.25];
  const c = [b[0] + o[0] * R, b[1] + o[1] * R];
  const e = [a[0] + o[0] * R, a[1] + o[1] * R];
  return `M${a}L${b}L${c}L${e}Z`;
}

/** Diaphragme : les lames entrent une à une en rotation, puis l'icône SVG prend le relais et devient lueur. */
export const Aperture: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / VIDEO.fps;
  if (t < TIMING.bladesIn[0] - 0.05 || t > TIMING.iconBloom[1] + 0.1) return null;

  const [b0, b1] = TIMING.bladesIn;
  const ring = ramp(f, [b0, b0 + 0.45]);
  const open = 0.42 * ramp(f, [b0 + 0.25, b1 + 0.15]);
  const spin = -50 * (1 - ramp(f, [b0, b1 + 0.3])) + 8 * ramp(f, [b1, TIMING.iconBloom[1]]);
  const toIcon = ramp(f, TIMING.irisToIcon);
  const bloom = ramp(f, TIMING.iconBloom);
  const step = (b1 - b0 - 0.35) / BLADES;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - bloom, filter: `blur(${bloom * 16}px)`, transform: `scale(${1 + bloom * 0.22})` }}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: 'absolute', inset: 0, opacity: 1 - toIcon }}>
        <defs>
          <clipPath id="irisClip">
            <circle cx={CX} cy={CY} r={R - 8} />
          </clipPath>
        </defs>
        <circle cx={CX} cy={CY} r={R - 4} fill="none" stroke={COLORS.ink} strokeWidth={R * 0.07 * ring} opacity={ring} />
        <g clipPath="url(#irisClip)" transform={`rotate(${spin} ${CX} ${CY})`}>
          {Array.from({ length: BLADES }, (_, i) => {
            const k = ramp(f, [b0 + i * step, b0 + i * step + 0.45], ease);
            return (
              <g key={i} opacity={k} transform={`rotate(${(1 - k) * 40} ${CX} ${CY})`}>
                <path d={bladePath(i, open + (1 - k) * 0.6)} fill={COLORS.background} fillOpacity={0.55} stroke={COLORS.ink} strokeWidth={R * 0.045} strokeLinejoin="round" />
              </g>
            );
          })}
        </g>
      </svg>
      <Img
        src={staticFile('hors-champ-icone-clair.svg')}
        style={{
          position: 'absolute',
          width: ICON_SIZE,
          height: ICON_SIZE,
          left: CX - ICON_SIZE / 2,
          top: CY - ICON_SIZE / 2,
          opacity: toIcon,
          transform: `rotate(${spin}deg)`,
        }}
      />
    </div>
  );
};

/** Lueur tungstène qui naît du diaphragme et se fond dans le logo. */
export const ApertureGlow: React.FC = () => {
  const f = useCurrentFrame();
  const a = ramp(f, [TIMING.irisToIcon[0], TIMING.iconBloom[1] - 0.1]) * (1 - ramp(f, [TIMING.iconBloom[1] - 0.1, TIMING.logoIn[1] + 0.3]));
  if (a <= 0.001) return null;
  const r = 180 + 260 * ramp(f, TIMING.iconBloom);
  return (
    <div
      style={{
        position: 'absolute',
        left: CX - r,
        top: CY - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.ink}cc 0%, ${COLORS.accent}99 22%, ${COLORS.accent}33 50%, ${COLORS.accent}00 70%)`,
        opacity: a * 0.85,
        mixBlendMode: 'screen',
      }}
    />
  );
};
