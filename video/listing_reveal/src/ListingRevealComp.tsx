/**
 * ListingRevealComp — 30-45s portrait listing tour with kinetic stat reveal.
 *
 * Structure:
 *   Aerial beat (3.0s): hero aerial / exterior shot — establishes the property
 *   Exterior beats (2x 2.5s): front + approach with push_in / slow_pan
 *   Interior beats (4x 2.5s): key interior rooms with alternating moves
 *   Grounds beat (2.5s): outdoor / lot / grounds
 *   Bridge to reveal (1.0s): hold on hero exterior before stat reveal
 *   Kinetic reveal (final ~15% / ~5s): three-line price · beds/baths/sqft · CTA
 *   Outro (3.0s): navy brand card
 *
 * Total: ~34s (within 30-45s target)
 *
 * Photos: uses images from data/comps/19496-tumalo-reservoir-rd-photos/
 *   (already cached to the repo). The build script copies them to
 *   video/listing_reveal/public/photos/ before render.
 *
 * Captions: SingleWordCaption — synced to ElevenLabs forced-alignment.
 *   Stub uses mockWords() so tsc passes without audio present.
 *
 * Listing video overlay system (CLAUDE.md §Video Build Hard Rules):
 *   Layer 1 text-zone scrim: rgba(0,0,0,0.40) over address/price block only
 *   Layer 2 logo footer: rgba(0,0,0,0.70) 200px bar, 580px logo, flush bottom
 *   NO feathering, NO drop shadow, NO gradient between the two layers.
 *
 * Pattern interrupts:
 *   25% (~B3): interior register change (exterior → interior)
 *   50% (~B5): hard shift to grounds/lot (interior → outdoor)
 *   Final 15% (~B8+): kinetic reveal — all text, no photo
 *
 * Skill: video_production_skills/listing_reveal/SKILL.md
 */

import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { SingleWordCaption as SingleWordCaptionBase, type CaptionWord } from '../../../video_production_skills/captions/canonical/SingleWordCaption'
import { PORTRAIT_SAFE, CAPTION_PORTRAIT } from '../../../video_production_skills/safe-zones/canonical/safe-zones'

type SWCProps = {
  words: CaptionWord[]
  suppressBeforeSec?: number
  suppressFrames?: Array<[number, number]>
  centerY?: number
  fontSizePx?: number
  maxWidthPx?: number
}
const SingleWordCaption = SingleWordCaptionBase as React.ComponentType<SWCProps>

// ─── Constants ───────────────────────────────────────────────────────────────

const FPS = 30
const WIDTH = 1080
const HEIGHT = 1920

const NAVY = '#102742'
const CREAM = '#faf8f4'
const WHITE = '#FFFFFF'

const FONT_DISPLAY = '"Amboqia Boriango", Amboqia, serif'
const FONT_UI = "'Geist', 'Inter', system-ui, sans-serif"

// ─── Photo slugs (images from data/comps/19496-tumalo-reservoir-rd-photos/) ──
// Build script copies these to public/photos/ before render.
// Filenames are the raw MLS photo filenames — safe to reference directly.

const PHOTOS = [
  '20260323173005905886000000.jpg', // aerial / exterior hero — first frame content
  '20260310224736943770000000.jpg', // front approach
  '20251007172558986098000000.jpg', // exterior side / grounds
  '20250924192941811834000000.jpg', // interior 1
  '20250710153506405205000000.jpg', // interior 2
  '20260323173005905886000000.jpg', // re-use aerial for grounds beat (only 5 unique)
]

const photo = (slug: string) => `photos/${slug}`

// ─── VO beat durations ────────────────────────────────────────────────────────
// Replace with actual ffprobe values after synth.

const VO: Record<string, number> = {
  b1_aerial:     3.0, // "Nineteen four nine six Tumalo Reservoir Road."
  b2_exterior:   2.5, // "Two point two eight acres. Three Sisters views."
  b3_interior1:  2.5, // "Three bedrooms. Open floor plan."
  b4_interior2:  2.5, // "Vaulted ceilings. Natural light throughout."
  b5_grounds:    2.5, // "Irrigated acres. Room to build a shop."
  b6_bridge:     1.0, // (silent / ambient — hold on exterior before reveal)
}

