/**
 * KineticCaptions — LEGACY SHIM (2026-05-20).
 *
 * Per Matt directive 2026-05-20: single-word Amboqia caption rule replaces
 * the older sentence-with-karaoke-highlight pattern. All caption rendering
 * funnels through the canonical SingleWordCaption component.
 *
 * The legacy `chunkSize` prop is ignored — single-word mode doesn't chunk.
 * The `suppressFrames` prop is preserved and passed through.
 *
 * See video_production_skills/captions/SKILL.md for the canonical rule.
 */

import React from 'react'
import { SingleWordCaption } from '../../../video_production_skills/captions/canonical/SingleWordCaption'

export type CaptionWord = { text: string; startSec: number; endSec: number }

type Props = {
  words: CaptionWord[]
  /** Frame ranges where captions are suppressed (e.g. during outro). Inclusive. */
  suppressFrames?: Array<[number, number]>
  /** Legacy — ignored. Single-word mode renders one word at a time, no chunking. */
  chunkSize?: number
}

const INTRO_NO_CAPTION_END_SEC = 4.0

export const KineticCaptions: React.FC<Props> = ({ words, suppressFrames }) => {
  return (
    <SingleWordCaption
      words={words}
      suppressBeforeSec={INTRO_NO_CAPTION_END_SEC}
      suppressFrames={suppressFrames}
    />
  )
}
