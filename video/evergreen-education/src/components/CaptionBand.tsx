/**
 * evergreen-education CaptionBand — LEGACY SHIM (2026-05-20).
 *
 * The legacy implementation supported both `words` (word-level) and
 * `sentences` (precomputed sentence boundaries with words) inputs. The
 * single-word rule renders one word at a time regardless, so `sentences`
 * is now ignored — we just need the underlying word stream.
 *
 * Per Matt directive 2026-05-20: single-word Amboqia caption rule replaces
 * the older sentence-with-karaoke-highlight pattern. See
 * video_production_skills/captions/SKILL.md.
 */

import React from 'react'
import { SingleWordCaption } from '../../../../video_production_skills/captions/canonical/SingleWordCaption'

export type CaptionWord = { text: string; startSec: number; endSec: number }

export type CaptionSentence = {
  text: string
  startSec: number
  endSec: number
  words: CaptionWord[]
}

export const CaptionBand: React.FC<{
  words: CaptionWord[]
  /** Legacy — ignored. The single-word rule does not group into sentences. */
  sentences?: CaptionSentence[]
}> = ({ words, sentences }) => {
  // If only sentences were passed (no `words`), flatten them.
  const source: CaptionWord[] = words.length > 0
    ? words
    : (sentences ?? []).flatMap((s) => s.words)
  return <SingleWordCaption words={source} />
}
