import React from 'react';
import { Composition } from 'remotion';
import './fonts';
import { Listing, LISTING_TOTAL_SEC } from './Listing';
import { BoundaryDrawTest } from './BoundaryDrawTest';

const FPS = 30;
const W_PORT = 1080;
const H_PORT = 1920;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="SchoolhousePortrait"
      component={Listing as any}
      durationInFrames={Math.round(LISTING_TOTAL_SEC * FPS)}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
    />
    <Composition
      id="BoundaryDrawTest"
      component={BoundaryDrawTest}
      durationInFrames={6 * FPS}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
    />
  </>
);
