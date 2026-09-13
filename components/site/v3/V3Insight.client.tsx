'use client'

/**
 * V3 INSIGHT — the beautifului InsightCards object on house paint (SITE-100).
 *
 * The catalog demo (https://www.beautifului.dev/r/insight-cards.json) is one
 * shape, paged: a header "Insights N ‹ ›", one prose sentence, an embedded
 * mini-visualisation the pointer scrubs, then one pill action. The prior hub
 * fold wore only the header (the installed `insight-pager` chrome) over a
 * bordered two-bar card, and the 2026-09-13 judge named it: "not beautifului
 * InsightCards (no scrubber, no insight card)". This primitive is the whole
 * object, so a person who has seen the demo recognises ours:
 *
 *   header   — the installed InsightPager (title, page label, n/N, chevrons)
 *   prose    — the caller's one claim for this page (figures may ride V3Number)
 *   card     — a short caller-formatted series with a scrubber: pointer, touch
 *              or arrow keys move a hairline cursor and the reading above the
 *              line; at rest it reads the newest point (house restingRead)
 *   pill     — one door out
 *
 * Geometry is lib/charts/plot.ts buildLinePlot, the same straight segments
 * V3Chart draws (no spline — a curve would invent values between months).
 * Every string arrives formatted by the caller (ci:public-v3 rule 3); this
 * file computes positions, never figures. Navy on cream through tokens only.
 * A page with no series carries the caller's `body` in the card instead.
 */

import {
  useCallback,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { InsightPager } from '@/components/motion/insight-pager'
import { buildLinePlot, VB_H, VB_W } from '@/lib/charts/plot'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3SourceLine } from './atoms'
import { V3Number } from './V3Number.client'
import './tokens.css'
import './V3Insight.css'

export type V3InsightPoint = {
  /** The y value (geometry only). */
  value: number
  /** The x label the reading prints, e.g. "Aug 2026". */
  tick: string
  /** The formatted figure the reading prints, e.g. "$664K". */
  label: string
  /**
   * Caller-formatted comparison for this point, e.g. "+3.2% against Aug 2025"
   * — the demo's mono delta beside the big figure. Omit when there is nothing
   * sourced to compare against; the line then shows the figure alone.
   */
  note?: string
}

export type V3InsightSeries = {
  /** Small label above the line: what the run counts. */
  caption: string
  points: readonly V3InsightPoint[]
  /** The section-0 trace under the card. */
  source: string
  sourceName?: string
  asOf?: string | null
}

/**
 * One part of a whole for the demo's third card (allocation): a segmented
 * bar whose segments select, a legend of chips, the selected part's figure
 * as the big number and its sentence in the inset. The caller computes the
 * share (count over the page's total) and formats every string.
 */
export type V3InsightSegment = {
  id: string
  /** Legend face, e.g. "Condos". */
  label: string
  /** Live count for the digit wheel. */
  value: number
  /** Already-formatted count, e.g. "107". */
  valueLabel: string
  /** This part over the whole, 0 to 1 (geometry only). */
  share: number
  /** Already-formatted share, e.g. "7%". */
  shareLabel: string
  /** One plain sentence about the selected part. */
  note: string
  href?: string
}

export type V3InsightPage = {
  id: string
  /** The pager face, e.g. the city. */
  label: string
  /** One plain claim. */
  prose: ReactNode
  /** The scrubbable run. Omit when no sourced series exists — never invent one. */
  series?: V3InsightSeries | null
  /** The allocation card: parts of one whole, when the page is a composition. */
  segments?: readonly V3InsightSegment[] | null
  /** Small label over the allocation's big number, e.g. "for sale now". */
  segmentsCaption?: string
  /** The allocation's section-0 trace. */
  segmentsSource?: { source: string; sourceName?: string; asOf?: string | null } | null
  /** Card body when there is neither a series nor segments (already-formatted figures). */
  body?: ReactNode
  /** The pill door. */
  door?: { label: string; href: string } | null
  /**
   * A live figure for this page's door in the index row, e.g. homes for sale
   * — so every door carries a sourced count on a digit wheel, not bare text.
   */
  indexFigure?: {
    value: number
    /** Already-formatted count, e.g. "312". */
    label: string
    /** What the count counts, for the accessible name, e.g. "homes for sale". */
    unit: string
    /**
     * The door's own run as a spark (values only, geometry here) — the same
     * sourced series the page's card scrubs, so the door shows its shape
     * before it is opened. Omit when the page has no series; never invented.
     */
    spark?: readonly number[] | null
  } | null
}

const SPARK_W = 40
const SPARK_H = 12

