/**
 * DataVizComp — 30-45s portrait chart-driven market explainer.
 *
 * Structure (12+ beats, 30-45s total):
 *   Intro card (3.0s): title + subtitle on navy
 *   Beat 1 — Hook (3.5s): "Where is the Bend market right now?"
 *   Beat 2 — Chart intro (4.0s): multi-color line chart animates — month labels appear
 *   Beat 3 — Price reveal (4.0s): line draws to $690K endpoint (25% mark — pattern interrupt)
 *   Beat 4 — DOM stat (3.5s): Days on Market overlay appears on chart
 *   Beat 5 — Supply gauge (4.0s): 5.8 months gauge animates (50% mark — hard register shift to gauge view)
 *   Beat 6 — Bands pie (3.5s): price band breakdown
 *   Beat 7 — Pending (3.0s): 415 pending count
 *   Beat 8 — Trend line (3.5s): full chart with arrow + "watching for..."
 *   Beat 9 — Kinetic reveal (3.5s): final 15% — big "$690K" spring-in (pattern interrupt #3)
 *   Outro (3.0s): navy brand card
 *
 * Total: ~37.5s
 *
 * Chart: multi-color SVG line chart animated via Remotion interpolate.
 *   Each month segment draws in independently (sequential reveal).
 *   Colors cycle through the brand CHART_RAMP (5-step blue palette per brand.ts).
 *
 * Captions: SingleWordCaption (canonical Amboqia one-word-at-a-time).
 *   Stub uses mockWords() so tsc passes before VO is generated.
 *
 * Data: defaults from market_stats_cache rolling_90d Bend SFR.
 *   Build script replaces with live-queried values + writes citations.json.
 *   Figures are already in tests/fixtures/producer-payload-tumalo.json.
 *
 * Skill: video_production_skills/data_viz_video/SKILL.md
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
const FONT_MONO = "'Geist Mono', 'JetBrains Mono', monospace"

// Brand chart ramp — 5-step blue (per brand.ts)
const CHART_RAMP = ['#dbe7f2', '#a7c1dc', '#6f97c0', '#3b6ea3', NAVY]

// 12-month Bend median sale price (thousands) — rolling_90d SFR from market_stats_cache.
// The build script populates PRICE_DATA from the live payload; these are defaults for
// tsc compilation. All figures must trace to citations.json before render.
const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
const PRICES = [740, 728, 715, 700, 672, 660, 655, 660, 672, 681, 687, 690] // thousands

// ─── Beat durations ────────────────────────────────────────────────────────

const VO: Record<string, number> = {
  intro:    3.0,
  b1_hook:  3.5,   // "Where is the Bend market right now?"
  b2_chart: 4.0,   // "Let us look at twelve months of median sale prices."
  b3_price: 4.0,   // "The market peaked at seven forty in June and corrected to six ninety by May."
  b4_dom:   3.5,   // "Homes are sitting forty six days — thirteen longer than last spring."
  b5_supply:4.0,   // "Five point eight months of supply. That is balanced territory."
  b6_bands: 3.5,   // "Thirty percent of sales landed between four and six hundred thousand."
  b7_pend:  3.0,   // "Four hundred fifteen homes are under contract."
  b8_trend: 3.5,   // "Summer inventory usually rises. Watch for a continued correction if rates hold."
  b9_reveal:3.5,   // (kinetic final reveal — no VO, just the number)
}

const OUTRO_SEC = 3.0
const F = (s: number) => Math.round(s * FPS)
const OVERLAP = 9

const OFF: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  let t = 0
  for (const [slug, dur] of Object.entries(VO)) {
    out[slug] = t
    t += dur
  }
  out.outro = t
  return out
})()

export const DATA_VIZ_TOTAL_SEC =
  Object.values(VO).reduce((a, b) => a + b, 0) + OUTRO_SEC
export const DATA_VIZ_FRAMES = F(DATA_VIZ_TOTAL_SEC)

// ─── Mock caption words ────────────────────────────────────────────────────

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
  b1_hook:  mockWords('Where is the Bend market right now'),
  b2_chart: mockWords('Let us look at twelve months of median sale prices'),
  b3_price: mockWords('The market peaked at seven forty in June and corrected to six ninety by May'),
  b4_dom:   mockWords('Homes are sitting forty six days thirteen longer than last spring'),
  b5_supply:mockWords('Five point eight months of supply that is balanced territory'),
  b6_bands: mockWords('Thirty percent of sales landed between four and six hundred thousand'),
  b7_pend:  mockWords('Four hundred fifteen homes are under contract'),
  b8_trend: mockWords('Summer inventory usually rises watch for a continued correction if rates hold'),
}

const vo = (slug: string) => `audio/data_viz_bend/${slug}.mp3`

// ─── Chart helpers ─────────────────────────────────────────────────────────

const CHART_X = PORTRAIT_SAFE.x + 20
const CHART_Y = 520
const CHART_W = PORTRAIT_SAFE.width - 40
const CHART_H = 760

function chartXY(
  idx: number,
  price: number,
  minP: number,
  maxP: number,
): { cx: number; cy: number } {
  const n = PRICES.length
  const cx = CHART_X + Math.round((idx / (n - 1)) * CHART_W)
  const cy = CHART_Y + CHART_H - Math.round(((price - minP) / Math.max(maxP - minP, 1)) * CHART_H)
  return { cx, cy }
}

// ─── AnimatedChart component ───────────────────────────────────────────────

interface AnimatedChartProps {
  /** How many data points to reveal (1-12). Animates from left to right. */
  revealCount: number
  /** Show axis labels */
  showLabels?: boolean
  /** Highlight the final point with a big dot + value label */
  highlightEnd?: boolean
}

