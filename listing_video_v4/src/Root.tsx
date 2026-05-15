import React from 'react';
import { Composition } from 'remotion';
import './fonts';
import { Listing, LISTING_TOTAL_SEC } from './Listing';
// LISTING_TOTAL_SEC = 122 (v5.1)
import { Tumalo, TUMALO_TOTAL_SEC } from './Tumalo';
import { TumaloCascadeCreek, TUMALO_CC_TOTAL_SEC } from './TumaloCascadeCreek';
import { TumaloLife, TUMALO_LIFE_TOTAL_SEC } from './TumaloLife';
import { MorningTextScene, MORNING_TEXT_TOTAL_SEC } from './MorningTextScene';
import { BoundaryDrawTest } from './BoundaryDrawTest';
import { ClipGoldenHandcuffs, CLIP_GH_TOTAL_SEC } from './news/ClipGoldenHandcuffs';
import { ClipSunBeltCorrection, CLIP_SBC_TOTAL_SEC } from './news/ClipSunBeltCorrection';
import { ClipTariffs, CLIP_TARIFFS_TOTAL_SEC } from './news/ClipTariffs';
import { ClipRemaxRealMerger, CLIP_MERGER_TOTAL_SEC } from './news/ClipRemaxRealMerger';
import { SingleImageReel, SINGLE_IMAGE_REEL_DURATION_FRAMES } from './SingleImageReel';

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
      id="TumaloPortrait"
      component={Tumalo as any}
      durationInFrames={Math.round(TUMALO_TOTAL_SEC * FPS)}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
    />
    <Composition
      id="MorningText3D"
      component={MorningTextScene as any}
      durationInFrames={Math.round(MORNING_TEXT_TOTAL_SEC * FPS)}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
    />
    <Composition
      id="BoundaryDrawTest"
      component={BoundaryDrawTest}
      durationInFrames={7 * FPS}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
    />
    <Composition
      id="NewsGoldenHandcuffs"
      component={ClipGoldenHandcuffs as any}
      durationInFrames={Math.round(CLIP_GH_TOTAL_SEC * FPS)}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
    />
    <Composition
      id="NewsSunBeltCorrection"
      component={ClipSunBeltCorrection as any}
      durationInFrames={Math.round(CLIP_SBC_TOTAL_SEC * FPS)}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
    />
    <Composition
      id="NewsTariffs"
      component={ClipTariffs as any}
      durationInFrames={Math.round(CLIP_TARIFFS_TOTAL_SEC * FPS)}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
    />
    <Composition
      id="NewsRemaxRealMerger"
      component={ClipRemaxRealMerger as any}
      durationInFrames={Math.round(CLIP_MERGER_TOTAL_SEC * FPS)}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
    />
    <Composition
      id="TumaloCascadeCreek"
      component={TumaloCascadeCreek as any}
      durationInFrames={Math.round(TUMALO_CC_TOTAL_SEC * FPS)}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
    />
    <Composition
      id="TumaloLife"
      component={TumaloLife as any}
      durationInFrames={Math.round(TUMALO_LIFE_TOTAL_SEC * FPS)}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
    />
    <Composition
      id="SingleImageReel"
      component={SingleImageReel as any}
      durationInFrames={SINGLE_IMAGE_REEL_DURATION_FRAMES}
      fps={FPS}
      width={W_PORT}
      height={H_PORT}
      defaultProps={{
        layout: 's2',
        photoPath: 'reels-photos/schoolhouse.jpg',
        bigWords: ['Sold'],
        sub: 'Off-market  ·  $3,025,000',
        address: '56111 SCHOOL HOUSE RD  ·  VANDEVERT RANCH  ·  BEND, OREGON',
      }}
    />
  </>
);
