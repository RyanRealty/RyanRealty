/**
 * SingleWordCaption — canonical Ryan Realty caption component.
 *
 * Locked 2026-05-20 per Matt directive. Supersedes the older sentence-with-
 * active-word-highlight pattern that lived in:
 *   - video/market-report/src/CaptionBand.tsx
 *   - video/market-report/src/KineticCaptions.tsx
 *   - video/market-report-yt-long/src/KineticCaptions.tsx
 *   - video/earnest/src/brand/CaptionBand.tsx
 *   - video/evergreen-education/src/components/CaptionBand.tsx
 *   - listing_video_v4/src/news/SentenceCaption.tsx
 *
 * One word at a time, large, centered in the caption safe zone, in
 * Amboqia Boriango. The word appears at speech start and fades out at
 * speech end, synced to ElevenLabs /v1/forced-alignment word timestamps.
 * Crossfade ≤ 100 ms between adjacent words. Same look across every
 * video the brand ships.
 *
 * See video_production_skills/captions/SKILL.md for the full rule + spec.
 *
 * Usage (from any Remotion comp):
 *
 *   import { SingleWordCaption } from '../../../video_production_skills/captions/canonical/SingleWordCaption'
 *
 *   <SingleWordCaption
 *     words={captionWords}
 *     suppressBeforeSec={4.0}
 *     centerY={1600}
 *     fontSizePx={120}
 *     maxWidthPx={900}
 *   />
 */

import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { CAPTION_PORTRAIT } from '../../safe-zones/canonical/safe-zones'

/** Forced-alignment word entry from ElevenLabs /v1/forced-alignment. Time in seconds. */
export type CaptionWord = {
  text: string
  startSec: number
  endSec: number
}

export interface SingleWordCaptionProps {
  /** Word-level forced-alignment data. Empty / whitespace tokens are filtered. */
  words: CaptionWord[]
  /** Suppress captions before this timestamp (e.g. 4.0 to skip the opening title card). Default 0. */
  suppressBeforeSec?: number
  /** Frame ranges to suppress (inclusive). Use for chapter transitions, outros, etc. */
  suppressFrames?: Array<[number, number]>
  /**
   * Vertical center pixel of the caption row. Defaults to CAPTION_PORTRAIT.centerY
   * (1370) — inside the portrait safe zone. For landscape pass CAPTION_LANDSCAPE.centerY
   * (940). For square pass CAPTION_SQUARE.centerY (930). All from
   * `video_production_skills/safe-zones/canonical/safe-zones.ts`.
   */
  centerY?: number
  /** Font size in px. Defaults to CAPTION_PORTRAIT.fontSizePx (120). Landscape: 96. */
  fontSizePx?: number
  /** Max width of the caption row in px. Defaults to CAPTION_PORTRAIT.maxWidthPx (900). Landscape: 1600. */
  maxWidthPx?: number
}

const FONT_FAMILY = '"Amboqia Boriango", Amboqia, serif'
const CROSSFADE_SEC = 0.08
const WHITE = '#FFFFFF'
const TEXT_SHADOW = [
  '0 0 24px rgba(0,0,0,0.75)',
  '0 4px 12px rgba(0,0,0,0.85)',
  '0 2px 4px rgba(0,0,0,0.95)',
].join(', ')

