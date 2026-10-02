import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { COLORS, TAGLINE, TIMING, VIDEO } from './config';
import { bell, ramp } from './anim';
import { courierPrime } from './fonts';

const LOGO_WIDTH = 940; // reste largement dans les 80 % centraux (1536 px)

export const Logo: React.FC = () => {
  const f = useCurrentFrame();
  const inP = ramp(f, TIMING.logoIn);
  const out = ramp(f, TIMING.dissolve);
  const tagIn = ramp(f, TIMING.taglineIn);
  const tagOut = ramp(f, [TIMING.dissolve[0], TIMING.dissolve[0] + 0.5]);
  const a = inP * (1 - out);
  if (a <= 0.001 && tagIn * (1 - tagOut) <= 0.001) return null;
  const blur = (1 - inP) * 14 + out * 22;
  const scale = 1.04 - 0.04 * inP + 0.06 * out;
  const glow = 0.35 + 0.25 * bell(f, TIMING.leak);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Img
        src={staticFile('hors-champ-logo-clair.svg')}
        style={{
          width: LOGO_WIDTH,
          height: 'auto',
          opacity: a,
          transform: `translateY(${-28 - out * 26}px) scale(${scale})`,
          filter: `blur(${blur}px) drop-shadow(0 0 22px rgba(233,170,69,${glow * a}))`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: VIDEO.height / 2 + 72,
          fontFamily: courierPrime,
          fontSize: 22,
          letterSpacing: '0.42em',
          paddingLeft: '0.42em',
          color: COLORS.ink,
          opacity: 0.82 * tagIn * (1 - tagOut),
          transform: `translateY(${(1 - tagIn) * 10}px)`,
        }}
      >
        {TAGLINE}
      </div>
    </div>
  );
};

/** Light leak : dégradé flou orange → tungstène, en mode screen, de gauche à droite. */
export const LightLeak: React.FC = () => {
  const f = useCurrentFrame();
  const p = ramp(f, TIMING.leak, (x) => x);
  const a = bell(f, TIMING.leak);
  if (a <= 0.001) return null;
  const x = -900 + p * (VIDEO.width + 1500);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: -380,
        width: 760,
        height: VIDEO.height + 760,
        transform: 'rotate(14deg)',
        background: `linear-gradient(90deg, ${COLORS.leakFrom}00 0%, ${COLORS.leakFrom} 35%, ${COLORS.leakTo} 65%, ${COLORS.leakTo}00 100%)`,
        filter: 'blur(90px)',
        mixBlendMode: 'screen',
        opacity: 0.6 * a,
      }}
    />
  );
};
