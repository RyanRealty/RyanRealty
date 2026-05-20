/**
 * YouTubeMarketReportYTLong — 1920x1080 long-form market report (Tier 2 deep-dive).
 *
 * This is the EXTENDED long-form variant of YouTubeMarketReport, adding:
 *   - Chapter selector overlay for YouTube chapters
 *   - "Sources cited" on-screen overlays per beat ("per Spark MLS, April 2026")
 *   - Photo b-roll interleaved between data-viz chapters
 *   - Full 8-12 minute structure (vs the 10-chapter 11:15 default)
 *   - Progress bar at bottom of frame (thin navy strip, % complete)
 *   - More detailed takeaway chapter with buyer/seller/investor split
 *
 * Differences from YouTubeMarketReport:
 *   - Adds <SourceCitationBug> overlay on every stat scene
 *   - Adds <ProgressBar> at y=1060 (inside LANDSCAPE_AVOID_BOTTOM, clears ctrl bar)
 *   - Adds <BRollInterlude> scenes between stat chapters (landscape photo + context text)
 *   - Adds <InvestorTakeaway> as Ch 9b optional sub-chapter
 *   - Chapter overlay uses YouTube-chapters-compatible naming (00:45 Ch 2 — Median Price, etc.)
 *
 * Structure (default 12 chapters, ~720s total):
 *   Ch 1   0:00-0:30   Cold open + hook
 *   Ch 2   0:30-2:15   Median sale price + 4-year history (line_chart)
 *   BR 1   2:15-2:45   B-roll interlude (landscape photo: market activity)
 *   Ch 3   2:45-4:30   Price segments histogram
 *   Ch 4   4:30-6:00   Months of supply gauge + market verdict
 *   BR 2   6:00-6:30   B-roll interlude (neighborhood photo)
 *   Ch 5   6:30-8:00   Days on market distribution
 *   Ch 6   8:00-9:30   Sale-to-list + concessions bar
 *   BR 3   9:30-10:00  B-roll interlude (buyer perspective photo)
 *   Ch 7  10:00-11:30  Cash buyers donut
 *   Ch 8  11:30-13:00  Top neighborhoods leaderboard
 *   Ch 9  13:00-15:00  Agent commentary (takeaway) — buyer + seller + investor
 *   Ch 10 15:00-15:45  CTA + sources + closing card
 *
 * Default total: ~15:45 (945 frames at 30fps).
 *
 * Caption zone: landscape y 880-1000 (CAPTION_LANDSCAPE per safe-zones.ts).
 * Progress bar: y 1060-1070 (below caption band, above YT control bar floor).
 * Sources bug: top-right corner y 90-130, right 90 — always inside LANDSCAPE_SAFE.
 *
 * See video_production_skills/youtube-long-form-market-report/SKILL.md §3 for
 * the full architecture and data-accuracy rules.
 */

import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from 'remotion'
import { KineticCaptions, CaptionWord } from './KineticCaptions'
import { IntroScene } from './scenes/IntroScene'
import { StatScene, StatSceneProps } from './scenes/StatScene'
import { OutroScene } from './scenes/OutroScene'
import { LandscapeImageLayer } from './scenes/LandscapeImageLayer'
import { FPS, NAVY, CREAM, GOLD, WHITE, FONT_BODY, FONT_HEAD, WIDTH, HEIGHT } from './brand'

// Re-export for callers
export type { CaptionWord }
export type { StatSceneProps }

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * SourceCitationBug — "per Spark MLS, April 2026" badge in top-right corner.
 * Shown for the first 4 seconds of each stat chapter, then fades out.
 */
