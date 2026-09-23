'use client'

/**
 * beautifului InsightCards — paged insights with Liveline pointer-scrub
 * and an Allocation segmented bar.
 *
 * Source: https://www.beautifului.dev/r/insight-cards.json
 * Paint is navy/cream tokens only. Interaction stays: Insights pager,
 * Compare/Anomaly pointer-scrub, Allocation segment select.
 */

import { Liveline, type LivelinePoint, type LivelineSeries } from 'liveline'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import './insight-pager.css'
import './insight-cards.css'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

const formatPercent = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
const formatMoney = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`
const formatCount = (v: number) => Math.round(v).toLocaleString('en-US')

/**
 * SITE overflow fix (2026-09-23). Liveline's own value badge (`badge: true`
 * by default on a single-series card — a small pill that tracks the line's
 * tip, built as absolute-positioned DOM, not drawn on the canvas) lives in
 * the `padding.right` gutter its layout reserves:
 * `badgeLeft = w - pad.right + 8 - PAD_X - tailLen` (Liveline's own
 * constants: `PAD_X` 10, `tailLen` 5), badge width
 * `tailLen + textW + PAD_X*2`, where `textW` is a canvas `measureText` of
 * the formatted value with every digit swapped to `'8'`. Solving
 * `badgeLeft + width <= w` for `pad.right` reduces to `pad.right >= 18 +
 * textW`.
 *
 * AnomalyCard passed `right: 0` — no gutter at all — so the badge always
 * sat outside the chart's OWN box by `18 + textW`px, a DOM element the
 * canvas's self-clipping never protects against. On a wide fold that slop
 * landed in the page's own right margin and never showed; at phone widths
 * the fold has no spare margin, so it became a real horizontal scrollbar
 * (`document.documentElement.scrollWidth` > viewport width) on every route
 * that mounts this card — subdivisions, cities, neighborhoods, zips, the
 * region and cities hubs — measured on /subdivisions/keystone-terrace.
 *
 * `textW` needs a live canvas to measure exactly, which this helper does
 * not have, so it estimates from character count. `BADGE_CHAR_PX` is the
 * label font's (`11px "SF Mono", Menlo, Monaco, "Cascadia Code",
 * monospace`) measured advance width on this stack's own Chromium render —
 * 6.6226px per character, every character, because the fallback stack
 * lands on a true monospace font — plus a ~12% margin, so the estimate
 * always reserves AT LEAST as much room as the real badge will need.
 * Clamped so one freak long value cannot swallow the whole chart, and so a
 * one-digit value still gets a usable gutter.
 */
const BADGE_CHAR_PX = 7.4
const BADGE_GUTTER_BASE = 18
const MIN_BADGE_GUTTER = 32
const MAX_BADGE_GUTTER = 140

/** Exported for its regression test (components/site/__tests__). */
export function estimateBadgeGutter(labels: readonly string[]): number {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0)
  const gutter = Math.ceil(BADGE_GUTTER_BASE + longest * BADGE_CHAR_PX)
  return Math.min(MAX_BADGE_GUTTER, Math.max(MIN_BADGE_GUTTER, gutter))
}

/**
 * LIVELINE FILTERS AGAINST THE WALL CLOCK (SITE-103, and this is why every
 * Liveline on this site read "No data to display").
 *
 * The chart keeps only the points inside `[now - window, now]`, where `now` is
 * the browser's own wall clock, and the window is 42–49 SECONDS. This file used to end its
 * series at the literal `1_700_000_000` — a perfectly stable epoch, and a
 * correct hydration fix (#418: a clock read during render is a hydration
 * failure), but one that stopped being "now" in November 2023. Every card built
 * on it has been drawing an empty stage ever since the clock walked past it,
 * on /invest as well as here, under a receipt that called the control installed.
 *
 * So the clock is read ONCE, after mount, in an effect. The server and the
 * first client render agree on `null` — no hydration divergence — and the
 * canvas, which never renders on the server anyway, fills on the next frame.
 * Liveline also SNAPSHOTS its series on the first frame it sees `paused` and
 * never re-reads them, so correcting the epoch one render later is too late:
 * the stage mounts only once the real clock is in hand.
 */
export const STABLE_EPOCH = 1_700_000_000

/**
 * Exported for the route insight panels (city, subdivision): they lay their
 * own month ticks on the same clock this file's cards lay their points on.
 */
export function useChartEpoch(): number | null {
  const [epoch, setEpoch] = useState<number | null>(null)
  useEffect(() => {
    setEpoch(Date.now() / 1000)
  }, [])
  return epoch
}

function makePoints(values: number[], gap = 6, end = STABLE_EPOCH): LivelinePoint[] {
  return values.map((value, index) => ({
    time: end - (values.length - 1 - index) * gap,
    value,
  }))
}

function smooth(values: number[], perSegment = 9): number[] {
  if (values.length < 3) return values.slice()
  const out: number[] = []
  const n = values.length
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = values[Math.max(0, i - 1)]
    const p1 = values[i]
    const p2 = values[i + 1]
    const p3 = values[Math.min(n - 1, i + 2)]
    for (let s = 0; s < perSegment; s += 1) {
      const t = s / perSegment
      const t2 = t * t
      const t3 = t2 * t
      out.push(
        0.5 *
          (2 * p1 +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3),
      )
    }
  }
  out.push(values[n - 1])
  return out
}

function smoothPoints(values: number[], spanSecs: number, end: number): LivelinePoint[] {
  const dense = smooth(values)
  return makePoints(dense, spanSecs / Math.max(1, dense.length - 1), end)
}

function useInkStroke() {
  const [stroke, setStroke] = useState({ ink: 'currentColor', muted: 'currentColor' })
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement)
    const ink = cs.getPropertyValue('--v3-navy').trim() || 'currentColor'
    const cream = cs.getPropertyValue('--v3-cream').trim() || 'transparent'
    setStroke({
      ink,
      muted: cream === 'transparent' ? ink : `color-mix(in srgb, ${ink} 48%, ${cream})`,
    })
  }, [])
  return stroke
}

function chartProgressFromPointer(event: React.PointerEvent) {
  const rect = event.currentTarget.getBoundingClientRect()
  if (!(rect.width > 0)) return 0
  return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
}

function chartIndexFromPointer(event: React.PointerEvent, pointCount: number) {
  return Math.round(chartProgressFromPointer(event) * (pointCount - 1))
}

/**
 * Opt-in (SITE-103): report the scrub position as a 0–1 fraction so a caller
 * whose own figures follow the pointer can map it onto ITS series, whatever
 * density the card smoothed the line to. Absent, every card behaves exactly as
 * the catalog demo does.
 */
export type ScrubReporter = (progress: number | null) => void

/**
 * Opt-in (SITE-103): render the card's own figure face. The card still owns
 * WHICH value is shown and when; the caller owns how the digits are drawn, so a
 * sourced count can arrive as a beUI number instead of a static string.
 */
export type ValueRenderer = (value: number, formatted: string) => ReactNode

/**
 * Opt-in (SITE-103): give the demo's own time axis real labels.
 *
 * Liveline reads the x axis as clock seconds, so the demo hands it a relative
 * ramp and lets the axis print elapsed time. Our points are months, so the
 * caller passes the month names in series order and the card maps each tick
 * back onto them. Without this the only honest `formatTime` is one that returns
 * nothing, and the chart loses its x axis entirely.
 */
function tickFormatter(
  labels: readonly string[] | undefined,
  points: readonly LivelinePoint[] | undefined,
): ((t: number) => string) | undefined {
  if (!labels || labels.length < 2 || !points || points.length < 2) return undefined
  const first = points[0]?.time
  const last = points[points.length - 1]?.time
  if (first == null || last == null || last <= first) return undefined
  return (t: number) => {
    const frac = (t - first) / (last - first)
    if (frac < -0.02 || frac > 1.02) return ''
    const i = Math.round(Math.max(0, Math.min(1, frac)) * (labels.length - 1))
    return labels[i] ?? ''
  }
}

function ChartTooltip({ rows }: { rows: { label: string; value: string; color: string }[] }) {
  return (
    <div className="insight-tooltip" role="status">
      {rows.map((row) => (
        <span key={row.label} className="insight-tooltip__row">
          <span className="insight-tooltip__swatch" style={{ color: row.color }} />
          <span className="insight-tooltip__value">
            {row.label} {row.value}
          </span>
        </span>
      ))}
    </div>
  )
}

export type CompareSeries = {
  name: string
  values: number[]
  sub: string
  tone: 'red' | 'green'
  dot: string
  color: string
  tooltipColor: string
  formatValue?: (v: number) => string
}

const COMPARE_SERIES: CompareSeries[] = [
  {
    name: 'Mint Chip',
    values: [-2.9, -3.4, -3.05, -3.86, -3.52, -4.1, -3.82, -4.41],
    sub: '-$2,377.66',
    tone: 'red',
    dot: 'bg-orange',
    color: '',
    tooltipColor: '',
  },
  {
    name: 'Pistachio',
    values: [0.22, 0.58, 0.42, 0.91, 0.76, 1.08, 0.96, 1.15],
    sub: '+$617.22',
    tone: 'green',
    dot: 'bg-accent',
    color: '',
    tooltipColor: '',
  },
]

export function CompareCard({
  series = COMPARE_SERIES,
  formatTime,
  hideLegend = false,
  smoothLine = true,
  tickLabels,
  onScrubProgress,
  renderValue,
}: {
  series?: CompareSeries[]
  formatTime?: (t: number) => string
  hideLegend?: boolean
  /** Opt-in (SITE-103): x-axis faces, one per sourced point. See tickFormatter. */
  tickLabels?: readonly string[]
  /**
   * Opt-in (SITE-103). The demo smooths its line through a Catmull-Rom pass,
   * which invents ~9 points between every real one. On a marketing chart that
   * is fine; under a legend that READS the scrubbed point it publishes a price
   * nobody paid (CLAUDE.md section 0). `smoothLine={false}` plots the sourced
   * points themselves, so every value the scrubber can land on is a real one.
   */
  smoothLine?: boolean
  onScrubProgress?: ScrubReporter
  renderValue?: ValueRenderer
}) {
  const stroke = useInkStroke()
  const epoch = useChartEpoch()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const painted = useMemo(
    () =>
      series.map((s, i) => ({
        ...s,
        color: s.color || (i === 0 ? stroke.ink : stroke.muted),
        tooltipColor: s.tooltipColor || (i === 0 ? stroke.ink : stroke.muted),
      })),
    [series, stroke],
  )
  const points = useMemo(
    () =>
      painted.map((s) =>
        smoothLine
          ? smoothPoints(s.values, 42, epoch ?? STABLE_EPOCH)
          : makePoints(s.values, 42 / Math.max(1, s.values.length - 1), epoch ?? STABLE_EPOCH),
      ),
    [painted, smoothLine, epoch],
  )
  const pointCount = points[0]?.length ?? 0
  const ticks = useMemo(() => tickFormatter(tickLabels, points[0]), [tickLabels, points])
  const chartSeries: LivelineSeries[] = useMemo(
    () =>
      painted.map((s, i) => ({
        id: s.name,
        label: '',
        data: points[i] ?? [],
        value: points[i]?.at(-1)?.value ?? (s.values.at(-1) ?? 0),
        color: s.color,
      })),
    [painted, points],
  )

  return (
    <div className="insight-cards__card">
      {hideLegend ? null : (
        <div className="insight-cards__legend">
          {painted.map((s, i) => {
            // The legend reads the SCRUBBED point when the pointer is on the
            // stage, the resting last point otherwise — the same rule
            // AnomalyCard already applies to its own face. A legend frozen on
            // the last point while the line under it moves is a poster.
            const read =
              hoverIndex !== null
                ? points[i]?.[hoverIndex]?.value
                : points[i]?.at(-1)?.value
            const last = read ?? (s.values.at(-1) ?? 0)
            const format = s.formatValue ?? formatPercent
            return (
              <div key={s.name}>
                <span className="insight-cards__series-name">{s.name}</span>
                <span className="insight-cards__delta">
                  {renderValue ? renderValue(last, format(last)) : format(last)}
                </span>
                <span className="insight-cards__sub">{s.sub}</span>
              </div>
            )
          })}
        </div>
      )}
      <div
        className="insight-chart-stage"
        onPointerDown={(event) => {
          setHoverIndex(chartIndexFromPointer(event, pointCount))
          onScrubProgress?.(chartProgressFromPointer(event))
        }}
        onPointerMove={(event) => {
          setHoverIndex(chartIndexFromPointer(event, pointCount))
          onScrubProgress?.(chartProgressFromPointer(event))
        }}
        onPointerLeave={() => {
          setHoverIndex(null)
          onScrubProgress?.(null)
        }}
        onPointerCancel={() => {
          setHoverIndex(null)
          onScrubProgress?.(null)
        }}
        onPointerUp={() => {
          setHoverIndex(null)
          onScrubProgress?.(null)
        }}
      >
        {epoch == null ? null : (
          <Liveline
            data={[]}
            value={0}
            series={chartSeries}
            theme="light"
            grid={false}
            pulse={false}
            window={42}
            paused
            scrub={false}
            cursor="default"
            lineWidth={2.25}
            padding={{ top: 40, right: 0, bottom: 22, left: 0 }}
            formatValue={painted[0]?.formatValue ?? formatPercent}
            {...(ticks ? { formatTime: ticks } : formatTime ? { formatTime } : {})}
          />
        )}
        {hoverIndex !== null ? (
          <ChartTooltip
            rows={painted.map((s, i) => ({
              label: s.name,
              value: (s.formatValue ?? formatPercent)(points[i]?.[hoverIndex]?.value ?? 0),
              color: s.tooltipColor,
            }))}
          />
        ) : null}
      </div>
    </div>
  )
}

export type AnomalyData = {
  spend: number[]
  usage: number[]
}

export type AnomalyLabels = {
  spend: string
  usage: string
  title: string
  formatSpend?: (v: number) => string
  formatUsage?: (v: number) => string
  spentLine?: (value: string) => string
  vsLine?: string
}

const ANOMALY_DATA: AnomalyData = {
  spend: [274, 289, 264, 307, 331, 1210, 1718, 2112],
  usage: [18, 19, 17, 21, 22, 58, 81, 96],
}

const DEFAULT_ANOMALY_LABELS: AnomalyLabels = {
  spend: 'Spend',
  usage: 'Usage',
  title: 'High freezer spend',
}

export function AnomalyCard({
  data: anomaly = ANOMALY_DATA,
  labels,
  formatTime,
  tickLabels,
  onScrubProgress,
  onMetric,
  renderValue,
}: {
  data?: AnomalyData
  labels?: Partial<AnomalyLabels>
  formatTime?: (t: number) => string
  /** Opt-in (SITE-103): x-axis faces, one per sourced point. See tickFormatter. */
  tickLabels?: readonly string[]
  onScrubProgress?: ScrubReporter
  onMetric?: (metric: 'spend' | 'usage') => void
  renderValue?: ValueRenderer
}) {
  const stroke = useInkStroke()
  const epoch = useChartEpoch()
  const l = { ...DEFAULT_ANOMALY_LABELS, ...labels }
  const [metric, setMetric] = useState<'spend' | 'usage'>('spend')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  // GAP 7 IS THE DEMO'S EIGHT-POINT SPAN (7 x 7 = 49 = the window below).
  // A longer series at the same gap runs off the left edge of the window and
  // Liveline draws nothing at all; deriving the gap keeps ANY length on screen
  // and leaves the demo's own eight-point data byte-identical.
  const gap = 49 / Math.max(1, Math.max(anomaly.spend.length, anomaly.usage.length) - 1)
  const spend = useMemo(() => makePoints(anomaly.spend, gap, epoch ?? STABLE_EPOCH), [anomaly, gap, epoch])
  const usage = useMemo(() => makePoints(anomaly.usage, gap, epoch ?? STABLE_EPOCH), [anomaly, gap, epoch])
  const data = metric === 'spend' ? spend : usage
  const ticks = useMemo(() => tickFormatter(tickLabels, data), [tickLabels, data])
  const value = data.at(-1)?.value ?? (metric === 'spend' ? anomaly.spend.at(-1) ?? 0 : anomaly.usage.at(-1) ?? 0)
  const formatSpend = l.formatSpend ?? formatMoney
  const formatUsage = l.formatUsage ?? ((v: number) => `${Math.round(v)} kWh`)
  const format = metric === 'spend' ? formatSpend : formatUsage
  const moneyLabel = formatSpend(spend.at(-1)?.value ?? 0)
  // Sized off BOTH metrics' real faces so the badge stays inside the chart's
  // own box no matter which chip is active — see estimateBadgeGutter above.
  const badgeGutter = useMemo(
    () => estimateBadgeGutter([...anomaly.spend.map(formatSpend), ...anomaly.usage.map(formatUsage)]),
    [anomaly.spend, anomaly.usage, formatSpend, formatUsage],
  )

  return (
    <div className="insight-cards__card">
      <div className="insight-cards__row">
        <div>
          <span className="insight-cards__series-name">{l.title}</span>
          <span className="insight-cards__delta">
            {(() => {
              const face = hoverIndex !== null ? data[hoverIndex]?.value ?? 0 : value
              return renderValue ? renderValue(face, format(face)) : format(face)
            })()}
          </span>
        </div>
        <div className="insight-cards__chips">
          {(['spend', 'usage'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={metric === item}
              onClick={() => {
                setMetric(item)
                setHoverIndex(null)
                onMetric?.(item)
              }}
              className="insight-cards__metric"
            >
              {item === 'spend' ? l.spend : l.usage}
            </button>
          ))}
        </div>
      </div>
      <div
        className="insight-chart-stage"
        onPointerDown={(event) => {
          setHoverIndex(chartIndexFromPointer(event, data.length))
          onScrubProgress?.(chartProgressFromPointer(event))
        }}
        onPointerMove={(event) => {
          setHoverIndex(chartIndexFromPointer(event, data.length))
          onScrubProgress?.(chartProgressFromPointer(event))
        }}
        onPointerLeave={() => {
          setHoverIndex(null)
          onScrubProgress?.(null)
        }}
        onPointerCancel={() => {
          setHoverIndex(null)
          onScrubProgress?.(null)
        }}
        onPointerUp={() => {
          setHoverIndex(null)
          onScrubProgress?.(null)
        }}
      >
        {epoch == null ? null : (
        <Liveline
          data={data}
          value={value}
          theme="light"
          color={stroke.ink}
          grid
          scrub={false}
          fill={false}
          pulse={false}
          momentum={false}
          paused
          window={49}
          lineWidth={2.25}
          cursor="crosshair"
          padding={{ top: 34, right: badgeGutter, bottom: 22, left: 0 }}
          formatValue={format}
          {...(ticks ? { formatTime: ticks } : formatTime ? { formatTime } : {})}
        />
        )}
        {hoverIndex !== null ? (
          <ChartTooltip
            rows={[{ label: metric === 'spend' ? l.spend : l.usage, value: format(data[hoverIndex]?.value ?? 0), color: stroke.ink }]}
          />
        ) : null}
      </div>
      <p className="insight-cards__note">
        {l.spentLine ? l.spentLine(moneyLabel) : `${moneyLabel} spent`}
        {/* An EXPLICIT empty vsLine means the caller's own sentence is
            complete. Only an omitted one falls back to the demo's clause
            (SITE-103: `vsLine: ''` printed "vs 3 months" on a market page). */}
        {l.vsLine === undefined ? ' vs 3 months' : l.vsLine ? ` ${l.vsLine}` : ''}
      </p>
    </div>
  )
}

export type AllocationSegment = {
  name: string
  label: string
  pct: number
  amount: string
  cls: string
  tone: string
}

const ALLOCATION_SEGMENTS: AllocationSegment[] = [
  { name: 'VAN', label: 'Vanilla', pct: 72.5, amount: '$51,785', cls: 'insight-cards__alloc-seg--0', tone: '' },
  { name: 'CHOC', label: 'Chocolate', pct: 22.8, amount: '$16,278', cls: 'insight-cards__alloc-seg--1', tone: '' },
  { name: 'MINT', label: 'Mint', pct: 4.7, amount: '$3,357', cls: 'insight-cards__alloc-seg--2', tone: '' },
]

export function AllocationCard({
  segments = ALLOCATION_SEGMENTS,
  note,
  onSelect,
  renderAmount,
}: {
  segments?: AllocationSegment[]
  note?: string
  onSelect?: (segment: AllocationSegment) => void
  renderAmount?: (segment: AllocationSegment) => ReactNode
}) {
  const [selected, setSelected] = useState(segments[0]?.name ?? '')
  const active = segments.find((segment) => segment.name === selected) ?? segments[0]
  const pick = (segment: AllocationSegment) => {
    setSelected(segment.name)
    onSelect?.(segment)
  }
  if (!active) return null

  return (
    <div className="insight-cards__card">
      <span className="insight-cards__series-name">{active.label}</span>
      <span className="insight-cards__hero">
        {renderAmount ? renderAmount(active) : active.amount}
      </span>
      <div className="insight-cards__alloc-track" role="group" aria-label="Allocation segments">
        {segments.map((s, i) => (
          <button
            key={s.name}
            type="button"
            aria-pressed={selected === s.name}
            aria-label={`${s.label}: ${s.pct}%`}
            onClick={() => pick(s)}
            className={cn('insight-cards__alloc-seg', s.cls || `insight-cards__alloc-seg--${i}`)}
            style={{ width: `${s.pct}%`, transitionTimingFunction: EASE }}
          >
            <span className="insight-cards__alloc-shine" />
          </button>
        ))}
      </div>
      <div className="insight-cards__chips">
        {segments.map((s) => (
          <button
            key={s.name}
            type="button"
            aria-pressed={selected === s.name}
            onClick={() => pick(s)}
            className="insight-cards__chip"
          >
            {s.name} {s.pct}%
          </button>
        ))}
      </div>
      <p className="insight-cards__note">
        {note ??
          `${active.label} contribution snapshot across current inventory value. Segment selection changes the inspected group without moving the card.`}
      </p>
    </div>
  )
}

export type InsightPage = {
  key: string
  prose: ReactNode
  Card: React.ComponentType
  pill: string
  /**
   * Opt-in (SITE-103): make the pill a real door. The demo's pill is a prompt
   * back to its own agent, which on a public page is a control that does
   * nothing. With an href the same pill navigates; without one it is the
   * catalog button, unchanged.
   */
  pillHref?: string
}

const PAGES: InsightPage[] = [
  {
    key: 'compare',
    prose: (
      <>
        The worst performer in your case is Rocky Road — down -6% or -$2,453.44.
      </>
    ),
    Card: CompareCard,
    pill: 'Should I rebalance flavors?',
  },
  {
    key: 'anomaly',
    prose: <>Unusually high freezer bill on Dec 13 — +$1,834.66 above your average.</>,
    Card: AnomalyCard,
    pill: 'Get tips on cutting freezer costs',
  },
  {
    key: 'allocation',
    prose: (
      <>
        You are heavily invested in Vanilla — it is 72.5% of your case.
      </>
    ),
    Card: AllocationCard,
    pill: 'If we look at seasonals, what changes?',
  },
]

export type InsightCardsLabels = {
  title: string
}

const DEFAULT_INSIGHT_LABELS: InsightCardsLabels = {
  title: 'Insights',
}

export default function InsightCards({
  pages = PAGES,
  labels,
}: {
  variant?: string
  pages?: InsightPage[]
  labels?: Partial<InsightCardsLabels>
} = {}) {
  const l = { ...DEFAULT_INSIGHT_LABELS, ...labels }
  const [page, setPage] = useState(0)
  if (pages.length === 0) return null
  const safe = Math.max(0, Math.min(pages.length - 1, page))
  const move = (direction: -1 | 1) => {
    setPage((current) => (current + direction + pages.length) % pages.length)
  }
  const { prose, Card, pill, pillHref } = pages[safe]

  return (
    <div className="insight-cards">
      <div className="insight-pager insight-cards__head" role="group" aria-label={`${l.title} pages`}>
        <span className="insight-pager__face insight-cards__face">
          <span className="insight-pager__title insight-cards__title">{l.title}</span>
          <span className="insight-pager__count insight-cards__count tabular-nums">{pages.length}</span>
        </span>
        <span className="insight-pager__controls">
          {(['M15 18l-6-6 6-6', 'M9 6l6 6-6 6'] as const).map((d, i) => (
            <button
              key={d}
              type="button"
              className="insight-pager__btn"
              aria-label={i === 0 ? 'Previous insight' : 'Next insight'}
              onClick={() => move(i === 0 ? -1 : 1)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={d} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </span>
      </div>
      <p className="insight-cards__prose">{prose}</p>
      <Card />
      {pillHref ? (
        <a href={pillHref} className="insight-cards__pill">
          {pill}
        </a>
      ) : (
        <button type="button" className="insight-cards__pill">
          {pill}
        </button>
      )}
    </div>
  )
}
