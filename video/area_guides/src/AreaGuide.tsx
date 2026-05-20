/**
 * AreaGuide — 30-35s B-roll neighborhood reel.
 *
 * 6-beat structure per video_production_skills/area_guides/SKILL.md:
 *   Beat 0  Hook (0-3s)   — place name over hero photo, Ken Burns 1.0→1.05x
 *   Beat 1  Title (3-6s)  — neighborhood + "Bend, Oregon" title card
 *   Beat 2  Amenity 1     — outdoor lifestyle shot with overlay text
 *   Beat 3  Amenity 2     — parks/trails shot with overlay text
 *   Beat 4  Amenity 3     — community/schools shot with overlay text
 *   Beat 5  Stat reveal   — kinetic market stat + ryan-realty.com CTA
 *
 * Captions: SingleWordCaption (Amboqia Boriango, portrait safe zone).
 * Photos: Pexels API at build-time (stock B-roll); placeholders here for render.
 * VO: synced via captionWords prop (ElevenLabs forced-alignment JSON at build time).
 * Safe zones from canonical safe-zones.ts — no hardcoded coords.
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
} from 'remotion'

import { SingleWordCaption, CaptionWord, SingleWordCaptionProps } from '../../../video_production_skills/captions/canonical/SingleWordCaption'
import {
  PORTRAIT_SAFE,
  CAPTION_PORTRAIT,
} from '../../../video_production_skills/safe-zones/canonical/safe-zones'
import { BEAT_DURATIONS_SEC, CREAM, FPS, HEIGHT, NAVY, WHITE, WIDTH } from './config'

/** Thin bridge to avoid React 18.3 + TS 5.7 strict FC return-type error. */
const CaptionBridge = (props: SingleWordCaptionProps): React.ReactElement | null =>
  SingleWordCaption(props) as React.ReactElement | null

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AreaGuideInput {
  /** Neighborhood name — shown in hook + title card. */
  neighborhood: string
  /** City + state — e.g. "Bend, Oregon" */
  city: string
  /** Short hook phrase — 4-8 words. Shown over hero photo in beat 0. */
  hookText: string
  /** Three amenity labels shown in beats 2-4. */
  amenityLabels: [string, string, string]
  /** Market stat shown in the kinetic reveal (beat 5). */
  statValue: string
  statLabel: string
  /** VO caption words from ElevenLabs forced-alignment. */
  captionWords: CaptionWord[]
  /**
   * Optional photo URLs for each beat (0-5). If omitted, the comp renders
   * colored placeholder panels — real Pexels URLs injected by build_area_guides.py.
   */
  photoUrls?: (string | null)[]
}

// ─── Beat helper ──────────────────────────────────────────────────────────────

function beatStartFrame(beatIndex: number): number {
  let start = 0
  for (let i = 0; i < beatIndex; i++) start += BEAT_DURATIONS_SEC[i] * FPS
  return Math.round(start)
}

function beatFrames(beatIndex: number): number {
  return Math.round(BEAT_DURATIONS_SEC[beatIndex] * FPS)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Full-bleed photo panel with Ken Burns zoom 1.0 → 1.05x over its duration. */
const PhotoBeat: React.FC<{
  url: string | null | undefined
  beatIndex: number
  fallbackColor: string
}> = ({ url, beatIndex, fallbackColor }) => {
  const frame = useCurrentFrame()
  const durationFrames = beatFrames(beatIndex)
  const scale = interpolate(frame, [0, durationFrames], [1.0, 1.05], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: fallbackColor,
      }}
    >
      {url ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            backgroundImage: `url(${url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      ) : (
        // Placeholder gradient when no Pexels URL — vivid so tsc can verify layout.
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(160deg, ${fallbackColor} 0%, ${NAVY} 100%)`,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      )}
    </AbsoluteFill>
  )
}

/** Semi-transparent dark scrim for text legibility. */
const TextScrim: React.FC<{
  top: number
  height: number
  opacity?: number
}> = ({ top, height, opacity = 0.55 }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top,
      width: WIDTH,
      height,
      background: `rgba(0,0,0,${opacity})`,
    }}
  />
)

