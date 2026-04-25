// BrandOutro — universal Ryan Realty closer. Solid navy + stacked logo +
// UI-click sting. Hard-locked across every video skill.

import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { NAVY } from './brand';
import { clamp, easeOutCubic } from './easing';

type Props = { startFrame: number; durationSec?: number };

const Inner: React.FC<{ fps: number; durationSec: number }> = ({ fps, durationSec }) => {
  const frame = useCurrentFrame();
  const local = frame / fps;
  if (local > durationSec) return null;

  const tIn = clamp((local - 0.2) / 1.0, 0, 1);
  const tOut = clamp((local - (durationSec - 0.3)) / 0.3, 0, 1);
  const alpha = easeOutCubic(tIn) * (1 - tOut);

  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: alpha,
        }}
      >
        <Img src={staticFile('brand/stacked_logo_white.png')} style={{ width: 540, height: 'auto' }} />
      </div>
      <Sequence from={Math.round(0.9 * fps)} durationInFrames={Math.round(1.1 * fps)}>
        <Audio src={staticFile('audio/brand_sting.mp3')} volume={1.0} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const BrandOutro: React.FC<Props> = ({ startFrame, durationSec = 2.5 }) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence from={startFrame} durationInFrames={Math.round(durationSec * fps)}>
      <Inner fps={fps} durationSec={durationSec} />
    </Sequence>
  );
};