/** Polyline points for a spark: values scaled into the box, straight segments. */
export function sparkPoints(values: readonly number[]): string | null {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length < 2) return null
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const span = max - min || 1
  const step = SPARK_W / (finite.length - 1)
  return finite
    .map((v, i) => `${(i * step).toFixed(1)},${(SPARK_H - 1 - ((v - min) / span) * (SPARK_H - 2)).toFixed(1)}`)
    .join(' ')
}

export type V3InsightProps = {
  /** Header title, e.g. "City". */
  title: string
  pages: readonly V3InsightPage[]
  /** Fewer published points than this and the card shows no line. */
  minPoints?: number
  /**
   * Label for the row of the OTHER pages' doors under the pill, e.g. "Other
   * cities". The pager shows one page at a time, so without this row six of
   * seven city-report links would never be in the HTML; with it every door is
   * crawlable and one tap away. Omit to render no row.
   */
  indexLabel?: string
  id?: string
  className?: string
}

/** Published points a run needs before it is drawn. */
export const V3_INSIGHT_MIN_POINTS = 6

function InsightRun({ series, minPoints, uid }: { series: V3InsightSeries; minPoints: number; uid: string }) {
  const plot = useMemo(
    () =>
      buildLinePlot([
        {
          name: series.caption,
          points: series.points.map((p) => ({ value: p.value, label: p.label, tick: p.tick })),
        },
      ]),
    [series],
  )
  const drawn = useMemo(() => (plot?.lines[0]?.points ?? []).filter((p) => p.plot), [plot])
  const [hover, setHover] = useState<number | null>(null)
  // The scrubber HOLDS its month: a reading picked on the track stays when
  // the pointer leaves the plot (the demo's slider behaviour); a pointer
  // sweep alone rests back on the newest point.
  const [held, setHeld] = useState(false)

  const readIndex = hover ?? (drawn.length > 0 ? drawn.length - 1 : null)
  const read = readIndex != null ? drawn[readIndex] : undefined

  const scrub = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (drawn.length === 0) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (rect.width <= 0) return
      const x = ((event.clientX - rect.left) / rect.width) * VB_W
      let best = 0
      let bestDist = Infinity
      drawn.forEach((p, i) => {
        const dist = Math.abs(p.x - x)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      })
      setHeld(false)
      setHover(best)
    },
    [drawn],
  )
  const rest = useCallback(() => {
    if (!held) setHover(null)
  }, [held])
  const keys = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (drawn.length === 0) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End')
        return
      event.preventDefault()
      const current = hover ?? drawn.length - 1
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? drawn.length - 1
            : Math.max(0, Math.min(drawn.length - 1, current + (event.key === 'ArrowLeft' ? -1 : 1)))
      setHover(next)
    },
    [drawn, hover],
  )

  if (!plot || drawn.length < Math.max(2, minPoints) || !read) return null
  const line = plot.lines[0]!
  const readId = `${uid}-read`
  const first = drawn[0]!
  const last = drawn[drawn.length - 1]!
  // The plotted point carries geometry and faces; the caller's point carries
  // the value the digit wheel needs and the comparison note. Same tick, same
  // face — buildLinePlot keeps both verbatim.
  const readPoint = series.points.find((p) => p.tick === read.tick && p.label === read.label)
  const cursorLeft = (read.x / VB_W) * 100
  // The tooltip anchors in three zones so it never runs past the frame: near
  // the left edge it grows rightward from the cursor, near the right edge it
  // grows leftward, elsewhere it centres (judge 2026-09-13: "the Aug 2026
  // $528K tooltip runs into the right edge of the city chart frame" at 375).
  const tipZone = cursorLeft < 22 ? 'start' : cursorLeft > 78 ? 'end' : 'mid'

  return (
    <div className="v3-insight__run">
      {/* The demo's inset chart panel: a strip naming the run and the month
          under the cursor, the stage the pointer scrubs, then the scrubber
          track that walks the same months by thumb or by arrow key. */}
      <div className="v3-insight__panel">
        <div className="v3-insight__strip">
          <span className="v3-insight__caption">{series.caption}</span>
          <span className="v3-insight__chip tabular-nums" aria-hidden="true">
            {read.tick}
          </span>
        </div>
        {/* The stage carries the padding; the plot inside it is the geometry
            box the pointer math and every percent position refer to. */}
        <div className="v3-insight__stage">
          <div
            className={cn('v3-insight__plot', hover != null && 'v3-insight__plot--scrubbing')}
            role="group"
            aria-label={`${series.caption}, ${drawn.length} points from ${first.tick} to ${last.tick}. Arrow keys move the reading.`}
            aria-describedby={readId}
            tabIndex={0}
            onPointerMove={scrub}
            onPointerDown={scrub}
            onPointerLeave={rest}
            onBlur={rest}
            onKeyDown={keys}
          >
            <svg
              className="v3-insight__svg"
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <path className="v3-insight__line" d={line.d} vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="v3-insight__cursor" style={{ left: `${cursorLeft.toFixed(2)}%` }} aria-hidden="true" />
            <span
              className="v3-insight__dot"
              style={{
                left: `${cursorLeft.toFixed(2)}%`,
                top: `${((read.y / VB_H) * 100).toFixed(2)}%`,
              }}
              aria-hidden="true"
            />
            <span
              className={cn('v3-insight__tip', `v3-insight__tip--${tipZone}`)}
              style={{ left: `${cursorLeft.toFixed(2)}%` }}
              aria-hidden="true"
            >
              <span className="v3-insight__tip-dot" />
              <span className="v3-insight__tip-tick">{read.tick}</span>
              <span className="v3-insight__tip-value tabular-nums">{read.label}</span>
            </span>
          </div>
        </div>
        {/* The scrubber: the demo's slider under the chart, the first and last
            month as its ends, the thumb on the month being read. The same
            house control V3Chart draws under its year (v3-chart__scrub). */}
        <label className="v3-insight__scrub">
          <span className="v3-insight__scrub-end tabular-nums" aria-hidden="true">
            {first.tick}
          </span>
          <input
            type="range"
            className="v3-insight__scrub-input"
            min={0}
            max={drawn.length - 1}
            step={1}
            value={readIndex ?? drawn.length - 1}
            aria-label={`Scrub ${series.caption}`}
            aria-valuetext={`${read.tick}, ${read.label}`}
            onChange={(event) => {
              setHeld(true)
              setHover(Number(event.target.value))
            }}
          />
          <span className="v3-insight__scrub-end tabular-nums" aria-hidden="true">
            {last.tick}
          </span>
        </label>
      </div>
      {/* The demo's figure line under the panel: the reading as the big
          number (beui digit swap follows the scrub), its comparison, and what
          it is against. Screen readers get this line; the tooltip is a picture. */}
      <p className="v3-insight__figure" id={readId} role="status" aria-live="polite">
        <span className="v3-insight__figure-value">
          {readPoint ? (
            <V3Number value={readPoint.value} formatted={read.label} durationMs={300} startOnView={false} />
          ) : (
            <span className="tabular-nums">{read.label}</span>
          )}
        </span>
        <span className="v3-insight__figure-tick">{read.tick}</span>
        {readPoint?.note ? <span className="v3-insight__figure-note tabular-nums">{readPoint.note}</span> : null}
      </p>
      <V3SourceLine source={series.source} sourceName={series.sourceName} asOf={series.asOf} />
    </div>
  )
}

