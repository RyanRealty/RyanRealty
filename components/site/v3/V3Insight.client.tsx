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
import './tokens.css'
import './V3Insight.css'

export type V3InsightPoint = {
  /** The y value (geometry only). */
  value: number
  /** The x label the reading prints, e.g. "Aug 2026". */
  tick: string
  /** The formatted figure the reading prints, e.g. "$664K". */
  label: string
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

export type V3InsightPage = {
  id: string
  /** The pager face, e.g. the city. */
  label: string
  /** One plain claim. */
  prose: ReactNode
  /** The scrubbable run. Omit when no sourced series exists — never invent one. */
  series?: V3InsightSeries | null
  /** Card body when there is no series (already-formatted figures). */
  body?: ReactNode
  /** The pill door. */
  door?: { label: string; href: string } | null
}

export type V3InsightProps = {
  /** Header title, e.g. "City". */
  title: string
  pages: readonly V3InsightPage[]
  /** Fewer published points than this and the card shows no line. */
  minPoints?: number
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
      setHover(best)
    },
    [drawn],
  )
  const rest = useCallback(() => setHover(null), [])
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

  return (
    <div className="v3-insight__run">
      <p className="v3-insight__caption">{series.caption}</p>
      <p className="v3-insight__read" id={readId} role="status" aria-live="polite">
        <span className="v3-insight__read-tick">{read.tick}</span>
        <span className="v3-insight__read-value tabular-nums">{read.label}</span>
      </p>
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
        <span
          className="v3-insight__cursor"
          style={{ left: `${((read.x / VB_W) * 100).toFixed(2)}%` }}
          aria-hidden="true"
        />
        <span
          className="v3-insight__dot"
          style={{
            left: `${((read.x / VB_W) * 100).toFixed(2)}%`,
            top: `${((read.y / VB_H) * 100).toFixed(2)}%`,
          }}
          aria-hidden="true"
        />
      </div>
      <p className="v3-insight__ends" aria-hidden="true">
        <span>{first.tick}</span>
        <span>{last.tick}</span>
      </p>
      <V3SourceLine source={series.source} sourceName={series.sourceName} asOf={series.asOf} />
    </div>
  )
}

export function V3Insight({ title, pages, minPoints = V3_INSIGHT_MIN_POINTS, id, className }: V3InsightProps) {
  const uid = useId()
  const [page, setPage] = useState(0)
  if (pages.length === 0) return null
  const safe = Math.max(0, Math.min(pages.length - 1, page))
  const current = pages[safe]
  if (!current) return null

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
          {current.body ? <div className="v3-insight__body">{current.body}</div> : null}
        </div>
        {current.door ? (
          <Link href={current.door.href} className="v3-insight__pill">
            {current.door.label}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
