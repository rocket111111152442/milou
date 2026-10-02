import { Easing, interpolate } from 'remotion';
import { VIDEO } from './config';

// cubic-bezier(.2,.7,.2,1) — courbe douce, sans à-coups
export const ease = Easing.bezier(0.2, 0.7, 0.2, 1);
export const easeInOut = Easing.bezier(0.45, 0, 0.25, 1);

/** 0 → 1 entre deux instants (secondes), avec easing. */
export const ramp = (frame: number, [a, b]: number[], easing = ease) =>
  interpolate(frame, [a * VIDEO.fps, b * VIDEO.fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

/** Bosse 0 → 1 → 0 sur un intervalle (pour un passage de lumière). */
export const bell = (frame: number, [a, b]: number[]) => {
  const p = interpolate(frame, [a * VIDEO.fps, b * VIDEO.fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return Math.sin(p * Math.PI) ** 2;
};

/** Pseudo-aléatoire déterministe. */
export const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const LOOP = () => VIDEO.fps * VIDEO.durationInSeconds;