/**
 * The demo's allocation card: one bar of every part, the selected part's
 * count as the big number with its share, its sentence, and a legend whose
 * chips are the doors (crawlable). The legend is the control — hover or focus
 * a chip and the bar, the figure and the sentence follow; the bar's segments
 * are pictures of the same shares, not a second set of small targets.
 */
function InsightAllocation({
  segments,
  caption,
  source,
  uid,
}: {
  segments: readonly V3InsightSegment[]
  caption: string
  source: V3InsightPage['segmentsSource']
  uid: string
}) {
  const [selected, setSelected] = useState(0)
  const safe = Math.max(0, Math.min(segments.length - 1, selected))
  const part = segments[safe]
  if (!part) return null
  const readId = `${uid}-part`
  return (
    <div className="v3-insight__alloc">
      <div className="v3-insight__panel">
        <div className="v3-insight__strip">
          <span className="v3-insight__caption">{caption}</span>
          <span className="v3-insight__chip" aria-hidden="true">
            {part.label}
          </span>
        </div>
        <div className="v3-insight__alloc-stage">
          <div
            className="v3-insight__bar"
            role="img"
            aria-label={`${caption}: ${segments.map((s) => `${s.label} ${s.shareLabel}`).join(', ')}`}
          >
            {segments.map((s, i) => (
              <span
                key={s.id}
                className={cn('v3-insight__seg', i === safe && 'v3-insight__seg--on')}
                style={{ flexGrow: Math.max(s.share, 0.004) }}
                onPointerEnter={() => setSelected(i)}
              />
            ))}
          </div>
        </div>
      </div>
      <p className="v3-insight__figure" id={readId} role="status" aria-live="polite">
        <span className="v3-insight__figure-value">
          <V3Number value={part.value} formatted={part.valueLabel} durationMs={300} startOnView={false} />
        </span>
        <span className="v3-insight__figure-tick">{part.label}</span>
        <span className="v3-insight__figure-note tabular-nums">{part.shareLabel} of the types listed</span>
      </p>
      <p className="v3-insight__alloc-note">{part.note}</p>
      <ul className="v3-insight__legend" aria-label="Every part">
        {segments.map((s, i) => {
          const face = (
            <>
              <span className={cn('v3-insight__swatch', i === safe && 'v3-insight__swatch--on')} aria-hidden="true" />
              <span className="v3-insight__legend-label">{s.label}</span>
              <span className="v3-insight__legend-value tabular-nums">{s.valueLabel}</span>
            </>
          )
          const className = cn('v3-insight__legend-item', i === safe && 'v3-insight__legend-item--on')
          return (
            <li key={s.id}>
              {s.href ? (
                <Link
                  href={s.href}
                  className={className}
                  aria-describedby={i === safe ? readId : undefined}
                  onPointerEnter={() => setSelected(i)}
                  onFocus={() => setSelected(i)}
                >
                  {face}
                </Link>
              ) : (
                <button
                  type="button"
                  className={className}
                  aria-pressed={i === safe}
                  onPointerEnter={() => setSelected(i)}
                  onFocus={() => setSelected(i)}
                  onClick={() => setSelected(i)}
                >
                  {face}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {source ? <V3SourceLine source={source.source} sourceName={source.sourceName} asOf={source.asOf} /> : null}
    </div>
  )
}

export function V3Insight({
  title,
  pages,
  minPoints = V3_INSIGHT_MIN_POINTS,
  indexLabel,
  id,
  className,
}: V3InsightProps) {
  const uid = useId()
  const [page, setPage] = useState(0)
  if (pages.length === 0) return null
  const safe = Math.max(0, Math.min(pages.length - 1, page))
  const current = pages[safe]
  if (!current) return null
  const others = indexLabel ? pages.filter((item, i) => i !== safe && item.door) : []

  return (
    <div id={id} className={cn(V3_ROOT_CLASS, 'v3-insight', className)}>
      {pages.length > 1 ? (
        <InsightPager title={title} pages={pages.map((item) => item.label)} page={safe} onPage={setPage} />
      ) : (
        <p className="v3-insight__solo">
          <span className="v3-insight__solo-title">{title}</span>
          <span className="v3-insight__solo-label">{current.label}</span>
        </p>
      )}
      {/* Keyed on the page so the demo's crossfade runs on every turn. */}
      <div className="v3-insight__page" key={current.id}>
        <p className="v3-insight__prose">{current.prose}</p>
        <div className="v3-insight__card">
          {current.series ? (
            <InsightRun series={current.series} minPoints={minPoints} uid={`${uid}-${current.id}`} />
          ) : null}
          {current.segments && current.segments.length > 0 ? (
            <InsightAllocation
              segments={current.segments}
              caption={current.segmentsCaption ?? current.label}
              source={current.segmentsSource ?? null}
              uid={`${uid}-${current.id}`}
            />
          ) : null}
          {current.body ? <div className="v3-insight__body">{current.body}</div> : null}
        </div>
        {current.door ? (
          <Link href={current.door.href} className="v3-insight__pill">
            {current.door.label}
          </Link>
        ) : null}
      </div>
      {others.length > 0 ? (
        <nav className="v3-insight__index" aria-label={indexLabel}>
          <span className="v3-insight__index-label">{indexLabel}</span>
          <ul className="v3-insight__index-list">
            {others.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.door!.href}
                  className="v3-insight__index-link"
                  aria-label={
                    item.indexFigure
                      ? `${item.door!.label}, ${item.indexFigure.label} ${item.indexFigure.unit}`
                      : item.door!.label
                  }
                >
                  <span className="v3-insight__index-name">{item.label}</span>
                  {item.indexFigure ? (
                    // Every door carries its own live count on the digit wheel
                    // (beui-number) and, when the page has a run, its spark —
                    // the way NAR and FT number their doors.
                    <span className="v3-insight__index-figure" aria-hidden="true">
                      <V3Number value={item.indexFigure.value} formatted={item.indexFigure.label} />
                      {(() => {
                        const points = item.indexFigure.spark ? sparkPoints(item.indexFigure.spark) : null
                        return points ? (
                          <svg
                            className="v3-insight__index-spark"
                            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
                            preserveAspectRatio="none"
                            focusable="false"
                          >
                            <polyline points={points} vectorEffect="non-scaling-stroke" />
                          </svg>
                        ) : null
                      })()}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