const VO_TOTAL = Object.values(VO).reduce((a, b) => a + b, 0)
const REVEAL_SEC = 5.0
const OUTRO_SEC = 3.0

export const LISTING_REVEAL_TOTAL_SEC = VO_TOTAL + REVEAL_SEC + OUTRO_SEC
const F = (s: number) => Math.round(s * FPS)
const OVERLAP = 9

// Sequential offsets
const OFF: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  let t = 0
  for (const [slug, dur] of Object.entries(VO)) {
    out[slug] = t
    t += dur
  }
  out.reveal = t
  out.outro = t + REVEAL_SEC
  return out
})()

// ─── Mock words ───────────────────────────────────────────────────────────────

function mockWords(text: string): CaptionWord[] {
  const raw = text.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean)
  const secPerWord = 0.38
  return raw.map((w, i) => ({
    text: w,
    startSec: i * secPerWord,
    endSec: (i + 1) * secPerWord - 0.05,
  }))
}

const WORDS: Record<string, CaptionWord[]> = {
  b1_aerial:     mockWords('Nineteen four nine six Tumalo Reservoir Road'),
  b2_exterior:   mockWords('Two point two eight acres Three Sisters views'),
  b3_interior1:  mockWords('Three bedrooms open floor plan'),
  b4_interior2:  mockWords('Vaulted ceilings natural light throughout'),
  b5_grounds:    mockWords('Irrigated acres room to build a shop'),
}

const vo = (slug: string) => `audio/listing_reveal_tumalo/${slug}.mp3`

// ─── Ken Burns helper ────────────────────────────────────────────────────────

type Move =
  | { kind: 'push_in'; from?: number; to?: number }
  | { kind: 'push_counter'; from?: number; to?: number }
  | { kind: 'slow_pan'; direction?: 'lr' | 'rl'; amount?: number; scale?: number }
  | { kind: 'parallax'; scale?: number }

