/**
 * KineticCaptions — LEGACY SHIM (landscape, 2026-05-20).
 *
 * YouTube long-form market report wrapper. The 1920×1080 frame uses
 * landscape caption defaults from `safe-zones/canonical/safe-zones.ts`:
 *   centerY=940, fontSizePx=96, maxWidthPx=1600
 *
 * Per Matt directive 2026-05-20: single-word Amboqia caption rule
 * replaces the older sentence-with-karaoke-highlight pattern. See
 * video_production_skills/captions/SKILL.md.
 */

import React from 'react'
import { SingleWordCaption } from '../../../video_production_skills/captions/canonical/SingleWordCaption'
import { CAPTION_LANDSCAPE } from '../../../video_production_skills/safe-zones/canonical/safe-zones'

export type CaptionWord = { text: string; startSec: number; endSec: number }

type Props = {
  words: CaptionWord[]
  /** Frame ranges where captions are suppressed (e.g. outro, chapter transitions). Inclusive. */
  suppressFrames?: Array<[number, number]>
}

const INTRO_NO_CAPTION_END_SEC = 3.0

export const KineticCaptions: React.FC<Props> = ({ words, suppressFrames }) => {
  return (
    <SingleWordCaption
      words={words}
      suppressBeforeSec={INTRO_NO_CAPTION_END_SEC}
      suppressFrames={suppressFrames}
      centerY={CAPTION_LANDSCAPE.centerY}
      fontSizePx={CAPTION_LANDSCAPE.fontSizePx}
      maxWidthPx={CAPTION_LANDSCAPE.maxWidthPx}
    />
  )
}
