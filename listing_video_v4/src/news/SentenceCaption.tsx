/**
 * SentenceCaption — LEGACY SHIM (2026-05-20).
 *
 * listing_video_v4 news clips used a TikTok-style full-sentence caption
 * with active-word gold highlight + Anton font + black outline. Per Matt
 * directive 2026-05-20, all Ryan Realty video captions consolidate on the
 * single-word Amboqia rule (see video_production_skills/captions/SKILL.md).
 *
 * This shim preserves the legacy SentenceCaption API surface (centerY,
 * maxWidth, fontSize props) and maps it to the canonical SingleWordCaption.
 * The deprecated `maxWidth` legacy prop maps to the canonical `maxWidthPx`.
 */

import React from 'react'
import { SingleWordCaption } from '../../../video_production_skills/captions/canonical/SingleWordCaption'

export type CaptionWord = { text: string; startSec: number; endSec: number }

type Props = {
  words: CaptionWord[]
  /** Override: vertical center line of the caption band. */
  centerY?: number
  /** Override: max width of each line in px. */
  maxWidth?: number
  /** Override: font size in px. */
  fontSize?: number
}

export const SentenceCaption: React.FC<Props> = ({
  words,
  centerY,
  maxWidth,
  fontSize,
}) => {
  return (
    <SingleWordCaption
      words={words}
      centerY={centerY}
      fontSizePx={fontSize}
      maxWidthPx={maxWidth}
    />
  )
}