const AnimatedChart: React.FC<AnimatedChartProps> = ({
  revealCount,
  showLabels = true,
  highlightEnd = false,
}) => {
  const n = PRICES.length
  const minP = Math.min(...PRICES) - 20
  const maxP = Math.max(...PRICES) + 20

  // Build SVG path segments
  const points = PRICES.map((p, i) => chartXY(i, p, minP, maxP))
  const visible = Math.min(Math.max(revealCount, 1), n)

  // Y-axis grid labels
  const gridPrices = [660, 690, 720, 745]

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: WIDTH, height: HEIGHT }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ position: 'absolute', top: 0, left: 0, width: WIDTH, height: HEIGHT }}
      >
        {/* Grid lines */}
        {gridPrices.map((pv) => {
          const { cy } = chartXY(0, pv, minP, maxP)
          return (
            <g key={pv}>
              <line
                x1={CHART_X}
                y1={cy}
                x2={CHART_X + CHART_W}
                y2={cy}
                stroke="rgba(16,39,66,0.15)"
                strokeWidth={1}
                strokeDasharray="6 4"
              />
              {showLabels && (
                <text
                  x={CHART_X - 16}
                  y={cy + 5}
                  fill={NAVY}
                  fontSize={30}
                  fontFamily={FONT_MONO}
                  textAnchor="end"
                  opacity={0.65}
                >
                  ${pv}K
                </text>
              )}
            </g>
          )
        })}

        {/* Axis lines */}
        <line x1={CHART_X} y1={CHART_Y} x2={CHART_X} y2={CHART_Y + CHART_H}
          stroke={NAVY} strokeWidth={2} opacity={0.4} />
        <line x1={CHART_X} y1={CHART_Y + CHART_H} x2={CHART_X + CHART_W} y2={CHART_Y + CHART_H}
          stroke={NAVY} strokeWidth={2} opacity={0.4} />

        {/* Month labels */}
        {showLabels && MONTHS.map((m, i) => {
          const { cx } = points[i]
          if (i % 2 !== 0) return null
          return (
            <text
              key={m}
              x={cx}
              y={CHART_Y + CHART_H + 44}
              fill={NAVY}
              fontSize={28}
              fontFamily={FONT_UI}
              textAnchor="middle"
              opacity={i < visible ? 1 : 0.2}
            >
              {m}
            </text>
          )
        })}

        {/* Line segments + dots */}
        {PRICES.slice(0, visible - 1).map((_, i) => {
          const color = CHART_RAMP[i % CHART_RAMP.length]
          const { cx: x1, cy: y1 } = points[i]
          const { cx: x2, cy: y2 } = points[i + 1]
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color} strokeWidth={6} strokeLinecap="round" />
              <circle cx={x1} cy={y1} r={8} fill={color} />
            </g>
          )
        })}

        {/* Last visible dot */}
        {visible >= 1 && (() => {
          const { cx, cy } = points[visible - 1]
          const color = CHART_RAMP[(visible - 1) % CHART_RAMP.length]
          return (
            <g>
              <circle cx={cx} cy={cy} r={highlightEnd ? 14 : 8} fill={color} />
              {highlightEnd && (
                <text
                  x={cx + 20}
                  y={cy - 18}
                  fill={NAVY}
                  fontSize={36}
                  fontFamily={FONT_MONO}
                  fontWeight="bold"
                >
                  $690K
                </text>
              )}
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

// ─── Stat overlay — slides in from the right ──────────────────────────────

const StatOverlay: React.FC<{
  value: string
  label: string
  subLabel?: string
  top?: number
}> = ({ value, label, subLabel, top = 1280 }) => {
  const frame = useCurrentFrame()
  const sp = spring({ frame, fps: FPS, config: { damping: 14, mass: 0.5, stiffness: 180 } })
  const translateX = interpolate(sp, [0, 1], [200, 0])
  const alpha = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <div
      style={{
        position: 'absolute',
        right: PORTRAIT_SAFE.x,
        top,
        transform: `translateX(${translateX.toFixed(1)}px)`,
        opacity: alpha,
        textAlign: 'right',
      }}
    >
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 80,
          fontWeight: 400,
          color: NAVY,
          lineHeight: 1.0,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: FONT_UI,
          fontSize: 30,
          fontWeight: 600,
          color: NAVY,
          letterSpacing: 4,
          opacity: 0.70,
          textTransform: 'uppercase',
          marginTop: 8,
        }}
      >
        {label}
      </div>
      {subLabel ? (
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 26,
            fontWeight: 400,
            color: NAVY,
            opacity: 0.50,
            letterSpacing: 3,
            marginTop: 4,
            textTransform: 'uppercase',
          }}
        >
          {subLabel}
        </div>
      ) : null}
    </div>
  )
}

