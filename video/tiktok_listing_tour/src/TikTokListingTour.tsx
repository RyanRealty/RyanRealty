/**
 * TikTokListingTour — 25-40s TikTok-native listing tour.
 *
 * Spec: video_production_skills/tiktok-listing-tour/SKILL.md
 *
 * Key differentiator vs IG listing_reveal: the long-tail geo keyword phrase
 * is the FIRST spoken VO line and the FIRST on-screen text, so TikTok's
 * speech-to-text + OCR indexing picks it up. e.g.
 *   "What $895,000 gets you on 2 acres in Tumalo, Oregon."
 *
 * Format: headless (no logo, no agent face, no brokerage name in frame).
 * Price reveal in the first 2 seconds — hard TikTok hook requirement.
 * Cuts every 2-3s (faster than IG Reels pace).
 * SingleWordCaption synced to VO forced-alignment.
 * Pattern interrupt at 50% mark: exterior → interior cut.
 *
 * Beat structure (7 beats for a ~35s comp):
 *   0  Price hook           (3s)   "What $X gets you in [City]" + hero exterior
 *   1  Key room 1           (4s)   interior shot + caption overlay
 *   2  Key room 2           (4s)   pattern interrupt (tight close-up)
 *   3  Pattern interrupt    (3s)   wide exterior detail / lot / view (50% mark)
 *   4  Feature highlight    (4s)   unique selling feature
 *   5  Lifestyle shot       (4s)   outdoor / lifestyle beat
 *   6  Price CTA reveal     (5s)   "Listed at $X · [City], Oregon" kinetic end
 *
 * Photos injected by build_tiktok_listing_tour.py from Supabase listing photos.
 */

import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Audio,
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

export interface PhotoBeat {
  /** Duration in seconds. */
  durationSec: number
  /**
   * Photo URL. For Remotion: use staticFile('photos/beat-N.jpg') convention.
   * The build script copies listing photos into public/photos/ and passes the
   * staticFile-relative path here (e.g. "photos/beat-0.jpg").
   */
  photoPath: string | null
  /** Brief caption overlay (3-6 words). Displayed mid-beat as a text chip. */
  captionOverlay?: string
  /**
   * Ken Burns motion — which direction to drift.
   * push_in: zoom 1.0→1.06 (default)
   * push_out: zoom 1.06→1.0
   * pan_left: translate x 0→-3%
   * pan_right: translate x -3%→0
   */
  motion?: 'push_in' | 'push_out' | 'pan_left' | 'pan_right'
}

