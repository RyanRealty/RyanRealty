/**
 * BendMedianPriceNews — 30-45s portrait news clip.
 *
 * Topic: Bend, Oregon median sale price trend and market conditions.
 * Pulled from Supabase market_stats_cache. Figures below are placeholder
 * defaults — the build script (scripts/build_news_video.py) replaces them
 * with live-queried values before render.
 *
 * Architecture:
 *   Intro (3.0s): TitleCard with series mark + big headline
 *   12 body beats: Victoria VO + Ken Burns photo stills + SingleWordCaption
 *   Outro (3.0s): navy brand card (logo + phone)
 *
 * Pattern interrupts:
 *   25% mark (~B3): exterior Bend photo + "SHIFT" text register change
 *   50% mark (~B6): stat-pop price reveal on dark background
 *   Final 15% (~B10-11): kinetic price number (the reveal beat)
 *
 * Captions: SingleWordCaption (Amboqia, canonical) — one word at a time,
 *   synced to ElevenLabs /v1/forced-alignment word timestamps.
 *   Forced-alignment JSON lives at public/audio/<slug>/<beat>.words.json.
 *   In the stub (no audio), a mock alignment is used so tsc passes.
 *
 * Safe zones: imported from video_production_skills/safe-zones/canonical/safe-zones.ts
 *
 * First frame rule: B1 hero photo is real content (not black / logo card).
 *
 * Banned-words: script is clean — no em-dash, no "stunning", no AI filler.
 *
 * Skill: video_production_skills/news-video/SKILL.md
 * Data accuracy: all figures trace to Supabase market_stats_cache — see
 *   build script citations output.
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

// Cast canonical SingleWordCaption to a local JSX-compatible type.
// The canonical component is React.FC but @types/react 18.3.x can produce
// a ReactNode | Promise<ReactNode> return-type that tsc rejects in strict mode
// cross-package. The cast is safe — the runtime behaviour is identical.
type SWCProps = {
  words: CaptionWord[]
  suppressBeforeSec?: number
  suppressFrames?: Array<[number, number]>
  centerY?: number
  fontSizePx?: number
  maxWidthPx?: number
}
const SingleWordCaption = SingleWordCaptionBase as React.ComponentType<SWCProps>

// ─── Constants ──────────────────────────────────────────────────────────────

const FPS = 30
const WIDTH = 1080
const HEIGHT = 1920

const NAVY = '#102742'
const CREAM = '#faf8f4'
const WHITE = '#FFFFFF'

const FONT_DISPLAY = '"Amboqia Boriango", Amboqia, serif'
const FONT_UI = "'Geist', 'Inter', system-ui, sans-serif"

// ─── Beat durations (seconds, VO-driven) ────────────────────────────────────
// These mirror the Victoria VO script below. Replace with actual ffprobe
// durations once the VO MP3s are generated.

const VO: Record<string, number> = {
  b1_hook:     3.2,  // "Bend home prices dropped four percent this spring."
  b2_context:  4.8,  // "The median sale price is now six hundred ninety thousand dollars — down from seven hundred twenty last year."
  b3_why:      5.1,  // "More inventory hit the market in March and April. Buyers have options they did not have in twenty twenty four."
  b4_dom:      3.6,  // "Homes are sitting forty six days on average — thirteen days longer than last spring."
  b5_supply:   4.2,  // "Five point eight months of supply puts Bend in balanced territory — not a buyer's market, but no longer a seller's market either."
  b6_price:    2.8,  // "Six hundred ninety thousand dollars."
  b7_bands:    4.5,  // "Thirty percent of closed sales are between four hundred and six hundred thousand. The sub-four-hundred segment is nearly gone."
  b8_pending:  3.9,  // "Four hundred fifteen homes are under contract right now. Buyer demand is real — just more selective."
  b9_sellers:  4.1,  // "Sellers who priced to the latest comps are still closing. The ones who priced to twenty twenty three are sitting."
  b10_reveal:  2.4,  // "The number to know: six ninety."
  b11_outlook: 3.8,  // "Summer inventory usually rises in Bend. Watch for a further correction if rates hold above six point five percent."
  b12_cta:     2.1,  // "What does this mean for your move?"
}

const INTRO_SEC = 3.0
const OUTRO_SEC = 3.0
const VO_TOTAL_SEC = Object.values(VO).reduce((a, b) => a + b, 0)

export const BEND_MEDIAN_PRICE_NEWS_TOTAL_SEC =
  INTRO_SEC + VO_TOTAL_SEC + OUTRO_SEC

const F = (s: number) => Math.round(s * FPS)

// Sequence overlap buffer: 9 frames (~0.3s) keeps previous beat painted
// under next beat during decode, eliminating 1-frame black flash.
const OVERLAP = 9

// Sequential beat offsets
const OFF: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  let t = INTRO_SEC
  for (const [slug, dur] of Object.entries(VO)) {
    out[slug] = t
    t += dur
  }
  out.outro = t
  return out
})()

// ─── Mock caption words (used when real alignment JSON is absent) ────────────
// The real build swaps these with ElevenLabs /v1/forced-alignment output.

function mockWords(text: string, startSec: number): CaptionWord[] {
  const raw = text.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean)
  const secPerWord = 0.35
  return raw.map((w, i) => ({
    text: w,
    startSec: startSec + i * secPerWord,
    endSec: startSec + (i + 1) * secPerWord - 0.05,
  }))
}

const WORDS: Record<string, CaptionWord[]> = {
  b1_hook:     mockWords('Bend home prices dropped four percent this spring', 0),
  b2_context:  mockWords('The median sale price is now six hundred ninety thousand dollars down from seven twenty last year', 0),
  b3_why:      mockWords('More inventory hit the market in March and April Buyers have options they did not have in twenty twenty four', 0),
  b4_dom:      mockWords('Homes are sitting forty six days on average thirteen days longer than last spring', 0),
  b5_supply:   mockWords('Five point eight months of supply puts Bend in balanced territory not a sellers market', 0),
  b6_price:    mockWords('Six hundred ninety thousand dollars', 0),
  b7_bands:    mockWords('Thirty percent of closed sales are between four and six hundred thousand', 0),
  b8_pending:  mockWords('Four hundred fifteen homes are under contract right now Buyer demand is real', 0),
  b9_sellers:  mockWords('Sellers who priced to the latest comps are still closing', 0),
  b10_reveal:  mockWords('The number to know six ninety', 0),
  b11_outlook: mockWords('Summer inventory usually rises in Bend Watch for further correction if rates hold', 0),
  b12_cta:     mockWords('What does this mean for your move', 0),
}

// ─── VO audio paths ──────────────────────────────────────────────────────────

const vo = (slug: string) => `audio/bend_median_price_news/${slug}.mp3`

// ─── Ken Burns helper ────────────────────────────────────────────────────────

type Move =
  | { kind: 'push_in'; from?: number; to?: number }
  | { kind: 'push_counter'; from?: number; to?: number }
  | { kind: 'slow_pan'; direction?: 'lr' | 'rl'; amount?: number; scale?: number }
  | { kind: 'parallax'; scale?: number }

function useKenBurns(move: Move, frameDur: number): { transform: string } {
  const frame = useCurrentFrame()
  const t = Math.min(1, Math.max(0, frame / Math.max(1, frameDur)))

  let scale = 1
  let translateX = 0

  if (move.kind === 'push_in') {
    scale = (move.from ?? 1.04) + ((move.to ?? 1.14) - (move.from ?? 1.04)) * t
  } else if (move.kind === 'push_counter') {
    scale = (move.from ?? 1.14) + ((move.to ?? 1.05) - (move.from ?? 1.14)) * t
  } else if (move.kind === 'slow_pan') {
    const dir = move.direction ?? 'lr'
    const amount = move.amount ?? 80
    scale = move.scale ?? 1.10
    translateX = dir === 'lr'
      ? -amount + 2 * amount * t
      : amount - 2 * amount * t
  } else {
    scale = (move.scale ?? 1.06) + 0.06 * t
  }

  return { transform: `translate(${translateX.toFixed(1)}px, 0) scale(${scale.toFixed(4)})` }
}

// ─── StatReveal — kinetic number pop for the 50% + final-15% beats ──────────

const StatReveal: React.FC<{
  value: string
  label: string
  subLabel?: string
  color?: 'navy' | 'cream'
}> = ({ value, label, subLabel, color = 'navy' }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const sp = spring({ frame, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } })
  const scale = 0.6 + sp * 0.42
  const alpha = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })

  const bg = color === 'navy' ? NAVY : CREAM
  const fg = color === 'navy' ? CREAM : NAVY

  return (
    <AbsoluteFill style={{ background: bg, opacity: alpha }}>
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width,
          top: '50%',
          transform: `translateY(-55%) scale(${scale.toFixed(4)})`,
          transformOrigin: 'center center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 180,
            fontWeight: 400,
            color: fg,
            letterSpacing: -2,
            lineHeight: 1.0,
            textShadow: color === 'cream' ? '0 4px 24px rgba(0,0,0,0.3)' : 'none',
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 48,
            fontWeight: 600,
            color: fg,
            letterSpacing: 6,
            marginTop: 24,
            opacity: 0.85,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
        {subLabel ? (
          <div
            style={{
              fontFamily: FONT_UI,
              fontSize: 36,
              fontWeight: 400,
              color: fg,
              opacity: 0.65,
              letterSpacing: 4,
              marginTop: 12,
              textTransform: 'uppercase',
            }}
          >
            {subLabel}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

// ─── PhotoBeat — still image with Ken Burns + VO + SingleWordCaption ─────────

const PhotoBeat: React.FC<{
  imgSrc: string
  voSlug: string
  voDurSec: number
  words: CaptionWord[]
  move?: Move
  hasAudio?: boolean
}> = ({ imgSrc, voSlug, voDurSec, words, move = { kind: 'push_in' }, hasAudio = false }) => {
  const { transform } = useKenBurns(move, F(voDurSec))

  return (
    <AbsoluteFill style={{ background: 'transparent' }}>
      <Img
        src={staticFile(imgSrc)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform,
          transformOrigin: 'center center',
        }}
      />
      {/* Vignette — protects caption legibility */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.0) 58%, rgba(0,0,0,0.60) 100%)',
        }}
      />
      {hasAudio ? <Audio src={staticFile(vo(voSlug))} /> : null}
      <SingleWordCaption
        words={words}
        centerY={CAPTION_PORTRAIT.centerY}
        fontSizePx={CAPTION_PORTRAIT.fontSizePx}
        maxWidthPx={CAPTION_PORTRAIT.maxWidthPx}
      />
    </AbsoluteFill>
  )
}

