/**
 * CaptionBand — LEGACY SHIM (2026-05-20).
 *
 * The market-report comp historically rendered a full-sentence caption with
 * a karaoke active-word highlight (gold). Matt locked the single-word
 * Amboqia rule on 2026-05-20 (see CLAUDE.md §0.5 + video_production_skills/
 * captions/SKILL.md). All caption rendering now flows through the canonical
 * SingleWordCaption component.
 *
 * This file remains as a thin wrapper so existing imports (MarketReport.tsx
 * etc.) keep compiling. It re-exports the legacy CaptionWord type and the
 * CaptionBand name, but renders single-word-style underneath.
 */

import React from 'react'
import { SingleWordCaption } from '../../../video_production_skills/captions/canonical/SingleWordCaption'

export type CaptionWord = { text: string; startSec: number; endSec: number }

// Suppress captions during the opening title card (clean look for social tile preview).
const INTRO_NO_CAPTION_END_SEC = 4.0

export const CaptionBand: React.FC<{ words: CaptionWord[] }> = ({ words }) => {
  return <SingleWordCaption words={words} suppressBeforeSec={INTRO_NO_CAPTION_END_SEC} />
}