// ─── Gauge component for months-of-supply ────────────────────────────────

const SupplyGauge: React.FC<{ value: number; maxValue?: number }> = ({
  value,
  maxValue = 12,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const progress = interpolate(frame / fps, [0.3, 1.8], [0, value / maxValue], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const pct = progress * 100

  const BAR_X = PORTRAIT_SAFE.x + 20
  const BAR_Y = 600
  const BAR_W = PORTRAIT_SAFE.width - 40
  const BAR_H = 80
  const filledW = Math.round(BAR_W * progress)

  const verdictAlpha = interpolate(frame / fps, [1.5, 2.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: WIDTH, height: HEIGHT }}>
      {/* Track */}
      <div
        style={{
          position: 'absolute',
          left: BAR_X,
          top: BAR_Y,
          width: BAR_W,
          height: BAR_H,
          background: 'rgba(16,39,66,0.12)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        {/* Fill */}
        <div
          style={{
            width: filledW,
            height: '100%',
            background: `linear-gradient(90deg, ${CHART_RAMP[0]}, ${NAVY})`,
            borderRadius: 999,
            transition: 'width 0.1s',
          }}
        />
      </div>

      {/* Zone markers */}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ position: 'absolute', top: 0, left: 0, width: WIDTH, height: HEIGHT, pointerEvents: 'none' }}
      >
        {/* Seller / Balanced / Buyer zones */}
        {[
          { x: BAR_X + BAR_W * (4 / 12), label: '4 MO', color: 'rgba(16,39,66,0.40)' },
          { x: BAR_X + BAR_W * (6 / 12), label: '6 MO', color: 'rgba(16,39,66,0.40)' },
        ].map(({ x, label, color }) => (
          <g key={label}>
            <line x1={x} y1={BAR_Y - 12} x2={x} y2={BAR_Y + BAR_H + 12}
              stroke={color} strokeWidth={2} strokeDasharray="4 3" />
            <text x={x} y={BAR_Y - 24} textAnchor="middle"
              fill={NAVY} fontSize={26} fontFamily={FONT_UI} opacity={0.50}>
              {label}
            </text>
          </g>
        ))}

        {/* Value label on the fill end */}
        <text
          x={BAR_X + filledW + 16}
          y={BAR_Y + BAR_H / 2 + 10}
          fill={NAVY}
          fontSize={44}
          fontFamily={FONT_MONO}
          fontWeight="bold"
        >
          {pct > 2 ? `${value}` : ''}
        </text>
      </svg>

      {/* Zone labels below */}
      <div
        style={{
          position: 'absolute',
          left: BAR_X,
          top: BAR_Y + BAR_H + 20,
          width: BAR_W,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        {['SELLER\'S', 'BALANCED', 'BUYER\'S'].map((z) => (
          <div
            key={z}
            style={{
              fontFamily: FONT_UI,
              fontSize: 24,
              fontWeight: 500,
              color: NAVY,
              opacity: 0.45,
              letterSpacing: 3,
            }}
          >
            {z}
          </div>
        ))}
      </div>

      {/* Verdict */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width,
          top: BAR_Y + BAR_H + 110,
          textAlign: 'center',
          opacity: verdictAlpha,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            background: NAVY,
            color: CREAM,
            fontFamily: FONT_UI,
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: 6,
            padding: '14px 40px',
            borderRadius: 999,
            textTransform: 'uppercase',
          }}
        >
          5.8 MONTHS · BALANCED MARKET
        </div>
      </div>
    </div>
  )
}

// ─── Scene wrapper (cream background + chart + stat overlays + captions) ─────

const ChartScene: React.FC<{
  revealCount: number
  voSlug: string
  voDurSec: number
  words: CaptionWord[]
  title: string
  statValue?: string
  statLabel?: string
  statSub?: string
  highlightEnd?: boolean
  hasAudio?: boolean
}> = ({
  revealCount,
  voSlug,
  voDurSec: _voDurSec,
  words,
  title,
  statValue,
  statLabel,
  statSub,
  highlightEnd = false,
  hasAudio = false,
}) => (
  <AbsoluteFill style={{ background: CREAM }}>
    {/* Title */}
    <div
      style={{
        position: 'absolute',
        left: PORTRAIT_SAFE.x,
        right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width,
        top: PORTRAIT_SAFE.y + 20,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 64,
          fontWeight: 400,
          color: NAVY,
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: FONT_UI,
          fontSize: 30,
          fontWeight: 500,
          color: NAVY,
          opacity: 0.55,
          letterSpacing: 5,
          marginTop: 10,
          textTransform: 'uppercase',
        }}
      >
        BEND SFR · ROLLING 90-DAY · 2026
      </div>
    </div>

    {/* Chart */}
    <AnimatedChart revealCount={revealCount} showLabels highlightEnd={highlightEnd} />

    {/* Optional stat overlay */}
    {statValue && statLabel ? (
      <StatOverlay value={statValue} label={statLabel} subLabel={statSub} top={1320} />
    ) : null}

    {hasAudio ? <Audio src={staticFile(vo(voSlug))} /> : null}

    <SingleWordCaption
      words={words}
      centerY={CAPTION_PORTRAIT.centerY}
      fontSizePx={CAPTION_PORTRAIT.fontSizePx}
      maxWidthPx={CAPTION_PORTRAIT.maxWidthPx}
    />
  </AbsoluteFill>
)

// ─── Intro card ───────────────────────────────────────────────────────────

const IntroCard: React.FC<{ durationSec: number }> = ({ durationSec }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps

  const titleSp = spring({ frame: Math.max(0, frame - 9), fps, config: { damping: 14, mass: 0.5, stiffness: 200 } })
  const exitAlpha = interpolate(t, [durationSec - 0.5, durationSec], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ background: NAVY, opacity: exitAlpha }}>
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width,
          top: HEIGHT * 0.32,
          textAlign: 'center',
          transform: `scale(${(0.6 + titleSp * 0.42).toFixed(4)})`,
          transformOrigin: 'center center',
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 130,
            fontWeight: 400,
            color: CREAM,
            lineHeight: 1.0,
          }}
        >
          BEND
          <br />
          MARKET
          <br />
          DATA
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: HEIGHT * 0.73,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(t, [1.2, 2.2], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          fontFamily: FONT_UI,
          fontSize: 38,
          fontWeight: 500,
          letterSpacing: 8,
          color: CREAM,
          opacity: 0.70,
          textTransform: 'uppercase',
        }}
      >
        SPRING 2026 · 12-MONTH TREND
      </div>
    </AbsoluteFill>
  )
}

