// CascadePeaks — the main composition. Stitches the scenes in order:
//   1. OpeningCard (Jefferson, graded) — "how many can you name?"
//   2. AubreyButtePan — skyline pan south→north with HUD markers
//   3. Per-peak deep-dives (10 peaks, 8.5s each)
//   4. ClosingCard (Washington, graded) — contact info
//
// Scenes layered via <Sequence from=... durationInFrames=...>; they also
// receive a `frameOffset` prop so internal easings use scene-local frames
// and the TilesScene keeps the tile cache warm across scenes.

import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import './fonts';

import {
  AUBREY_PAN_SEC,
  CLOSING_CARD_SEC,
  FPS,
  OPENING_CARD_SEC,
  PER_PEAK_SEC,
} from './config';
import { AubreyButtePan } from './AubreyButtePan';
import { ClosingCard } from './ClosingCard';
import { OpeningCard } from './OpeningCard';
import { PeakOrbit } from './PeakOrbit';
import { PEAKS } from './peaks';

const s = (sec: number) => Math.round(sec * FPS);

export const CascadePeaks: React.FC = () => {
  // Build sequence offsets
  const openingStart = 0;
  const panStart = openingStart + s(OPENING_CARD_SEC);
  const peaksStart = panStart + s(AUBREY_PAN_SEC);
  const closingStart = peaksStart + s(PER_PEAK_SEC * PEAKS.length);

  return (
    <AbsoluteFill style={{ background: '#0a1a2e' }}>
      {/* Opening card */}
      <Sequence from={openingStart} durationInFrames={s(OPENING_CARD_SEC)}>
        <OpeningCard frameOffset={0} />
      </Sequence>

      {/* Aubrey Butte panoramic skyline pan */}
      <Sequence from={panStart} durationInFrames={s(AUBREY_PAN_SEC)}>
        <AubreyButtePan frameOffset={0} />
      </Sequence>

      {/* Per-peak deep-dives */}
      {PEAKS.map((peak, idx) => (
        <Sequence
          key={peak.id}
          from={peaksStart + idx * s(PER_PEAK_SEC)}
          durationInFrames={s(PER_PEAK_SEC)}
        >
          <PeakOrbit peak={peak} displayOrder={idx + 1} frameOffset={0} />
        </Sequence>
      ))}

      {/* Closing card */}
      <Sequence from={closingStart} durationInFrames={s(CLOSING_CARD_SEC)}>
        <ClosingCard frameOffset={0} />
      </Sequence>
    </AbsoluteFill>
  );
};