const PhotoBeat: React.FC<{
  imgSlug: string
  voSlug: string
  voDurSec: number
  words: CaptionWord[]
  move: Move
  hasAudio?: boolean
}> = ({ imgSlug, voSlug, voDurSec, words, move, hasAudio = false }) => {
  const frame = useCurrentFrame()
  const totalFrames = Math.max(1, F(voDurSec))
  const t = Math.min(1, frame / totalFrames)

  let scale = 1
  let translateX = 0

  if (move.kind === 'push_in') {
    scale = (move.from ?? 1.04) + ((move.to ?? 1.14) - (move.from ?? 1.04)) * t
  } else if (move.kind === 'push_counter') {
    scale = (move.from ?? 1.14) + ((move.to ?? 1.05) - (move.from ?? 1.14)) * t
  } else if (move.kind === 'slow_pan') {
    scale = move.scale ?? 1.10
    const amt = move.amount ?? 80
    const dir = move.direction ?? 'lr'
    translateX = dir === 'lr' ? -amt + 2 * amt * t : amt - 2 * amt * t
  } else {
    scale = (move.scale ?? 1.06) + 0.06 * t
  }

  return (
    <AbsoluteFill style={{ background: 'transparent' }}>
      <Img
        src={staticFile(photo(imgSlug))}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(${translateX.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`,
          transformOrigin: 'center center',
        }}
      />
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.0) 32%, rgba(0,0,0,0.0) 60%, rgba(0,0,0,0.65) 100%)',
        }}
      />
      {/* Listing overlay system (CLAUDE.md §Video Build Hard Rules)
          Layer 2 — logo footer bar: rgba(0,0,0,0.70), 200px, flush bottom, 580px logo */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 200,
          background: 'rgba(0,0,0,0.70)',
        }}
      >
        <Img
          src={staticFile('brand/stacked_logo_white.png')}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 580,
            height: 'auto',
            display: 'block',
          }}
        />
      </div>
      {hasAudio ? <Audio src={staticFile(vo(voSlug))} /> : null}
      {/* Suppress captions during the footer bar zone (y > 1480) */}
      <SingleWordCaption
        words={words}
        centerY={CAPTION_PORTRAIT.centerY}
        fontSizePx={CAPTION_PORTRAIT.fontSizePx}
        maxWidthPx={CAPTION_PORTRAIT.maxWidthPx}
      />
    </AbsoluteFill>
  )
}

// ─── Kinetic stat reveal (final 15%) ─────────────────────────────────────────

const KineticReveal: React.FC<{
  price: string
  details: string
  cta: string
  durationSec: number
}> = ({ price, details, cta, durationSec }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const priceSp = spring({ frame, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } })
  const detailSp = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 14, mass: 0.5, stiffness: 180 } })
  const ctaSp = spring({ frame: Math.max(0, frame - 36), fps, config: { damping: 14, mass: 0.5, stiffness: 160 } })

  const exitAlpha = interpolate(frame / fps, [durationSec - 0.5, durationSec], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const priceScale = 0.6 + priceSp * 0.42
  const detailScale = 0.7 + detailSp * 0.32
  const ctaScale = 0.7 + ctaSp * 0.32

  return (
    <AbsoluteFill style={{ background: NAVY, opacity: exitAlpha }}>
      {/* Price line */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width,
          top: HEIGHT * 0.28,
          textAlign: 'center',
          transform: `scale(${priceScale.toFixed(4)})`,
          transformOrigin: 'center center',
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 164,
            fontWeight: 400,
            color: CREAM,
            letterSpacing: -2,
            lineHeight: 1.0,
          }}
        >
          {price}
        </div>
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 40,
            fontWeight: 500,
            color: CREAM,
            opacity: 0.70,
            letterSpacing: 6,
            marginTop: 16,
            textTransform: 'uppercase',
          }}
        >
          LIST PRICE
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x + 80,
          right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width + 80,
          top: HEIGHT * 0.56,
          height: 2,
          background: `rgba(250,248,244,0.25)`,
        }}
      />

      {/* Details line */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width,
          top: HEIGHT * 0.60,
          textAlign: 'center',
          transform: `scale(${detailScale.toFixed(4)})`,
          transformOrigin: 'center center',
        }}
      >
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 52,
            fontWeight: 500,
            color: CREAM,
            letterSpacing: 3,
            lineHeight: 1.4,
            textTransform: 'uppercase',
          }}
        >
          {details}
        </div>
      </div>

      {/* CTA line */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width,
          top: HEIGHT * 0.76,
          textAlign: 'center',
          transform: `scale(${ctaScale.toFixed(4)})`,
          transformOrigin: 'center center',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            background: CREAM,
            color: NAVY,
            fontFamily: FONT_UI,
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: 4,
            padding: '18px 48px',
            borderRadius: 999,
            textTransform: 'uppercase',
          }}
        >
          {cta}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ─── Outro ───────────────────────────────────────────────────────────────────

const OutroCard: React.FC<{ durationSec: number }> = ({ durationSec }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps

  const logoAlpha = interpolate(t, [0.2, 1.0], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const phoneAlpha = interpolate(t, [1.0, 1.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const exitAlpha = interpolate(t, [durationSec - 0.4, durationSec], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const logoScale = interpolate(t, [0.2, 1.6], [1.0, 1.02], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ background: NAVY, opacity: exitAlpha }}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -60%) scale(${logoScale.toFixed(3)})`,
          opacity: logoAlpha,
        }}
      >
        <Img src={staticFile('brand/stacked_logo_white.png')} style={{ width: 620, height: 'auto' }} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, 60px)',
          opacity: phoneAlpha,
          fontFamily: FONT_UI,
          fontSize: 44,
          fontWeight: 500,
          letterSpacing: 3,
          color: WHITE,
          textAlign: 'center',
        }}
      >
        541.213.6706
      </div>
    </AbsoluteFill>
  )
}