/** Fade-up text entrance. */
const FadeUpText: React.FC<{
  text: string
  fontSize: number
  color: string
  fontFamily: string
  fontWeight?: string | number
  top: number
  delay?: number
  letterSpacing?: string
  textAlign?: React.CSSProperties['textAlign']
}> = ({ text, fontSize, color, fontFamily, fontWeight = '400', top, delay = 0, letterSpacing, textAlign = 'center' }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(frame, [delay, delay + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const translateY = interpolate(frame, [delay, delay + 8], [16, 0], {
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
        textAlign,
        opacity,
        transform: `translateY(${translateY}px)`,
        fontSize,
        fontFamily,
        fontWeight,
        color,
        letterSpacing: letterSpacing ?? 'normal',
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
      }}
    >
      {text}
    </div>
  )
}

// ─── Beat 0: Hook ─────────────────────────────────────────────────────────────

const HookBeat: React.FC<Pick<AreaGuideInput, 'hookText' | 'neighborhood' | 'photoUrls'>> = ({
  hookText,
  neighborhood,
  photoUrls,
}) => (
  <>
    <PhotoBeat url={photoUrls?.[0]} beatIndex={0} fallbackColor="#1a3a5c" />
    <TextScrim top={HEIGHT * 0.3} height={HEIGHT * 0.4} opacity={0.5} />
    <FadeUpText
      text={hookText}
      fontSize={72}
      color={WHITE}
      fontFamily='"Amboqia Boriango", Amboqia, serif'
      fontWeight="400"
      top={HEIGHT * 0.38}
      delay={4}
      textAlign="center"
    />
    <FadeUpText
      text={neighborhood.toUpperCase()}
      fontSize={36}
      color={CREAM}
      fontFamily='"Geist", sans-serif'
      fontWeight="500"
      top={HEIGHT * 0.52}
      delay={8}
      letterSpacing="0.12em"
      textAlign="center"
    />
  </>
)

// ─── Beat 1: Title card ────────────────────────────────────────────────────────

const TitleBeat: React.FC<Pick<AreaGuideInput, 'neighborhood' | 'city' | 'photoUrls'>> = ({
  neighborhood,
  city,
  photoUrls,
}) => (
  <>
    <PhotoBeat url={photoUrls?.[1]} beatIndex={1} fallbackColor="#102742" />
    {/* Navy overlay at upper two-thirds */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(16,39,66,0.65)',
      }}
    />
    <FadeUpText
      text={neighborhood}
      fontSize={96}
      color={WHITE}
      fontFamily='"Amboqia Boriango", Amboqia, serif'
      fontWeight="400"
      top={HEIGHT * 0.35}
      delay={0}
      textAlign="center"
    />
    <FadeUpText
      text={city.toUpperCase()}
      fontSize={40}
      color={CREAM}
      fontFamily='"Geist", sans-serif'
      fontWeight="500"
      top={HEIGHT * 0.52}
      delay={6}
      letterSpacing="0.12em"
      textAlign="center"
    />
  </>
)

// ─── Beats 2-4: Amenity beats ─────────────────────────────────────────────────

const AmenityBeat: React.FC<{
  label: string
  beatIndex: number
  photoUrl: string | null | undefined
  fallbackColors: string[]
}> = ({ label, beatIndex, photoUrl, fallbackColors }) => {
  const frame = useCurrentFrame()
  const durationFrames = beatFrames(beatIndex)

  // Text fades out near end of beat
  const textOpacity = interpolate(
    frame,
    [0, 6, durationFrames - 8, durationFrames - 2],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  )

  return (
    <>
      <PhotoBeat url={photoUrl} beatIndex={beatIndex} fallbackColor={fallbackColors[beatIndex - 2] ?? '#1a3a5c'} />
      {/* Bottom text zone */}
      <TextScrim top={HEIGHT * 0.72} height={HEIGHT * 0.18} opacity={0.6} />
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          width: PORTRAIT_SAFE.width,
          top: HEIGHT * 0.75,
          textAlign: 'center',
          opacity: textOpacity,
          fontSize: 58,
          fontFamily: '"Amboqia Boriango", Amboqia, serif',
          color: WHITE,
          textShadow: '0 2px 10px rgba(0,0,0,0.9)',
        }}
      >
        {label}
      </div>
    </>
  )
}

// ─── Beat 5: Kinetic stat reveal ──────────────────────────────────────────────

