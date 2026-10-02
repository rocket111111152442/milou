import React from 'react';
import { Composition } from 'remotion';
import { HeroLoop } from './HeroLoop';
import { VIDEO } from './config';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="HeroHorsChamp"
    component={HeroLoop}
    width={VIDEO.width}
    height={VIDEO.height}
    fps={VIDEO.fps}
    durationInFrames={Math.round(VIDEO.fps * VIDEO.durationInSeconds)}
  />
);
