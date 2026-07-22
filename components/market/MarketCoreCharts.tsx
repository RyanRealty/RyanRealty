'use client'

/**
 * MarketCoreCharts — THE tabbed core-chart module. Market data embeds are one
 * chart or zero charts: a handful of fast, cache-fed series (median price,
 * inventory, days on market, months of supply, price cuts, closed sales), one
 * per tab, one component used everywhere (city page, community page, listing
 * detail market context).
 *
 * Contract:
 *   - Server-data-in / client-render: the page fetches getCoreChartSeries and
 *     passes the payload; this component never fetches.
 *   - A tab with no chartable series is OMITTED (never an empty chart); with
 *     zero chartable tabs the module renders nothing.
 *   - Design tokens only (navy primary strokes, muted grid, card surface) so
 *     it reads correctly on cream pages and inside navy KB sections alike.
 *   - Tabular numerals on every numeric surface; respects
 *     prefers-reduced-motion (chart draw animation off).
 *   - Every tab carries its §0 trace (source + period) in the fine print.
 */

import { useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { CoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import { buildCoreChartTabs, formatCoreChartAxis, formatCoreChartValue, type CoreChartTab } from './core-charts'

export type MarketCoreChartsProps = {
  data: CoreChartSeries | null
  /** Optional heading above the tabs. Sentence case. */
  heading?: string
  /**
   * Names the geography charted when it differs from the page subject (e.g. a
   * sparse community falling back to its parent city). Rendered next to the
   * heading so a city series is never read as the community's. (§0)
   */
  scopeLabel?: string
  className?: string
}

const CHART_HEIGHT = 232
const STROKE = 'var(--primary)'
const GRID = 'var(--border)'
const TICK = { fontSize: 11, fill: 'var(--muted-foreground)' } as const

function usePrefersReducedMotion(): boolean {
  // Lazy init on the client; SSR markup carries no animation state.
  const [reduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  return reduced
}

function ChartForTab({
  tab,
  animate,
  ...sized
}: {
  tab: CoreChartTab
  animate: boolean
  /** Injected by ResponsiveContainer via cloneElement. */
  width?: number
  height?: number
}) {
  const common = {
    ...sized,
    data: tab.rows,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  }
  const tooltipProps = {
    formatter: (v: number | string) =>
      [formatCoreChartValue(tab.metric, typeof v === 'number' ? v : Number(v)), tab.tabLabel] as [string, string],
    labelFormatter: (_label: unknown, payload: ReadonlyArray<{ payload?: { fullLabel?: string } }>) =>
      payload?.[0]?.payload?.fullLabel ?? '',
    contentStyle: {
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      color: 'var(--foreground)',
      fontSize: 12,
      fontVariantNumeric: 'tabular-nums',
    },
    cursor: { stroke: GRID },
  }
  // A keyed ARRAY, not a fragment: recharts 2.x resolves XAxis/YAxis/Grid by
  // walking React.Children, which flattens arrays but NOT fragments — inside a
  // fragment all three silently vanish (no grid, no axis labels).
  const axes = [
    <CartesianGrid key="grid" stroke={GRID} strokeDasharray="3 3" vertical={false} />,
    <XAxis
      key="x"
      dataKey="label"
      tick={TICK}
      tickLine={false}
      axisLine={{ stroke: GRID }}
      minTickGap={32}
      interval="preserveStartEnd"
    />,
    <YAxis
      key="y"
      tick={TICK}
      tickLine={false}
      axisLine={false}
      width={46}
      domain={['auto', 'auto']}
      tickFormatter={(v: number) => formatCoreChartAxis(tab.metric, v)}
    />,
  ]
  if (tab.kind === 'bar') {
    return (
      <BarChart {...common}>
        {axes}
        <Tooltip {...tooltipProps} />
        <Bar dataKey="value" fill={STROKE} fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={animate} />
      </BarChart>
    )
  }
  return (
    <LineChart {...common}>
      {axes}
      <Tooltip {...tooltipProps} />
      <Line
        type="linear"
        dataKey="value"
        stroke={STROKE}
        strokeWidth={2.25}
        dot={false}
        activeDot={{ r: 3.5, fill: STROKE }}
        isAnimationActive={animate}
      />
    </LineChart>
  )
}

/**
 * Hand-rolled tab strip in the KB idiom (real buttons, WAI-ARIA tabs pattern,
 * design tokens) — site surfaces are shadcn-free per the G47 burn-down gate.
 * Roving tabindex; arrow keys, Home and End move selection.
 */
function CoreChartTabStrip({
  tabs,
  active,
  onSelect,
  idBase,
}: {
  tabs: CoreChartTab[]
  active: string
  onSelect: (metric: string) => void
  idBase: string
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next == null) return
    e.preventDefault()
    const metric = tabs[next]!.metric
    onSelect(metric)
    refs.current.get(metric)?.focus()
  }
  return (
    <div role="tablist" aria-label="Market metric" className="flex flex-wrap gap-1 border-b border-border pb-2">
      {tabs.map((t, i) => {
        const selected = t.metric === active
        return (
          <button
            key={t.metric}
            ref={(el) => {
              if (el) refs.current.set(t.metric, el)
              else refs.current.delete(t.metric)
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.metric}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${t.metric}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(t.metric)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t.tabLabel}
          </button>
        )
      })}
    </div>
  )
}

export function MarketCoreCharts({ data, heading, scopeLabel, className }: MarketCoreChartsProps) {
  const tabs = useMemo(() => buildCoreChartTabs(data), [data])
  const reducedMotion = usePrefersReducedMotion()
  const [activeMetric, setActiveMetric] = useState<string | null>(null)
  if (tabs.length === 0) return null
  const active = tabs.find((t) => t.metric === activeMetric)?.metric ?? tabs[0]!.metric
  const tab = tabs.find((t) => t.metric === active)!
  const idBase = 'core-charts'

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6',
        'tabular-nums',
        className,
      )}
    >
      {heading ? (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="text-base font-semibold text-primary">{heading}</h3>
          {scopeLabel ? <span className="text-xs text-muted-foreground">Charted at {scopeLabel} scope</span> : null}
        </div>
      ) : scopeLabel ? (
        <p className="mb-3 text-xs text-muted-foreground">Charted at {scopeLabel} scope</p>
      ) : null}
      <CoreChartTabStrip tabs={tabs} active={active} onSelect={setActiveMetric} idBase={idBase} />
      <div
        role="tabpanel"
        id={`${idBase}-panel-${tab.metric}`}
        aria-labelledby={`${idBase}-tab-${tab.metric}`}
        className="pt-3"
      >
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xl font-bold text-primary">{tab.latestValue}</span>
          <span className="text-xs text-muted-foreground">{tab.latestPeriod}</span>
          {tab.verdictLabel ? (
            <span className="text-xs font-medium text-foreground">{tab.verdictLabel}</span>
          ) : null}
        </div>
        <div className="w-full" style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <ChartForTab tab={tab} animate={!reducedMotion} />
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          {tab.period} · regional MLS via {tab.metric === 'monthsOfSupply'
            ? 'the market stats cache. Months of supply is active inventory divided by average monthly closed sales over the trailing 6 months. Four or less is a seller’s market, four to six is balanced, six or more is a buyer’s market.'
            : tab.metric === 'priceCutShare'
              ? 'the weekly market history snapshot. Share of active listings with at least one price cut.'
              : 'the market stats cache. Completed months only.'}
        </p>
      </div>
    </div>
  )
}