const SourceCitationBug: React.FC<{
  source: string
  opacity: number
}> = ({ source, opacity }) => {
  if (!source || opacity < 0.01) return null
  return (
    <div
      style={{
        position: 'absolute',
        top: 90,
        right: 90,
        background: 'rgba(16,39,66,0.80)',
        borderRadius: 10,
        padding: '8px 20px',
        opacity,
        pointerEvents: 'none',
        maxWidth: 520,
      }}
    >
      <span
        style={{
          fontFamily: FONT_BODY,
          fontSize: 26,
          color: CREAM,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {source}
      </span>
    </div>
  )
}

/**
 * ProgressBar — thin navy strip at y=1060 showing video completion %.
 * Stays below the caption band (y 880-1000) and above YT controls (y 1000+).
 */
const ProgressBar: React.FC<{
  progress: number  // 0-1
}> = ({ progress }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 10,
      left: 0,
      width: WIDTH,
      height: 6,
      background: 'rgba(250,248,244,0.15)',
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        height: 6,
        width: `${progress * 100}%`,
        background: NAVY,
        transition: 'width 0.1s linear',
      }}
    />
  </div>
)

/**
 * ChapterChyron — "CHAPTER 2 · MEDIAN SALE PRICE" lower-third text that
 * fades in for 2 seconds at chapter start and fades out.
 * Placed at bottom-left inside LANDSCAPE_SAFE (y 880 max).
 */
