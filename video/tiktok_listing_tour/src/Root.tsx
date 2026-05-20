/**
 * Root — Remotion composition registry for the tiktok_listing_tour project.
 *
 * Default: 7-beat exemplar for 19496 Tumalo Reservoir Rd ($895K on 2.28 acres).
 * Build script (scripts/build_tiktok_listing_tour.py) injects real listing
 * photos from Supabase and a real VO MP3 from ElevenLabs.
 */

import React from 'react'
import { ComponentType } from 'react'
import { Composition } from 'remotion'

import {
  TikTokListingTour,
  TikTokListingTourInput,
  computeTotalFrames,
} from './TikTokListingTour'

const FPS = 30
const WIDTH = 1080
const HEIGHT = 1920

// 7 beats: hook 3s + 5×4s interior/ext + final CTA 4s = 31s
const DEFAULT_BEATS: TikTokListingTourInput['beats'] = [
  { durationSec: 3, photoPath: null, motion: 'push_in' },
  { durationSec: 4, photoPath: null, captionOverlay: 'Open kitchen', motion: 'push_out' },
  { durationSec: 4, photoPath: null, captionOverlay: 'Primary suite', motion: 'pan_left' },
  { durationSec: 3, photoPath: null, captionOverlay: '2.28 acres', motion: 'pan_right' },  // 50% interrupt
  { durationSec: 4, photoPath: null, captionOverlay: 'Mountain views', motion: 'push_in' },
  { durationSec: 4, photoPath: null, captionOverlay: 'Shop + RV space', motion: 'push_out' },
  { durationSec: 4, photoPath: null, motion: 'push_in' },                                   // CTA beat
]

const DEFAULT_PROPS: TikTokListingTourInput = {
  keywordPhrase: 'What $895,000 gets you on 2 acres in Tumalo, Oregon.',
  displayPrice: '$895,000',
  cityState: 'Tumalo, Oregon',
  beats: DEFAULT_BEATS,
  captionWords: [],
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TikTokListingTour"
        component={TikTokListingTour as unknown as ComponentType<Record<string, unknown>>}
        durationInFrames={computeTotalFrames(DEFAULT_BEATS)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={({ props }) => ({
          durationInFrames: computeTotalFrames((props as unknown as TikTokListingTourInput).beats),
        })}
      />
    </>
  )
}
