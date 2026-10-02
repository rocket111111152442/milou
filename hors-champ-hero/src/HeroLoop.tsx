import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS } from './config';
import { Beam, Dust } from './Beam';
import { Aperture, ApertureGlow } from './Aperture';
import { LightLeak, Logo } from './Logo';
import { Grain, Viewfinder } from './Overlay';

export const HeroLoop: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.background, overflow: 'hidden' }}>
    <Beam />
    <Dust />
    <ApertureGlow />
    <Aperture />
    <Logo />
    <LightLeak />
    <Viewfinder />
    <Grain />
  </AbsoluteFill>
);