const ChapterChyron: React.FC<{
  chapterNum: number
  title: string
  opacity: number
}> = ({ chapterNum, title, opacity }) => {
  if (opacity < 0.01) return null
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 120,
        left: 90,
        opacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(16,39,66,0.85)',
          borderLeft: `4px solid ${GOLD}`,
          padding: '10px 24px',
          display: 'inline-block',
          borderRadius: '0 10px 10px 0',
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 22,
            color: GOLD,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          CHAPTER {chapterNum}
        </div>
        <div
          style={{
            fontFamily: FONT_HEAD,
            fontSize: 40,
            color: WHITE,
            marginTop: 2,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
      </div>
    </div>
  )
}

/**
 * BRollInterlude — landscape photo + context text overlay between chapters.
 * Uses the same LandscapeImageLayer Ken Burns motion as stat scenes.
 */
const BRollInterlude: React.FC<{
  imageSrc: string
  contextText: string
  durationInFrames: number
}> = ({ imageSrc, contextText, durationInFrames }) => {
  const frame = useCurrentFrame()
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' })
  const textOp = Math.min(fadeIn, fadeOut)

  return (
    <AbsoluteFill>
      <LandscapeImageLayer src={imageSrc} durationInFrames={durationInFrames} direction="right" />
      {/* Dark scrim for text legibility */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, width: WIDTH, height: HEIGHT,
          background: 'rgba(10,26,46,0.45)',
        }}
      />
      {/* Context text — centered */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            maxWidth: 1300,
            textAlign: 'center',
            opacity: textOp,
            padding: '0 90px',
          }}
        >
          <div
            style={{
              fontFamily: FONT_HEAD,
              fontSize: 80,
              color: WHITE,
              lineHeight: 1.2,
              textShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}
          >
            {contextText}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type BRollDef = {
  contextText: string
  /** Image index (1-based) from public/<citySlug>/ */
  imageIdx?: number
}

/**
 * Extended chapter definition — adds source citation and optional b-roll after.
 */
export type YTLongChapterDef = Omit<StatSceneProps, 'chapterNumber' | 'chapterTitle' | 'imageSrc' | 'durationInFrames'> & {
  image_idx?: number
  chapterTitle?: string
  /** Citation for the SourceCitationBug — e.g. "per Spark MLS, April 2026" */
  source?: string
  /** If set, a b-roll interlude scene follows this chapter */
  bRollAfter?: BRollDef
  /** Override chapter duration in seconds */
  durationSec?: number
}

export type YouTubeMarketReportYTLongInput = {
  city: string
  period: string
  subhead: string
  eyebrow?: string
  citySlug?: string
  marketHealthLabel?: string
  medianPriceDisplay?: string

  voPath: string
  captionWords: CaptionWord[]

  /** Duration of intro chapter in seconds. Default 30. */
  introDurationSec?: number
  /** Duration of outro chapter in seconds. Default 45. */
  outroDurationSec?: number
  /** Duration of each b-roll interlude in seconds. Default 30. */
  bRollDurationSec?: number

  /** Extended chapter defs — Ch 2..N. B-roll interludes are inline. */
  chapters: YTLongChapterDef[]

  /** How many distinct images live in public/<citySlug>/ */
  imageCount?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const toFrames = (sec: number) => Math.max(1, Math.round(sec * FPS))

const DEFAULT_CHAPTER_TITLES = [
  'Cold Open',
  'Median Sale Price',
  'B-Roll',
  'Price Segments',
  'Months of Supply',
  'B-Roll',
  'Days on Market',
  'Sale-to-List',
  'B-Roll',
  'Cash Buyers',
  'Top Neighborhoods',
  'What This Means',
  'Get the Full Report',
]

const DEFAULT_CHAPTER_SEC = 105  // 1:45 default per chapter
const DEFAULT_INTRO_SEC = 30
const DEFAULT_OUTRO_SEC = 45
const DEFAULT_BROLL_SEC = 30

function beatImageSrc(citySlug: string, imageCount: number, beatIndex: number, explicitIdx?: number): string {
  if (explicitIdx && explicitIdx >= 1 && explicitIdx <= imageCount) {
    return `${citySlug}/img_${explicitIdx}.jpg`
  }
  return `${citySlug}/img_${(beatIndex % imageCount) + 1}.jpg`
}

export function computeYTLongTotalFrames(input: YouTubeMarketReportYTLongInput): number {
  const introDurationSec = input.introDurationSec ?? DEFAULT_INTRO_SEC
  const outroDurationSec = input.outroDurationSec ?? DEFAULT_OUTRO_SEC
  const bRollDurationSec = input.bRollDurationSec ?? DEFAULT_BROLL_SEC

  let total = toFrames(introDurationSec) + toFrames(outroDurationSec)
  for (const ch of input.chapters) {
    total += toFrames(ch.durationSec ?? DEFAULT_CHAPTER_SEC)
    if (ch.bRollAfter) {
      total += toFrames(bRollDurationSec)
    }
  }
  return total
}

// ── Composition ───────────────────────────────────────────────────────────────

export const YouTubeMarketReportYTLong: React.FC<YouTubeMarketReportYTLongInput> = (input) => {
  const {
    city, period, subhead, eyebrow, citySlug, marketHealthLabel, medianPriceDisplay,
    voPath, captionWords, chapters, imageCount = 15,
    introDurationSec = DEFAULT_INTRO_SEC,
    outroDurationSec = DEFAULT_OUTRO_SEC,
    bRollDurationSec = DEFAULT_BROLL_SEC,
  } = input

  const frame = useCurrentFrame()
  const { durationInFrames: totalFrames } = useVideoConfig()

  const slug = citySlug || city.toLowerCase().replace(/\s+/g, '-')

  // Build a flat timeline of scenes: intro, (stat, [broll])*, outro
  type SceneSlot =
    | { kind: 'intro'; startFrame: number; dur: number }
    | { kind: 'stat'; startFrame: number; dur: number; chIdx: number; chNum: number; titleStr: string; source: string }
    | { kind: 'broll'; startFrame: number; dur: number; def: BRollDef; imgSrc: string }
    | { kind: 'outro'; startFrame: number; dur: number }

  const scenes: SceneSlot[] = []
  let cursor = 0

  const introFrames = toFrames(introDurationSec)
  scenes.push({ kind: 'intro', startFrame: cursor, dur: introFrames })
  cursor += introFrames

  let brollImageCounter = 8  // start b-roll images from img_8 to avoid overlap with stat chapter imgs
  chapters.forEach((ch, i) => {
    const chNum = i + 2
    const chDur = toFrames(ch.durationSec ?? DEFAULT_CHAPTER_SEC)
    const titleStr = ch.chapterTitle || DEFAULT_CHAPTER_TITLES[chNum - 1] || `Chapter ${chNum}`
    const source = ch.source || ''
    scenes.push({ kind: 'stat', startFrame: cursor, dur: chDur, chIdx: i, chNum, titleStr, source })
    cursor += chDur

    if (ch.bRollAfter) {
      const bRollDur = toFrames(bRollDurationSec)
      const bRollImgIdx = ch.bRollAfter.imageIdx ?? brollImageCounter
      brollImageCounter = (brollImageCounter % imageCount) + 1
      const bRollImg = beatImageSrc(slug, imageCount, bRollImgIdx, ch.bRollAfter.imageIdx)
      scenes.push({ kind: 'broll', startFrame: cursor, dur: bRollDur, def: ch.bRollAfter, imgSrc: bRollImg })
      cursor += bRollDur
    }
  })

  const outroFrames = toFrames(outroDurationSec)
  scenes.push({ kind: 'outro', startFrame: cursor, dur: outroFrames })
  cursor += outroFrames

  // Suppress captions during outro
  const outroStart = cursor - outroFrames
  const outroSuppressRange: [number, number] = [outroStart, totalFrames]

  // Progress
  const progress = totalFrames > 0 ? frame / totalFrames : 0

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A1A2E' }}>
      {/* Continuous voiceover */}
      {voPath ? <Audio src={staticFile(voPath)} /> : null}

      {/* Render each scene at its timeline position */}
      {scenes.map((scene, si) => {
        if (scene.kind === 'intro') {
          return (
            <Sequence key={`intro`} from={scene.startFrame} durationInFrames={scene.dur}>
              <IntroScene
                city={city} period={period} subhead={subhead} eyebrow={eyebrow}
                citySlug={slug} marketHealthLabel={marketHealthLabel}
                medianPriceDisplay={medianPriceDisplay} durationInFrames={scene.dur}
              />
            </Sequence>
          )
        }

        if (scene.kind === 'stat') {
          const ch = chapters[scene.chIdx]
          const imgSrc = beatImageSrc(slug, imageCount, scene.chNum, ch.image_idx)
          // Source bug: fade in at 0, hold 4s, fade out
          const localFrame = frame - scene.startFrame
          const bugOp = localFrame < toFrames(4)
            ? interpolate(localFrame, [0, toFrames(1)], [0, 1], { extrapolateRight: 'clamp' })
            : localFrame < toFrames(4) + toFrames(1)
            ? interpolate(localFrame, [toFrames(4), toFrames(4) + toFrames(1)], [1, 0], { extrapolateRight: 'clamp' })
            : 0
          // Chyron: fade in 0, hold 3s, fade out
          const chyronOp = localFrame < toFrames(3)
            ? interpolate(localFrame, [0, toFrames(0.8)], [0, 1], { extrapolateRight: 'clamp' })
            : localFrame < toFrames(3) + toFrames(1)
            ? interpolate(localFrame, [toFrames(3), toFrames(3) + toFrames(1)], [1, 0], { extrapolateRight: 'clamp' })
            : 0

          return (
            <Sequence key={`stat-${scene.chIdx}`} from={scene.startFrame} durationInFrames={scene.dur}>
              <StatScene
                {...ch}
                chapterNumber={scene.chNum}
                chapterTitle={scene.titleStr}
                imageSrc={imgSrc}
                durationInFrames={scene.dur}
              />
              {/* Source citation bug */}
              {scene.source && (
                <SourceCitationBug source={scene.source} opacity={bugOp} />
              )}
              {/* Chapter chyron */}
              <ChapterChyron chapterNum={scene.chNum} title={scene.titleStr} opacity={chyronOp} />
            </Sequence>
          )
        }

        if (scene.kind === 'broll') {
          return (
            <Sequence key={`broll-${si}`} from={scene.startFrame} durationInFrames={scene.dur}>
              <BRollInterlude
                imageSrc={scene.imgSrc}
                contextText={scene.def.contextText}
                durationInFrames={scene.dur}
              />
            </Sequence>
          )
        }

        if (scene.kind === 'outro') {
          return (
            <Sequence key={`outro`} from={scene.startFrame} durationInFrames={scene.dur}>
              <OutroScene city={city} period={period} durationInFrames={scene.dur} />
            </Sequence>
          )
        }

        return null
      })}

      {/* Progress bar */}
      <ProgressBar progress={progress} />

      {/* Caption band — landscape y 940 (CAPTION_LANDSCAPE). Suppressed during outro. */}
      <KineticCaptions
        words={captionWords}
        suppressFrames={[outroSuppressRange]}
      />
    </AbsoluteFill>
  )
}