export interface TikTokListingTourInput {
  /** The keyword phrase for the VO opening line. Max 12 words. e.g. "What $895,000 gets you on 2 acres in Tumalo, Oregon." */
  keywordPhrase: string
  /** Display price e.g. "$895,000" */
  displayPrice: string
  /** City + state e.g. "Tumalo, Oregon" */
  cityState: string
  /** Beats — 6-8 entries. First beat is the hero hook. */
  beats: PhotoBeat[]
  /** VO path relative to project root (passed to Audio component). */
  voPath?: string
  /** Forced-alignment caption words. */
  captionWords: CaptionWord[]
  /** Ambient music track (optional). Relative to public/. */
  musicPath?: string
  /** Music volume (0-1). Default 0.25. */
  musicVolume?: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FPS = 30
const WIDTH = 1080
const HEIGHT = 1920
const NAVY = '#102742'
const CREAM = '#faf8f4'
const WHITE = '#FFFFFF'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function beatStartFrame(beats: PhotoBeat[], index: number): number {
  let start = 0
  for (let i = 0; i < index; i++) {
    start += Math.round(beats[i].durationSec * FPS)
  }
  return start
}

function beatFrames(beat: PhotoBeat): number {
  return Math.round(beat.durationSec * FPS)
}

export function computeTotalFrames(beats: PhotoBeat[]): number {
  return beats.reduce((sum, b) => sum + Math.round(b.durationSec * FPS), 0)
}

// ─── Photo panel with Ken Burns ───────────────────────────────────────────────

const PhotoPanel: React.FC<{
  photoPath: string | null
  durationFrames: number
  motion: PhotoBeat['motion']
  beatIndex: number
}> = ({ photoPath, durationFrames, motion = 'push_in', beatIndex }) => {
  const frame = useCurrentFrame()

  let transform = ''
  if (motion === 'push_in') {
    const scale = interpolate(frame, [0, durationFrames], [1.0, 1.06], { extrapolateRight: 'clamp' })
    transform = `scale(${scale})`
  } else if (motion === 'push_out') {
    const scale = interpolate(frame, [0, durationFrames], [1.06, 1.0], { extrapolateRight: 'clamp' })
    transform = `scale(${scale})`
  } else if (motion === 'pan_left') {
    const tx = interpolate(frame, [0, durationFrames], [0, -3], { extrapolateRight: 'clamp' })
    transform = `translateX(${tx}%)`
  } else if (motion === 'pan_right') {
    const tx = interpolate(frame, [0, durationFrames], [-3, 0], { extrapolateRight: 'clamp' })
    transform = `translateX(${tx}%)`
  }

  const fallbackColors = ['#1a3a5c', '#162e49', '#112537', '#0d1e2e', '#0a1825', '#0d1e2e', '#112537']

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: fallbackColors[beatIndex % fallbackColors.length] }}>
      {photoPath ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${staticFile(photoPath)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform,
            transformOrigin: 'center center',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(160deg, ${fallbackColors[beatIndex % fallbackColors.length]} 0%, ${NAVY} 100%)`,
            transform,
            transformOrigin: 'center center',
          }}
        />
      )}
    </AbsoluteFill>
  )
}

// ─── Price hook beat (beat 0) ─────────────────────────────────────────────────

const PriceHookBeat: React.FC<{
  keywordPhrase: string
  displayPrice: string
  cityState: string
  beat: PhotoBeat
}> = ({ keywordPhrase, displayPrice, cityState, beat }) => {
  const frame = useCurrentFrame()
  const durationFrames = beatFrames(beat)
  const { fps } = useVideoConfig()

  // Price pops in with spring in first 0.5s
  const priceScale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 140 },
    durationInFrames: 18,
  })
  const priceOpacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' })
  const taglineOpacity = interpolate(frame, [10, 18], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <>
      <PhotoPanel
        photoPath={beat.photoPath}
        durationFrames={durationFrames}
        motion={beat.motion ?? 'push_in'}
        beatIndex={0}
      />
      {/* Full scrim for price clarity */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />

      {/* Big price — above the fold, inside safe zone */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          width: PORTRAIT_SAFE.width,
          top: 480,
          textAlign: 'center',
          opacity: priceOpacity,
          transform: `scale(${priceScale})`,
          fontSize: 108,
          fontFamily: '"Amboqia Boriango", Amboqia, serif',
          color: WHITE,
          lineHeight: 1.0,
          textShadow: '0 4px 16px rgba(0,0,0,0.9)',
        }}
      >
        {displayPrice}
      </div>

      {/* Keyword phrase — the SEO anchor line */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          width: PORTRAIT_SAFE.width,
          top: 640,
          textAlign: 'center',
          opacity: taglineOpacity,
          fontSize: 42,
          fontFamily: '"Geist", sans-serif',
          fontWeight: 500,
          color: CREAM,
          letterSpacing: '0.01em',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          padding: '0 20px',
        }}
      >
        {cityState}
      </div>
    </>
  )
}

// ─── Standard interior/exterior beat ─────────────────────────────────────────

const StandardBeat: React.FC<{
  beat: PhotoBeat
  beatIndex: number
}> = ({ beat, beatIndex }) => {
  const frame = useCurrentFrame()
  const durationFrames = beatFrames(beat)

  const overlayOpacity = interpolate(
    frame,
    [4, 10, durationFrames - 6, durationFrames - 2],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  return (
    <>
      <PhotoPanel
        photoPath={beat.photoPath}
        durationFrames={durationFrames}
        motion={beat.motion ?? (beatIndex % 2 === 0 ? 'push_in' : 'push_out')}
        beatIndex={beatIndex}
      />
      {beat.captionOverlay && (
        <>
          {/* Bottom text scrim */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: HEIGHT - 1180,   // above caption zone
              width: WIDTH,
              height: 180,
              background: 'linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0) 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: PORTRAIT_SAFE.x,
              width: PORTRAIT_SAFE.width,
              top: 1040,
              textAlign: 'center',
              opacity: overlayOpacity,
              fontSize: 56,
              fontFamily: '"Amboqia Boriango", Amboqia, serif',
              color: WHITE,
              textShadow: '0 2px 10px rgba(0,0,0,0.9)',
            }}
          >
            {beat.captionOverlay}
          </div>
        </>
      )}
    </>
  )
}

// ─── Final price CTA beat ─────────────────────────────────────────────────────

const PriceCtaBeat: React.FC<{
  displayPrice: string
  cityState: string
  beat: PhotoBeat
}> = ({ displayPrice, cityState, beat }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const durationFrames = beatFrames(beat)

  const scale = spring({ frame, fps, config: { damping: 14, mass: 0.6, stiffness: 120 } })
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <>
      <PhotoPanel
        photoPath={beat.photoPath}
        durationFrames={durationFrames}
        motion={beat.motion ?? 'push_in'}
        beatIndex={6}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,39,66,0.72)' }} />

      {/* Listed at price */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          width: PORTRAIT_SAFE.width,
          top: 380,
          textAlign: 'center',
          opacity,
          fontSize: 34,
          fontFamily: '"Geist", sans-serif',
          fontWeight: 500,
          color: CREAM,
          letterSpacing: '0.10em',
          textShadow: '0 2px 8px rgba(0,0,0,0.7)',
        }}
      >
        LISTED AT
      </div>
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          width: PORTRAIT_SAFE.width,
          top: 440,
          textAlign: 'center',
          opacity,
          transform: `scale(${scale})`,
          fontSize: 110,
          fontFamily: '"Amboqia Boriango", Amboqia, serif',
          color: WHITE,
          lineHeight: 1.0,
        }}
      >
        {displayPrice}
      </div>
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          width: PORTRAIT_SAFE.width,
          top: 590,
          textAlign: 'center',
          opacity,
          fontSize: 40,
          fontFamily: '"Geist", sans-serif',
          fontWeight: 400,
          color: CREAM,
          letterSpacing: '0.06em',
        }}
      >
        {cityState}
      </div>
    </>
  )
}

// ─── Main composition ─────────────────────────────────────────────────────────

export const TikTokListingTour: React.FC<TikTokListingTourInput> = ({
  keywordPhrase,
  displayPrice,
  cityState,
  beats,
  voPath,
  captionWords,
  musicPath,
  musicVolume = 0.25,
}) => {
  const totalFrames = computeTotalFrames(beats)
  const lastBeatIndex = beats.length - 1

  return (
    <AbsoluteFill style={{ background: NAVY }}>

      {/* Ambient music (optional, beat-looped by build script) */}
      {musicPath && (
        <Audio
          src={staticFile(musicPath)}
          volume={musicVolume}
          loop
        />
      )}

      {/* VO audio (injected by build script) */}
      {voPath && (
        <Audio src={staticFile(voPath)} volume={1.0} />
      )}

      {/* Beat 0: Price hook */}
      <Sequence from={0} durationInFrames={beatFrames(beats[0])}>
        <PriceHookBeat
          keywordPhrase={keywordPhrase}
          displayPrice={displayPrice}
          cityState={cityState}
          beat={beats[0]}
        />
      </Sequence>

      {/* Beats 1 through N-2: interior/exterior shots */}
      {beats.slice(1, lastBeatIndex).map((beat, i) => {
        const beatIndex = i + 1
        return (
          <Sequence
            key={beatIndex}
            from={beatStartFrame(beats, beatIndex)}
            durationInFrames={beatFrames(beat)}
          >
            <StandardBeat beat={beat} beatIndex={beatIndex} />
          </Sequence>
        )
      })}

      {/* Final beat: price CTA reveal */}
      <Sequence
        from={beatStartFrame(beats, lastBeatIndex)}
        durationInFrames={beatFrames(beats[lastBeatIndex])}
      >
        <PriceCtaBeat
          displayPrice={displayPrice}
          cityState={cityState}
          beat={beats[lastBeatIndex]}
        />
      </Sequence>

      {/* Single-word Amboqia captions — suppressed during price hook (first beat) */}
      <CaptionBridge
        words={captionWords}
        suppressBeforeSec={beats[0].durationSec}
        centerY={CAPTION_PORTRAIT.centerY}
        fontSizePx={CAPTION_PORTRAIT.fontSizePx}
        maxWidthPx={CAPTION_PORTRAIT.maxWidthPx}
      />

    </AbsoluteFill>
  )
}