const StatRevealBeat: React.FC<{
  statValue: string
  statLabel: string
  neighborhood: string
  photoUrl: string | null | undefined
}> = ({ statValue, statLabel, neighborhood, photoUrl }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Scale spring entrance for the big number
  const scale = spring({ frame, fps, config: { damping: 14, mass: 0.6, stiffness: 120 } })
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
  const labelOpacity = interpolate(frame, [10, 18], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <>
      <PhotoBeat url={photoUrl} beatIndex={5} fallbackColor="#0a1a2e" />
      {/* Dark overlay for stat readability */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,39,66,0.75)' }} />

      {/* Stat number — kinetic spring entrance */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          width: PORTRAIT_SAFE.width,
          top: HEIGHT * 0.32,
          textAlign: 'center',
          opacity,
          transform: `scale(${scale})`,
          fontSize: 120,
          fontFamily: '"Amboqia Boriango", Amboqia, serif',
          color: WHITE,
          lineHeight: 1.0,
        }}
      >
        {statValue}
      </div>

      {/* Stat label */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          width: PORTRAIT_SAFE.width,
          top: HEIGHT * 0.50,
          textAlign: 'center',
          opacity: labelOpacity,
          fontSize: 44,
          fontFamily: '"Geist", sans-serif',
          fontWeight: 500,
          color: CREAM,
          letterSpacing: '0.04em',
        }}
      >
        {statLabel}
      </div>

      {/* Neighborhood label */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          width: PORTRAIT_SAFE.width,
          top: HEIGHT * 0.58,
          textAlign: 'center',
          opacity: labelOpacity,
          fontSize: 32,
          fontFamily: '"Geist", sans-serif',
          fontWeight: 400,
          color: CREAM,
          letterSpacing: '0.10em',
        }}
      >
        {neighborhood.toUpperCase()}
      </div>

      {/* ryan-realty.com CTA — inside PORTRAIT_SAFE, above caption zone */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          width: PORTRAIT_SAFE.width,
          top: 1180,   // well above CAPTION_PORTRAIT.top (1280)
          textAlign: 'center',
          opacity: labelOpacity,
          fontSize: 30,
          fontFamily: '"Geist", sans-serif',
          fontWeight: 400,
          color: CREAM,
          letterSpacing: '0.06em',
        }}
      >
        ryan-realty.com
      </div>
    </>
  )
}

// ─── Main composition ─────────────────────────────────────────────────────────

export const AreaGuide: React.FC<AreaGuideInput> = ({
  neighborhood,
  city,
  hookText,
  amenityLabels,
  statValue,
  statLabel,
  captionWords,
  photoUrls,
}) => {
  const fallbackColors = ['#234a6e', '#1c3d5a', '#163047']

  return (
    <AbsoluteFill style={{ background: NAVY }}>

      {/* Beat 0: Hook */}
      <Sequence from={beatStartFrame(0)} durationInFrames={beatFrames(0)}>
        <HookBeat hookText={hookText} neighborhood={neighborhood} photoUrls={photoUrls} />
      </Sequence>

      {/* Beat 1: Title card */}
      <Sequence from={beatStartFrame(1)} durationInFrames={beatFrames(1)}>
        <TitleBeat neighborhood={neighborhood} city={city} photoUrls={photoUrls} />
      </Sequence>

      {/* Beat 2: Amenity 1 */}
      <Sequence from={beatStartFrame(2)} durationInFrames={beatFrames(2)}>
        <AmenityBeat
          label={amenityLabels[0]}
          beatIndex={2}
          photoUrl={photoUrls?.[2]}
          fallbackColors={fallbackColors}
        />
      </Sequence>

      {/* Beat 3: Amenity 2 (pattern interrupt — tighter framing) */}
      <Sequence from={beatStartFrame(3)} durationInFrames={beatFrames(3)}>
        <AmenityBeat
          label={amenityLabels[1]}
          beatIndex={3}
          photoUrl={photoUrls?.[3]}
          fallbackColors={fallbackColors}
        />
      </Sequence>

      {/* Beat 4: Amenity 3 */}
      <Sequence from={beatStartFrame(4)} durationInFrames={beatFrames(4)}>
        <AmenityBeat
          label={amenityLabels[2]}
          beatIndex={4}
          photoUrl={photoUrls?.[4]}
          fallbackColors={fallbackColors}
        />
      </Sequence>

      {/* Beat 5: Kinetic stat reveal */}
      <Sequence from={beatStartFrame(5)} durationInFrames={beatFrames(5)}>
        <StatRevealBeat
          statValue={statValue}
          statLabel={statLabel}
          neighborhood={neighborhood}
          photoUrl={photoUrls?.[5]}
        />
      </Sequence>

      {/* Captions — single-word Amboqia, suppressed during hook title (first 3s) */}
      <CaptionBridge
        words={captionWords}
        suppressBeforeSec={3.0}
        centerY={CAPTION_PORTRAIT.centerY}
        fontSizePx={CAPTION_PORTRAIT.fontSizePx}
        maxWidthPx={CAPTION_PORTRAIT.maxWidthPx}
      />

    </AbsoluteFill>
  )
}
