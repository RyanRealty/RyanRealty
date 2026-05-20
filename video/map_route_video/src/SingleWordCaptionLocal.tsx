/**
 * SingleWordCaptionLocal — portrait caption shim for MapRouteVideo.
 *
 * Wraps the canonical SingleWordCaption component inside a locally-typed
 * React.FC so TypeScript resolves JSX types against this project's own
 * node_modules/@types/react (18.x) rather than the root node_modules
 * (which carries @types/react 19.x). This is the same pattern used in
 * video/market-report-yt-long/src/KineticCaptions.tsx.
 *
 * Usage: <MapRouteCaptions words={...} />
 */

import React from 'react'
import { SingleWordCaption } from '../../../video_production_skills/captions/canonical/SingleWordCaption'
import { CAPTION_PORTRAIT } from '../../../video_production_skills/safe-zones/canonical/safe-zones'

export type CaptionWord = { text: string; startSec: number; endSec: number }

type Props = {
  words: CaptionWord[]
  suppressBeforeSec?: number
  suppressFrames?: Array<[number, number]>
}

export const MapRouteCaptions: React.FC<Props> = ({
  words,
  suppressBeforeSec = 2.0,
  suppressFrames,
}) => {
  return (
    <SingleWordCaption
      words={words}
      suppressBeforeSec={suppressBeforeSec}
      suppressFrames={suppressFrames}
      centerY={CAPTION_PORTRAIT.centerY}
      fontSizePx={CAPTION_PORTRAIT.fontSizePx}
      maxWidthPx={CAPTION_PORTRAIT.maxWidthPx}
    />
  )
}
