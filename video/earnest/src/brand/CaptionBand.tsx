/**
 * Earnest. CaptionBand — LEGACY SHIM (2026-05-20).
 *
 * Earnest. uses a different word shape (AlignedWord with start/end) and an
 * optional offsetSeconds for VO that doesn't start at frame 0. This shim
 * maps the Earnest API to the canonical SingleWordCaption.
 *
 * Per Matt directive 2026-05-20: single-word Amboqia caption rule replaces
 * the older sentence-with-active-word-highlight pattern (which had used
 * the Ember accent color). All Ryan Realty brand video (including Earnest.)
 * now uses the canonical white-on-photo single-word treatment.
 *
 * See video_production_skills/captions/SKILL.md for the full rule.
 */

import React from 'react'
import { SingleWordCaption } from '../../../../video_production_skills/captions/canonical/SingleWordCaption'

/** Forced-alignment word entry — Earnest. legacy shape. */
export interface AlignedWord {
  text: string
  start: number
  end: number
}

export const CaptionBand: React.FC<{
  /** Word-level forced-alignment data for the entire episode VO. */
  words: AlignedWord[]
  /** Optional per-line offset, in seconds, if VO doesn't start at frame 0. */
  offsetSeconds?: number
}> = ({ words, offsetSeconds = 0 }) => {
  // Map AlignedWord → CaptionWord with the offset baked in.
  const mapped = words.map((w) => ({
    text: w.text,
    startSec: w.start + offsetSeconds,
    endSec: w.end + offsetSeconds,
  }))
  return <SingleWordCaption words={mapped} />
}