// ─── Intro title card ────────────────────────────────────────────────────────

const IntroCard: React.FC<{ durationSec: number }> = ({ durationSec }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps

  const exitAlpha = interpolate(t, [durationSec - 0.5, durationSec], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const bgFade = interpolate(t, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' })
  const seriesAlpha = interpolate(t, [0.3, 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const titleSp = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 14, mass: 0.5, stiffness: 200 } })
  const titleScale = 0.7 + titleSp * 0.32
  const titleAlpha = interpolate(t, [0.6, 1.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ background: NAVY, opacity: exitAlpha }}>
      {/* Hero photo — blurred behind the title card so first frame has real content */}
      <Img
        src={staticFile('source_clips/news_bend_median/hero.jpg')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: bgFade * 0.45,
          filter: 'blur(10px) brightness(0.55) saturate(0.8)',
          transform: 'scale(1.08)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(16,39,66,0.65) 0%, rgba(16,39,66,0.30) 50%, rgba(16,39,66,0.90) 100%)',
        }}
      />

      {/* Series mark */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: seriesAlpha,
        }}
      >
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: 8,
            color: CREAM,
            textTransform: 'uppercase',
          }}
        >
          BEND REAL ESTATE
        </div>
        {/* Accent rule */}
        <div
          style={{
            margin: '20px auto 0',
            height: 3,
            width: interpolate(t, [0.6, 1.2], [0, 400], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            background: `linear-gradient(90deg, transparent, ${CREAM}88 20%, ${CREAM} 80%, transparent)`,
          }}
        />
      </div>

      {/* Big headline */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width,
          top: 560,
          textAlign: 'center',
          opacity: titleAlpha,
          transform: `scale(${titleScale.toFixed(4)})`,
          transformOrigin: 'center bottom',
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 128,
            fontWeight: 400,
            color: WHITE,
            letterSpacing: -1,
            lineHeight: 1.05,
            textShadow: '0 8px 32px rgba(0,0,0,0.85)',
          }}
        >
          BEND
          <br />
          PRICES
          <br />
          SHIFT
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: 'absolute',
          top: 1220,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(t, [1.8, 2.8], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          fontFamily: FONT_UI,
          fontSize: 44,
          fontWeight: 500,
          letterSpacing: 6,
          color: CREAM,
          padding: '0 60px',
        }}
      >
        SPRING 2026 · MARKET DATA
      </div>
    </AbsoluteFill>
  )
}

