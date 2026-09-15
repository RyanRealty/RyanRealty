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

function makePoints(values: number[], gap = 6): LivelinePoint[] {
  // Fixed epoch: demo scrub times are relative. Live clocks in render
  // (incl. useMemo) fail ci:hydration-safety (#418).
  const end = 1_700_000_000
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

function smoothPoints(values: number[], spanSecs: number): LivelinePoint[] {
  const dense = smooth(values)
  return makePoints(dense, spanSecs / Math.max(1, dense.length - 1))
}

function pointsInWindow(values: number[], spanSecs: number, end: number): LivelinePoint[] {
  const dense = smooth(values)
  const gap = spanSecs / Math.max(1, dense.length - 1)
  return dense.map((value, index) => ({
    time: end - (dense.length - 1 - index) * gap,
    value,
  }))
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

function chartIndexFromPointer(event: React.PointerEvent, pointCount: number) {
  const rect = event.currentTarget.getBoundingClientRect()
  const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  return Math.round(progress * (pointCount - 1))
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
  windowSecs = 42,
}: {
  series?: CompareSeries[]
  formatTime?: (t: number) => string
  hideLegend?: boolean
  windowSecs?: number
}) {
  const stroke = useInkStroke()
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
  const [points, setPoints] = useState<LivelinePoint[][]>(() => painted.map(() => []))
  useEffect(() => {
    // Liveline windows around wall-clock now. Fixed-epoch points (1.7e9) fall
    // outside that window and paint "No data to display" — the cream pager.
    // Clock reads stay in useEffect (ci:hydration-safety).
    const end = Date.now() / 1000
    setPoints(painted.map((s) => pointsInWindow(s.values, windowSecs, end)))
  }, [painted, windowSecs])
  const pointCount = points[0]?.length ?? 0
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
  const primary = points[0] ?? []

  return (
    <div className="insight-cards__card">
      {hideLegend ? null : (
        <div className="insight-cards__legend">
          {painted.map((s, i) => {
            const last = points[i]?.at(-1)?.value ?? (s.values.at(-1) ?? 0)
            const format = s.formatValue ?? formatPercent
            return (
              <div key={s.name}>
                <span className="insight-cards__series-name">{s.name}</span>
                <span className="insight-cards__delta">{format(last)}</span>
                <span className="insight-cards__sub">{s.sub}</span>
              </div>
            )
          })}
        </div>
      )}
      <div
        className="insight-chart-stage"
        onPointerDown={(event) => setHoverIndex(chartIndexFromPointer(event, pointCount))}
        onPointerMove={(event) => setHoverIndex(chartIndexFromPointer(event, pointCount))}
        onPointerLeave={() => setHoverIndex(null)}
        onPointerCancel={() => setHoverIndex(null)}
        onPointerUp={() => setHoverIndex(null)}
      >
        <Liveline
          data={primary}
          value={primary.at(-1)?.value ?? 0}
          series={chartSeries}
          theme="light"
          grid={false}
          pulse={false}
          window={windowSecs}
          paused
          scrub={false}
          cursor="default"
          lineWidth={2.25}
          padding={{ top: 40, right: 0, bottom: 22, left: 0 }}
          formatValue={painted[0]?.formatValue ?? formatPercent}
          {...(formatTime ? { formatTime } : {})}
        />
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
}: {
  data?: AnomalyData
  labels?: Partial<AnomalyLabels>
  formatTime?: (t: number) => string
}) {
  const stroke = useInkStroke()
  const l = { ...DEFAULT_ANOMALY_LABELS, ...labels }
  const [metric, setMetric] = useState<'spend' | 'usage'>('spend')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const spend = useMemo(() => makePoints(anomaly.spend, 7), [anomaly])
  const usage = useMemo(() => makePoints(anomaly.usage, 7), [anomaly])
  const data = metric === 'spend' ? spend : usage
  const value = data.at(-1)?.value ?? (metric === 'spend' ? anomaly.spend.at(-1) ?? 0 : anomaly.usage.at(-1) ?? 0)
  const formatSpend = l.formatSpend ?? formatMoney
  const formatUsage = l.formatUsage ?? ((v: number) => `${Math.round(v)} kWh`)
  const format = metric === 'spend' ? formatSpend : formatUsage
  const moneyLabel = formatSpend(spend.at(-1)?.value ?? 0)

  return (
    <div className="insight-cards__card">
      <div className="insight-cards__row">
        <div>
          <span className="insight-cards__series-name">{l.title}</span>
          <span className="insight-cards__delta">
            {hoverIndex !== null ? format(data[hoverIndex]?.value ?? 0) : format(value)}
          </span>
        </div>
        <div className="insight-cards__chips">
          {(['spend', 'usage'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={metric === item}
              onClick={() => setMetric(item)}
              className="insight-cards__metric"
            >
              {item === 'spend' ? l.spend : l.usage}
            </button>
          ))}
        </div>
      </div>
      <div
        className="insight-chart-stage"
        onPointerDown={(event) => setHoverIndex(chartIndexFromPointer(event, data.length))}
        onPointerMove={(event) => setHoverIndex(chartIndexFromPointer(event, data.length))}
        onPointerLeave={() => setHoverIndex(null)}
        onPointerCancel={() => setHoverIndex(null)}
        onPointerUp={() => setHoverIndex(null)}
      >
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
          padding={{ top: 34, right: 0, bottom: 22, left: 0 }}
          formatValue={format}
          {...(formatTime ? { formatTime } : {})}
        />
        {hoverIndex !== null ? (
          <ChartTooltip
            rows={[{ label: metric === 'spend' ? l.spend : l.usage, value: format(data[hoverIndex]?.value ?? 0), color: stroke.ink }]}
          />
        ) : null}
      </div>
      <p className="insight-cards__note">
        {l.spentLine ? l.spentLine(moneyLabel) : `${moneyLabel} spent`}
        {l.vsLine ? ` ${l.vsLine}` : ' vs 3 months'}
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
}: {
  segments?: AllocationSegment[]
  note?: string
}) {
  const [selected, setSelected] = useState(segments[0]?.name ?? '')
  const active = segments.find((segment) => segment.name === selected) ?? segments[0]
  if (!active) return null

  return (
    <div className="insight-cards__card">
      <span className="insight-cards__series-name">{active.label}</span>
      <span className="insight-cards__hero">{active.amount}</span>
      <div className="insight-cards__alloc-track" role="group" aria-label="Allocation segments">
        {segments.map((s, i) => (
          <button
            key={s.name}
            type="button"
            aria-pressed={selected === s.name}
            aria-label={`${s.label}: ${s.pct}%`}
            onClick={() => setSelected(s.name)}
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
            onClick={() => setSelected(s.name)}
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
  const { prose, Card, pill } = pages[safe]

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
      <button type="button" className="insight-cards__pill">
        {pill}
      </button>
    </div>
  )
}