export const SingleWordCaption: React.FC<SingleWordCaptionProps> = ({
  words,
  suppressBeforeSec = 0,
  suppressFrames = [],
  centerY = CAPTION_PORTRAIT.centerY,
  fontSizePx = CAPTION_PORTRAIT.fontSizePx,
  maxWidthPx = CAPTION_PORTRAIT.maxWidthPx,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps

  // Suppression checks
  for (const [s, e] of suppressFrames) {
    if (frame >= s && frame <= e) return null
  }
  if (!words || words.length === 0) return null
  if (t < suppressBeforeSec) return null

  // Drop empty / whitespace-only entries (forced-alignment occasionally pads spaces).
  const cleaned = words.filter((w) => w.text && w.text.trim().length > 0)
  if (cleaned.length === 0) return null

  // Active word: t lies in [startSec, endSec).
  const activeIdx = cleaned.findIndex((w) => t >= w.startSec && t < w.endSec)

  if (activeIdx !== -1) {
    const w = cleaned[activeIdx]
    const fadeIn = interpolate(t, [w.startSec, w.startSec + CROSSFADE_SEC], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
    const fadeOut = interpolate(t, [w.endSec - CROSSFADE_SEC, w.endSec], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
    const opacity = Math.min(fadeIn, fadeOut)
    return <Word text={w.text} opacity={opacity} centerY={centerY} fontSizePx={fontSizePx} maxWidthPx={maxWidthPx} />
  }

  // In a gap between words. Decide whether to fade out the previous word or fade in the next.
  let prevIdx = -1
  for (let i = cleaned.length - 1; i >= 0; i--) {
    if (cleaned[i].endSec <= t) {
      prevIdx = i
      break
    }
  }
  const nextIdx = cleaned.findIndex((w) => w.startSec > t)

  // Fade in the next word if it's within the crossfade window.
  if (nextIdx !== -1) {
    const next = cleaned[nextIdx]
    if (next.startSec - t < CROSSFADE_SEC) {
      const opacity = interpolate(t, [next.startSec - CROSSFADE_SEC, next.startSec], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
      return <Word text={next.text} opacity={opacity} centerY={centerY} fontSizePx={fontSizePx} maxWidthPx={maxWidthPx} />
    }
  }

  // Fade out the previous word if it's within the crossfade window.
  if (prevIdx !== -1) {
    const prev = cleaned[prevIdx]
    if (t - prev.endSec < CROSSFADE_SEC) {
      const opacity = interpolate(t, [prev.endSec, prev.endSec + CROSSFADE_SEC], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
      return <Word text={prev.text} opacity={opacity} centerY={centerY} fontSizePx={fontSizePx} maxWidthPx={maxWidthPx} />
    }
  }

  // True silence — render nothing.
  return null
}

type WordProps = {
  text: string
  opacity: number
  centerY: number
  fontSizePx: number
  maxWidthPx: number
}

const Word: React.FC<WordProps> = ({ text, opacity, centerY, fontSizePx, maxWidthPx }) => {
  // Strip trailing punctuation so single words don't render with a stray comma / period / colon.
  // The pause lives in the timing data, not the glyph.
  const display = text.replace(/[.,;:!?'"()]+$/, '')
  if (!display) return null

  // The component reserves a band of height = fontSizePx * 1.6 centered at centerY.
  const bandH = Math.round(fontSizePx * 1.6)
  const top = Math.round(centerY - bandH / 2)

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top,
        height: bandH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: maxWidthPx,
          fontFamily: FONT_FAMILY,
          fontWeight: 400,
          fontSize: fontSizePx,
          color: WHITE,
          letterSpacing: 0.5,
          textAlign: 'center',
          textShadow: TEXT_SHADOW,
          lineHeight: 1.0,
          padding: '0 24px',
          whiteSpace: 'nowrap',
          overflow: 'visible',
        }}
      >
        {display}
      </div>
    </div>
  )
}

/**
 * Helper: load forced-alignment JSON and map to the component's CaptionWord shape.
 *
 * The .words.json file produced by elevenlabs /v1/forced-alignment uses
 * { text, start, end }. The component uses { text, startSec, endSec }.
 *
 * Use this when wiring up a comp:
 *
 *   import alignment from '../../public/audio/vo_market_report.words.json'
 *   const words = mapAlignmentToCaptionWords(alignment)
 */
export function mapAlignmentToCaptionWords(alignment: {
  words?: Array<{ text: string; start: number; end: number }>
}): CaptionWord[] {
  if (!alignment.words) return []
  return alignment.words
    .filter((w) => w.text && w.text.trim().length > 0)
    .map((w) => ({ text: w.text, startSec: w.start, endSec: w.end }))
}