// ─── Supply beat (hard register shift at 50%) ────────────────────────────

const SupplyBeat: React.FC<{
  voSlug: string
  words: CaptionWord[]
  hasAudio?: boolean
}> = ({ voSlug, words, hasAudio = false }) => (
  <AbsoluteFill style={{ background: CREAM }}>
    <div
      style={{
        position: 'absolute',
        left: PORTRAIT_SAFE.x,
        right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width,
        top: PORTRAIT_SAFE.y + 20,
        textAlign: 'center',
      }}
    >
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 64, color: NAVY, lineHeight: 1.1 }}>
        MONTHS OF SUPPLY
      </div>
      <div style={{
        fontFamily: FONT_UI, fontSize: 30, color: NAVY, opacity: 0.55,
        letterSpacing: 5, marginTop: 10, textTransform: 'uppercase',
      }}>
        BEND SFR · MAY 2026
      </div>
    </div>
    <SupplyGauge value={5.8} />
    {hasAudio ? <Audio src={staticFile(vo(voSlug))} /> : null}
    <SingleWordCaption
      words={words}
      centerY={CAPTION_PORTRAIT.centerY}
      fontSizePx={CAPTION_PORTRAIT.fontSizePx}
      maxWidthPx={CAPTION_PORTRAIT.maxWidthPx}
    />
  </AbsoluteFill>
)