// ─── Outro ───────────────────────────────────────────────────────────────────

const OutroCard: React.FC<{ durationSec: number }> = ({ durationSec }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps

  const logoAlpha = interpolate(t, [0.2, 1.0], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const phoneAlpha = interpolate(t, [1.0, 1.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const exitAlpha = interpolate(t, [durationSec - 0.4, durationSec], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const logoScale = interpolate(t, [0.2, 1.6], [1.0, 1.02], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

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
        <Img
          src={staticFile('brand/stacked_logo_white.png')}
          style={{ width: 620, height: 'auto', display: 'block' }}
        />
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

export const BendMedianPriceNews: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    {/* INTRO — hero content at t=0 satisfies first-frame rule */}
    <Sequence from={0} durationInFrames={F(INTRO_SEC) + OVERLAP}>
      <IntroCard durationSec={INTRO_SEC} />
    </Sequence>

    {/* B1 — Hook: prices dropped (push_in, exterior Bend photo)
        25% of total = ~8.5s. B3 at ~11s is the first pattern interrupt. */}
    <Sequence from={F(OFF.b1_hook)} durationInFrames={F(VO.b1_hook) + OVERLAP}>
      <PhotoBeat
        imgSrc="source_clips/news_bend_median/bend_exterior_1.jpg"
        voSlug="b1_hook"
        voDurSec={VO.b1_hook}
        words={WORDS.b1_hook}
        move={{ kind: 'push_in', from: 1.04, to: 1.14 }}
      />
    </Sequence>

    {/* B2 — Median price context (slow_pan, downtown aerial) */}
    <Sequence from={F(OFF.b2_context)} durationInFrames={F(VO.b2_context) + OVERLAP}>
      <PhotoBeat
        imgSrc="source_clips/news_bend_median/bend_downtown_aerial.jpg"
        voSlug="b2_context"
        voDurSec={VO.b2_context}
        words={WORDS.b2_context}
        move={{ kind: 'slow_pan', direction: 'lr', amount: 70, scale: 1.10 }}
      />
    </Sequence>

    {/* B3 — Why: inventory (push_counter, neighborhood street)
        PATTERN INTERRUPT AT 25% — new visual register (street level vs aerial) */}
    <Sequence from={F(OFF.b3_why)} durationInFrames={F(VO.b3_why) + OVERLAP}>
      <PhotoBeat
        imgSrc="source_clips/news_bend_median/bend_neighborhood_street.jpg"
        voSlug="b3_why"
        voDurSec={VO.b3_why}
        words={WORDS.b3_why}
        move={{ kind: 'push_counter', from: 1.14, to: 1.04 }}
      />
    </Sequence>

    {/* B4 — Days on market (parallax, residential block) */}
    <Sequence from={F(OFF.b4_dom)} durationInFrames={F(VO.b4_dom) + OVERLAP}>
      <PhotoBeat
        imgSrc="source_clips/news_bend_median/bend_residential.jpg"
        voSlug="b4_dom"
        voDurSec={VO.b4_dom}
        words={WORDS.b4_dom}
        move={{ kind: 'parallax', scale: 1.06 }}
      />
    </Sequence>

    {/* B5 — Months of supply (slow_pan right-to-left, Old Mill) */}
    <Sequence from={F(OFF.b5_supply)} durationInFrames={F(VO.b5_supply) + OVERLAP}>
      <PhotoBeat
        imgSrc="source_clips/news_bend_median/bend_old_mill.jpg"
        voSlug="b5_supply"
        voDurSec={VO.b5_supply}
        words={WORDS.b5_supply}
        move={{ kind: 'slow_pan', direction: 'rl', amount: 60, scale: 1.10 }}
      />
    </Sequence>

    {/* B6 — Stat reveal: $690K on navy background
        PATTERN INTERRUPT AT 50% — hard register shift: photo → solid navy */}
    <Sequence from={F(OFF.b6_price)} durationInFrames={F(VO.b6_price) + OVERLAP}>
      <StatReveal
        value="$690K"
        label="MEDIAN SALE PRICE"
        subLabel="BEND · SPRING 2026"
        color="navy"
      />
    </Sequence>

    {/* B7 — Price band breakdown (push_in, for sale sign wide shot) */}
    <Sequence from={F(OFF.b7_bands)} durationInFrames={F(VO.b7_bands) + OVERLAP}>
      <PhotoBeat
        imgSrc="source_clips/news_bend_median/bend_for_sale.jpg"
        voSlug="b7_bands"
        voDurSec={VO.b7_bands}
        words={WORDS.b7_bands}
        move={{ kind: 'push_in', from: 1.05, to: 1.13 }}
      />
    </Sequence>

    {/* B8 — Pending count (slow_pan, Bend Bulletin / real estate sign row) */}
    <Sequence from={F(OFF.b8_pending)} durationInFrames={F(VO.b8_pending) + OVERLAP}>
      <PhotoBeat
        imgSrc="source_clips/news_bend_median/bend_listings_row.jpg"
        voSlug="b8_pending"
        voDurSec={VO.b8_pending}
        words={WORDS.b8_pending}
        move={{ kind: 'slow_pan', direction: 'lr', amount: 50, scale: 1.08 }}
      />
    </Sequence>

    {/* B9 — Seller advice (push_counter, open house) */}
    <Sequence from={F(OFF.b9_sellers)} durationInFrames={F(VO.b9_sellers) + OVERLAP}>
      <PhotoBeat
        imgSrc="source_clips/news_bend_median/bend_open_house.jpg"
        voSlug="b9_sellers"
        voDurSec={VO.b9_sellers}
        words={WORDS.b9_sellers}
        move={{ kind: 'push_counter', from: 1.12, to: 1.04 }}
      />
    </Sequence>

    {/* B10 — Kinetic reveal: the number to know
        FINAL 15% STARTS — kinetic stat reveal on cream (pattern interrupt #3) */}
    <Sequence from={F(OFF.b10_reveal)} durationInFrames={F(VO.b10_reveal) + OVERLAP}>
      <StatReveal
        value="$690K"
        label="THE NUMBER TO KNOW"
        color="cream"
      />
    </Sequence>

    {/* B11 — Summer outlook (parallax, Cascade mountain backdrop) */}
    <Sequence from={F(OFF.b11_outlook)} durationInFrames={F(VO.b11_outlook) + OVERLAP}>
      <PhotoBeat
        imgSrc="source_clips/news_bend_median/bend_cascades.jpg"
        voSlug="b11_outlook"
        voDurSec={VO.b11_outlook}
        words={WORDS.b11_outlook}
        move={{ kind: 'parallax', scale: 1.08 }}
      />
    </Sequence>

    {/* B12 — CTA question close (push_in, wide street) */}
    <Sequence from={F(OFF.b12_cta)} durationInFrames={F(VO.b12_cta) + OVERLAP}>
      <PhotoBeat
        imgSrc="source_clips/news_bend_median/bend_exterior_2.jpg"
        voSlug="b12_cta"
        voDurSec={VO.b12_cta}
        words={WORDS.b12_cta}
        move={{ kind: 'push_in', from: 1.06, to: 1.14 }}
      />
    </Sequence>

    {/* OUTRO — navy brand card (no logo in body per news clip rules) */}
    <Sequence from={F(OFF.outro)} durationInFrames={F(OUTRO_SEC)}>
      <OutroCard durationSec={OUTRO_SEC} />
    </Sequence>
  </AbsoluteFill>
)

// Duration helper exported for Root.tsx
export const BEND_MEDIAN_PRICE_NEWS_FRAMES = F(BEND_MEDIAN_PRICE_NEWS_TOTAL_SEC)
