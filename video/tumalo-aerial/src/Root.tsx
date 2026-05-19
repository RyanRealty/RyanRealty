// Tumalo aerial — isolated Remotion project for Photorealistic 3D Tiles
// productions targeted at 19496 Tumalo Reservoir Rd. Sibling of cascade-peaks
// because cascade-peaks/Root.tsx is locked.

import React from 'react';
import { Composition } from 'remotion';

import { EarthZoomTumalo } from './EarthZoomTumalo';
import { FlyoverTumalo } from './FlyoverTumalo';

const FPS = 30;
const W = 1080;
const H = 1920;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EarthZoomTumalo"
        component={EarthZoomTumalo}
        durationInFrames={10 * FPS}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="FlyoverTumalo"
        component={FlyoverTumalo}
        durationInFrames={12 * FPS}
        fps={FPS}
        width={W}
        height={H}
      />
    </>
  );
};
