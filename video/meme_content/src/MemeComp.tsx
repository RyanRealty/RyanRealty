/**
 * MemeComp — Ryan Realty trend-jacking meme clip.
 *
 * Spec: video_production_skills/meme_content/SKILL.md
 * Format: 15-25s portrait (1080×1920), no logo in frame, no agent face.
 * Source: Vlipsy clip (pre-downloaded MP4 by build script) + on-screen text.
 *
 * Layout:
 *   - Full-bleed reaction clip video (from vlipsy — downloaded at build time)
 *   - Upper-third text zone: the real-estate friction "context" line
 *   - Lower text zone: the punchline / resolution line
 *   - SingleWordCaption at canonical portrait caption band (if VO present)
 *
 * If the meme library (data/meme-library.jsonl) is empty the build script
 * surfaces a clear error. This comp renders a "library not populated" card
 * when no clipUrl is provided so the tsc type-check and studio preview work
 * without a real clip.
 *
 * Banned-words check: build script runs `_producer_lib.has_hard_fail()` on
 * contextLine + punchlineLine before calling Remotion render.
 *
 * Anti-slop rule: no AI-generated humor — text written by Matt or approved
 * by Matt before render. All text passes has_hard_fail() gate first.
 */

import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Video,
  staticFile,
} from 'remotion'

import { SingleWordCaption, CaptionWord, SingleWordCaptionProps } from '../../../video_production_skills/captions/canonical/SingleWordCaption'
import {
  PORTRAIT_SAFE,
  CAPTION_PORTRAIT,
} from '../../../video_production_skills/safe-zones/canonical/safe-zones'

/** Bridge to avoid React 18.3 + TS 5.7 strict FC return-type error on canonical comp. */
const CaptionBridge = (props: SingleWordCaptionProps): React.ReactElement | null =>
  SingleWordCaption(props) as React.ReactElement | null

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemeInput {
  /**
   * Path to the pre-downloaded Vlipsy clip MP4, relative to the project public/
   * directory. e.g. "clips/reaction-clip.mp4". Injected by build script.
   * If null: renders a "library not populated" placeholder card.
   */
  clipUrl: string | null
  /**
   * Total duration in frames. Must match the clip duration.
   * Default: 18s * 30fps = 540 frames (mid-range for 15-25s window).
   */
  durationFrames: number
  /** Upper-third text: the real-estate friction context. Max 8 words. */
  contextLine: string
  /** Lower text: the punchline / resolution. Max 8 words. */
  punchlineLine: string
  /**
   * Frame at which to show the punchline (the pattern interrupt moment).
   * Default: 40% of durationFrames.
   */
  punchlineStartFrame?: number
  /** VO caption words from forced-alignment (optional for meme format). */
  captionWords?: CaptionWord[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FPS = 30
const WIDTH = 1080
const HEIGHT = 1920
const NAVY = '#102742'
const CREAM = '#faf8f4'
const WHITE = '#FFFFFF'

// ─── Text overlay ─────────────────────────────────────────────────────────────

const TextBand: React.FC<{
  text: string
  top: number
  delayFrames: number
  fontSize?: number
}> = ({ text, top, delayFrames, fontSize = 60 }) => {
  const frame = useCurrentFrame()

  const opacity = interpolate(frame, [delayFrames, delayFrames + 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const translateY = interpolate(frame, [delayFrames, delayFrames + 6], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        position: 'absolute',
        left: PORTRAIT_SAFE.x,
        width: PORTRAIT_SAFE.width,
        top,
        textAlign: 'center',
        opacity,
        transform: `translateY(${translateY}px)`,
        fontSize,
        fontFamily: '"Amboqia Boriango", Amboqia, serif',
        color: WHITE,
        textShadow: [
          '0 0 24px rgba(0,0,0,0.90)',
          '0 4px 12px rgba(0,0,0,0.95)',
          '0 2px 4px rgba(0,0,0,1.0)',
        ].join(', '),
        lineHeight: 1.15,
        // maxWidth to stay inside safe zone — already constrained by left+width
      }}
    >
      {text}
    </div>
  )
}

// ─── Library-empty placeholder ────────────────────────────────────────────────

const LibraryEmptyCard: React.FC = () => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        background: NAVY,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 64,
          fontFamily: '"Amboqia Boriango", Amboqia, serif',
          color: WHITE,
          textAlign: 'center',
          lineHeight: 1.2,
          padding: '0 60px',
        }}
      >
        Meme library not yet populated
      </div>
      <div
        style={{
          fontSize: 36,
          fontFamily: '"Geist", sans-serif',
          fontWeight: 400,
          color: CREAM,
          textAlign: 'center',
          marginTop: 40,
          padding: '0 80px',
          lineHeight: 1.5,
        }}
      >
        Run scripts/scrape-meme-library.mjs to populate data/meme-library.jsonl,
        then re-run build_meme_content.py with a PASS-flagged entry.
      </div>
    </AbsoluteFill>
  )
}

// ─── Main composition ─────────────────────────────────────────────────────────

export const MemeComp: React.FC<MemeInput> = ({
  clipUrl,
  durationFrames,
  contextLine,
  punchlineLine,
  punchlineStartFrame,
  captionWords = [],
}) => {
  const punchStart = punchlineStartFrame ?? Math.round(durationFrames * 0.40)

  if (!clipUrl) {
    return <LibraryEmptyCard />
  }

  return (
    <AbsoluteFill style={{ background: '#000' }}>

      {/* Full-bleed reaction clip */}
      <Video
        src={staticFile(clipUrl)}
        style={{
          position: 'absolute',
          inset: 0,
          width: WIDTH,
          height: HEIGHT,
          objectFit: 'cover',
        }}
      />

      {/* Upper context line — visible from frame 0 */}
      {/* Scrim only behind text band — top 15% of frame */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: WIDTH,
          // Height covers context line area inside PORTRAIT_SAFE top padding
          height: 360,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
        }}
      />
      <TextBand
        text={contextLine}
        top={PORTRAIT_SAFE.y + 20}       // just inside top safe zone (y=280 + 20)
        delayFrames={4}
        fontSize={58}
      />

      {/* Punchline — appears at pattern-interrupt beat */}
      {/* Scrim only behind punchline — bottom area above caption zone */}
      <Sequence from={punchStart}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: HEIGHT - 1120,     // sits above caption zone (top 1120 = above caption y 1280)
            width: WIDTH,
            height: 260,
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
          }}
        />
        <TextBand
          text={punchlineLine}
          top={960}                     // vertical center of frame — good contrast point
          delayFrames={0}
          fontSize={66}
        />
      </Sequence>

      {/* Captions (optional — meme format often has no VO) */}
      {captionWords.length > 0 && (
        <CaptionBridge
          words={captionWords}
          suppressBeforeSec={0}
          centerY={CAPTION_PORTRAIT.centerY}
          fontSizePx={CAPTION_PORTRAIT.fontSizePx}
          maxWidthPx={CAPTION_PORTRAIT.maxWidthPx}
        />
      )}

    </AbsoluteFill>
  )
}