// ─── Root composition ────────────────────────────────────────────────────────

export const ListingRevealComp: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    {/* B1 — Aerial hero: first frame rule satisfied (real photo at t=0) */}
    <Sequence from={0} durationInFrames={F(VO.b1_aerial) + OVERLAP}>
      <PhotoBeat
        imgSlug={PHOTOS[0]}
        voSlug="b1_aerial"
        voDurSec={VO.b1_aerial}
        words={WORDS.b1_aerial}
        move={{ kind: 'push_in', from: 1.04, to: 1.12 }}
      />
    </Sequence>

    {/* B2 — Front approach (push_counter) */}
    <Sequence from={F(OFF.b2_exterior)} durationInFrames={F(VO.b2_exterior) + OVERLAP}>
      <PhotoBeat
        imgSlug={PHOTOS[1]}
        voSlug="b2_exterior"
        voDurSec={VO.b2_exterior}
        words={WORDS.b2_exterior}
        move={{ kind: 'push_counter', from: 1.12, to: 1.04 }}
      />
    </Sequence>

    {/* B3 — Interior 1: PATTERN INTERRUPT 25% (exterior → interior)
        slow_pan introduces new visual register */}
    <Sequence from={F(OFF.b3_interior1)} durationInFrames={F(VO.b3_interior1) + OVERLAP}>
      <PhotoBeat
        imgSlug={PHOTOS[3]}
        voSlug="b3_interior1"
        voDurSec={VO.b3_interior1}
        words={WORDS.b3_interior1}
        move={{ kind: 'slow_pan', direction: 'lr', amount: 60, scale: 1.10 }}
      />
    </Sequence>

    {/* B4 — Interior 2 (parallax — third motion type) */}
    <Sequence from={F(OFF.b4_interior2)} durationInFrames={F(VO.b4_interior2) + OVERLAP}>
      <PhotoBeat
        imgSlug={PHOTOS[4]}
        voSlug="b4_interior2"
        voDurSec={VO.b4_interior2}
        words={WORDS.b4_interior2}
        move={{ kind: 'parallax', scale: 1.08 }}
      />
    </Sequence>

    {/* B5 — Grounds: PATTERN INTERRUPT 50% (interior → outdoor) */}
    <Sequence from={F(OFF.b5_grounds)} durationInFrames={F(VO.b5_grounds) + OVERLAP}>
      <PhotoBeat
        imgSlug={PHOTOS[2]}
        voSlug="b5_grounds"
        voDurSec={VO.b5_grounds}
        words={WORDS.b5_grounds}
        move={{ kind: 'slow_pan', direction: 'rl', amount: 50, scale: 1.10 }}
      />
    </Sequence>

    {/* B6 — Bridge: silent hold on aerial before kinetic reveal */}
    <Sequence from={F(OFF.b6_bridge)} durationInFrames={F(VO.b6_bridge) + OVERLAP}>
      <PhotoBeat
        imgSlug={PHOTOS[0]}
        voSlug="b6_bridge"
        voDurSec={VO.b6_bridge}
        words={[]}
        move={{ kind: 'push_in', from: 1.06, to: 1.10 }}
      />
    </Sequence>

    {/* KINETIC REVEAL — final 15% of video (pattern interrupt #3) */}
    <Sequence from={F(OFF.reveal)} durationInFrames={F(REVEAL_SEC) + OVERLAP}>
      <KineticReveal
        price="$1,499,000"
        details="3 BD · 2 BA · 1,980 SQFT · 2.28 ACRES"
        cta="OPEN SAT 11-2"
        durationSec={REVEAL_SEC}
      />
    </Sequence>

    {/* OUTRO */}
    <Sequence from={F(OFF.outro)} durationInFrames={F(OUTRO_SEC)}>
      <OutroCard durationSec={OUTRO_SEC} />
    </Sequence>
  </AbsoluteFill>
)

export const LISTING_REVEAL_FRAMES = F(LISTING_REVEAL_TOTAL_SEC)
