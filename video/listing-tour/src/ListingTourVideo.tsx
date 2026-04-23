import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';

import { ActSlideshow, TourPhotoSlide } from './ActSlideshow';
import { ClosingCardScene } from './ClosingCardScene';
import { HeroStatsOverlay } from './HeroStatsOverlay';
import { NeighborhoodOverlay } from './NeighborhoodOverlay';
import { ViralHookOverlay } from './ViralHookOverlay';
import { ViralSafeChrome } from './ViralSafeChrome';
import {
  ACT1_FRAMES_BRANDED,
  ACT2_FRAMES,
  ACT3_FRAMES,
  ACT4_FRAMES,
  ACT5_FRAMES,
  HOOK_ACT2_OVERLAP_FRAMES,
  REEL_INTERIOR_COUNT,
  REEL_TAIL_COUNT,
} from './config';
import { defaultViralPackFromListing } from './mls-copy';
import type { TourInputProps, TourPhoto } from './tour-types';

import './fonts';

export const ListingTourVideo: React.FC<TourInputProps> = ({
  branded,
  listing,
  photos,
  brollPhotos = [],
  compStats,
  viral,
  voiceStaticPath,
}) => {
  const act1 = branded ? ACT1_FRAMES_BRANDED : 0;
  const act2From = act1;
  const act3From = act2From + ACT2_FRAMES;
  const act4From = act3From + ACT3_FRAMES;
  const act5From = act4From + ACT4_FRAMES;
  /** Hook clears partway into Act2 — see `HOOK_ACT2_OVERLAP_FRAMES` in config. */
  const hookEndFrame = act2From + HOOK_ACT2_OVERLAP_FRAMES;
  const viralPack = viral ?? defaultViralPackFromListing(listing);

  const hero = photos[0];
  const interiors = useMemo(() => {
    const slice = photos.slice(1, 1 + REEL_INTERIOR_COUNT);
    if (slice.length > 0) return slice;
    return hero ? [hero] : [];
  }, [photos, hero]);

  const tail = useMemo(() => {
    const broll = (brollPhotos ?? []).filter((p) => p?.url?.trim());
    if (broll.length >= REEL_TAIL_COUNT) {
      return broll.slice(0, REEL_TAIL_COUNT);
    }
    const start = 1 + REEL_INTERIOR_COUNT;
    const s = photos.slice(start, start + REEL_TAIL_COUNT);
    if (s.length >= REEL_TAIL_COUNT) return s;
    if (photos.length >= 2) return photos.slice(-REEL_TAIL_COUNT);
    return hero ? [hero] : [];
  }, [photos, hero, brollPhotos]);

  if (!hero) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#102742',
          color: '#fff',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: 32,
        }}
      >
        No photos in tour props
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {voiceStaticPath ? (
        <Audio src={staticFile(voiceStaticPath)} />
      ) : null}

      {branded ? <ViralSafeChrome /> : null}

      {branded ? (
        <Sequence from={0} durationInFrames={act1}>
          <TourPhotoSlide
            photo={hero}
            sequenceFrom={0}
            durationInFrames={act1}
            direction="in"
          />
        </Sequence>
      ) : null}

      <Sequence from={act2From} durationInFrames={ACT2_FRAMES}>
        <TourPhotoSlide
          photo={hero}
          sequenceFrom={act2From}
          durationInFrames={ACT2_FRAMES}
          direction="in"
        />
        <HeroStatsOverlay listing={listing} act2From={act2From} />
      </Sequence>

      <ActSlideshow
        photos={interiors as TourPhoto[]}
        sequenceFrom={act3From}
        totalFrames={ACT3_FRAMES}
      />

      <ActSlideshow
        photos={tail as TourPhoto[]}
        sequenceFrom={act4From}
        totalFrames={ACT4_FRAMES}
      />

      <NeighborhoodOverlay
        postalCode={listing.PostalCode}
        compStats={compStats}
        act4From={act4From}
        act4Frames={ACT4_FRAMES}
      />

      <Sequence from={act5From} durationInFrames={ACT5_FRAMES}>
        <ClosingCardScene branded={branded} listing={listing} />
      </Sequence>

      {branded && viralPack ? (
        <ViralHookOverlay viral={viralPack} hookEndFrame={hookEndFrame} />
      ) : null}
    </AbsoluteFill>
  );
};