// ─── Kinetic final reveal (final 15%) ────────────────────────────────────

const KineticReveal: React.FC<{ durationSec: number }> = ({ durationSec }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps

  const sp = spring({ frame, fps, config: { damping: 12, mass: 0.5, stiffness: 200 } })
  const subSp = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 14, mass: 0.5, stiffness: 180 } })
  const exitAlpha = interpolate(t, [durationSec - 0.5, durationSec], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ background: NAVY, opacity: exitAlpha }}>
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width,
          top: HEIGHT * 0.28,
          textAlign: 'center',
          transform: `scale(${(0.6 + sp * 0.42).toFixed(4)})`,
          transformOrigin: 'center center',
        }}
      >
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 160,
          fontWeight: 400,
          color: CREAM,
          lineHeight: 1.0,
          letterSpacing: -2,
        }}>
          $690K
        </div>
        <div style={{
          fontFamily: FONT_UI,
          fontSize: 42,
          fontWeight: 500,
          color: CREAM,
          opacity: 0.70,
          letterSpacing: 6,
          marginTop: 20,
          textTransform: 'uppercase',
        }}>
          MEDIAN SALE PRICE
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT_SAFE.x,
          right: WIDTH - PORTRAIT_SAFE.x - PORTRAIT_SAFE.width,
          top: HEIGHT * 0.62,
          textAlign: 'center',
          transform: `scale(${(0.7 + subSp * 0.32).toFixed(4)})`,
          transformOrigin: 'center center',
        }}
      >
        <div style={{
          fontFamily: FONT_UI,
          fontSize: 38,
          fontWeight: 400,
          color: CREAM,
          opacity: 0.60,
          letterSpacing: 4,
          lineHeight: 1.6,
          textTransform: 'uppercase',
        }}>
          BEND · SPRING 2026
          <br />
          46 DAYS ON MARKET
          <br />
          5.8 MONTHS SUPPLY
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
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -60%) scale(${logoScale.toFixed(3)})`,
        opacity: logoAlpha,
      }}>
        <Img src={staticFile('brand/stacked_logo_white.png')} style={{ width: 620, height: 'auto' }} />
      </div>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, 60px)',
        opacity: phoneAlpha,
        fontFamily: FONT_UI, fontSize: 44, fontWeight: 500, letterSpacing: 3,
        color: WHITE, textAlign: 'center',
      }}>
        541.213.6706
      </div>
    </AbsoluteFill>
  )
}

// ─── Root composition ────────────────────────────────────────────────────────

export const DataVizComp: React.FC = () => {
  // Animate revealCount across beats based on current global frame
  const frame = useCurrentFrame()
  const t = frame / FPS

  // Map global time to chart reveal progress
  const chartStart = OFF.b2_chart
  const chartEnd = OFF.b9_reveal
  const revealCount = t < chartStart
    ? 0
    : Math.round(interpolate(t, [chartStart, chartEnd], [1, PRICES.length], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }))

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* Intro */}
      <Sequence from={0} durationInFrames={F(VO.intro) + OVERLAP}>
        <IntroCard durationSec={VO.intro} />
      </Sequence>

      {/* B1 — Hook on cream (first real chart scene) */}
      <Sequence from={F(OFF.b1_hook)} durationInFrames={F(VO.b1_hook) + OVERLAP}>
        <ChartScene
          revealCount={1}
          voSlug="b1_hook"
          voDurSec={VO.b1_hook}
          words={WORDS.b1_hook}
          title="BEND MEDIAN PRICE"
        />
      </Sequence>

      {/* B2 — Chart intro: line starts drawing */}
      <Sequence from={F(OFF.b2_chart)} durationInFrames={F(VO.b2_chart) + OVERLAP}>
        <ChartScene
          revealCount={revealCount}
          voSlug="b2_chart"
          voDurSec={VO.b2_chart}
          words={WORDS.b2_chart}
          title="BEND MEDIAN PRICE"
        />
      </Sequence>

      {/* B3 — Price peak to endpoint (25% pattern interrupt: price label appears) */}
      <Sequence from={F(OFF.b3_price)} durationInFrames={F(VO.b3_price) + OVERLAP}>
        <ChartScene
          revealCount={revealCount}
          voSlug="b3_price"
          voDurSec={VO.b3_price}
          words={WORDS.b3_price}
          title="$740K → $690K"
          highlightEnd
        />
      </Sequence>

      {/* B4 — DOM stat overlay */}
      <Sequence from={F(OFF.b4_dom)} durationInFrames={F(VO.b4_dom) + OVERLAP}>
        <ChartScene
          revealCount={PRICES.length}
          voSlug="b4_dom"
          voDurSec={VO.b4_dom}
          words={WORDS.b4_dom}
          title="DAYS ON MARKET"
          statValue="46 days"
          statLabel="MEDIAN DOM"
          statSub="↑ 13 DAYS VS SPRING 2025"
          highlightEnd
        />
      </Sequence>

      {/* B5 — Supply gauge (50% hard register shift: chart → gauge) */}
      <Sequence from={F(OFF.b5_supply)} durationInFrames={F(VO.b5_supply) + OVERLAP}>
        <SupplyBeat voSlug="b5_supply" words={WORDS.b5_supply} />
      </Sequence>

      {/* B6 — Price bands back on chart */}
      <Sequence from={F(OFF.b6_bands)} durationInFrames={F(VO.b6_bands) + OVERLAP}>
        <ChartScene
          revealCount={PRICES.length}
          voSlug="b6_bands"
          voDurSec={VO.b6_bands}
          words={WORDS.b6_bands}
          title="PRICE BANDS"
          statValue="30%"
          statLabel="$400K–$600K"
          statSub="LARGEST SALES SEGMENT"
          highlightEnd
        />
      </Sequence>

      {/* B7 — Pending */}
      <Sequence from={F(OFF.b7_pend)} durationInFrames={F(VO.b7_pend) + OVERLAP}>
        <ChartScene
          revealCount={PRICES.length}
          voSlug="b7_pend"
          voDurSec={VO.b7_pend}
          words={WORDS.b7_pend}
          title="PENDING CONTRACTS"
          statValue="415"
          statLabel="UNDER CONTRACT NOW"
          highlightEnd
        />
      </Sequence>

      {/* B8 — Trend outlook */}
      <Sequence from={F(OFF.b8_trend)} durationInFrames={F(VO.b8_trend) + OVERLAP}>
        <ChartScene
          revealCount={PRICES.length}
          voSlug="b8_trend"
          voDurSec={VO.b8_trend}
          words={WORDS.b8_trend}
          title="WHAT TO WATCH"
          highlightEnd
        />
      </Sequence>

      {/* B9 — Kinetic reveal (final 15%) */}
      <Sequence from={F(OFF.b9_reveal)} durationInFrames={F(VO.b9_reveal) + OVERLAP}>
        <KineticReveal durationSec={VO.b9_reveal} />
      </Sequence>

      {/* Outro */}
      <Sequence from={F(OFF.outro)} durationInFrames={F(OUTRO_SEC)}>
        <OutroCard durationSec={OUTRO_SEC} />
      </Sequence>
    </AbsoluteFill>
  )
}
