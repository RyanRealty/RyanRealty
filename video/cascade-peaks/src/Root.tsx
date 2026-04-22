// Remotion composition registration.

import React from 'react';
import { Composition } from 'remotion';

import { CascadePeaks } from './CascadePeaks';
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from './config';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CascadePeaks"
        component={CascadePeaks}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
