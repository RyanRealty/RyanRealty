/**
 * Pure tab-building logic for MarketCoreCharts — separated from the client
 * component so tab omission, per-tab series binding, formatting, and the
 * months-of-supply verdict are unit-testable without a DOM (repo test pattern:
 * logic modules, colocated vitest).
 *
 * §0 discipline lives here too: the months-of-supply verdict is COMPUTED from
 * the latest plotted value via lib/format/months-of-supply (≤4 seller, 4–6
 * balanced, ≥6 buyer) — never hand-written next to the number.
 */

import { formatMonthsOfSupply, monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'
import { formatDate } from '@/lib/format/date'
import {
  v3Text,
  type V3ChartCardProps,
  type V3ChartProps,
} from '@/components/site/v3'
import type {
  CoreChartMetric,
  CoreChartSeries,
  CoreChartSeriesEntry,
} from '@/lib/data/market/getCoreChartSeries'

export type CoreChartRow = {
  /** Compact x-axis label ("Aug 24" style is avoided — "Aug 2024" / "Aug 4"). */
  label: string
  /** Full label for the tooltip ("August 2024" / "Week of Aug 4, 2025"). */
  fullLabel: string
  value: number
}

export type CoreChartTab = {
  metric: CoreChartMetric
  /** Tab trigger text — sentence case, short. */
  tabLabel: string
  kind: 'line' | 'bar'
  rows: CoreChartRow[]
  /** Formatted latest value, e.g. "$742,000" / "38 days" / "4.4 mo". */
  latestValue: string
  /** Period label of the latest point, e.g. "Jun 2026". */
  latestPeriod: string
  /** Months-of-supply only: verdict COMPUTED from the latest value. */
  verdictLabel: string | null
  source: string
  period: string
}

/** A tab needs at least this many points — one dot is not a trend. */
export const MIN_POINTS_PER_TAB = 2

const ORDER: CoreChartMetric[] = [
  'medianClosePrice',
  'activeInventory',
  'medianDom',
  'monthsOfSupply',
  'priceCutShare',
  'closedVolume',
]

const TAB_LABEL: Record<CoreChartMetric, string> = {
  medianClosePrice: 'Median price',
  activeInventory: 'Inventory',
  medianDom: 'Days on market',
  monthsOfSupply: 'Months of supply',
  priceCutShare: 'Price cuts',
  closedVolume: 'Closed sales',
}

const KIND: Record<CoreChartMetric, 'line' | 'bar'> = {
  medianClosePrice: 'line',
  activeInventory: 'line',
  medianDom: 'line',
  monthsOfSupply: 'line',
  priceCutShare: 'line',
  closedVolume: 'bar',
}

/** Brand number rules: currency rounded to the nearest thousand. */
export function formatCoreChartValue(metric: CoreChartMetric, value: number): string {
  switch (metric) {
    case 'medianClosePrice':
      return `$${(Math.round(value / 1000) * 1000).toLocaleString('en-US')}`
    case 'activeInventory':
      return `${Math.round(value).toLocaleString('en-US')} active`
    case 'medianDom':
      return `${Math.round(value)} days`
    case 'monthsOfSupply':
      return `${formatMonthsOfSupply(value)} mo`
    case 'priceCutShare':
      return `${value.toFixed(1)}%`
    case 'closedVolume':
      return `${Math.round(value).toLocaleString('en-US')} sold`
  }
}

/** Compact axis-tick formatter (fits a narrow y-axis gutter). */
export function formatCoreChartAxis(metric: CoreChartMetric, value: number): string {
  switch (metric) {
    case 'medianClosePrice':
      return value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(1)}M` : `$${Math.round(value / 1000)}K`
    case 'priceCutShare':
      return `${Math.round(value)}%`
    case 'monthsOfSupply':
      return formatMonthsOfSupply(value)
    default:
      return Math.round(value).toLocaleString('en-US')
  }
}

const shortMonth = (d: Date) => formatDate(d, { day: undefined, timeZone: 'UTC' })
const fullMonth = (d: Date) => formatDate(d, { month: 'long', day: undefined, timeZone: 'UTC' })
const shortDay = (d: Date) => formatDate(d, { year: undefined, timeZone: 'UTC' })
const fullDay = (d: Date) => formatDate(d, { timeZone: 'UTC' })

function labelsFor(iso: string, granularity: CoreChartSeriesEntry['granularity']): { label: string; fullLabel: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { label: iso, fullLabel: iso }
  if (granularity === 'weekly') {
    return { label: shortDay(d), fullLabel: `Week of ${fullDay(d)}` }
  }
  return { label: shortMonth(d), fullLabel: fullMonth(d) }
}

/**
 * Build the renderable tabs from the DAL payload. A metric whose series is
 * missing or has fewer than MIN_POINTS_PER_TAB points gets NO tab (never an
 * empty chart). Returns [] when nothing is chartable — the module then renders
 * nothing at all.
 */
export function buildCoreChartTabs(data: CoreChartSeries | null | undefined): CoreChartTab[] {
  if (!data) return []
  const byMetric = new Map(data.series.map((s) => [s.metric, s]))
  const tabs: CoreChartTab[] = []
  for (const metric of ORDER) {
    const series = byMetric.get(metric)
    if (!series || series.points.length < MIN_POINTS_PER_TAB) continue
    const rows = series.points.map((p) => ({
      ...labelsFor(p.periodStart, series.granularity),
      value: p.value,
    }))
    const latest = series.points[series.points.length - 1]!
    tabs.push({
      metric,
      tabLabel: TAB_LABEL[metric],
      kind: KIND[metric],
      rows,
      latestValue: formatCoreChartValue(metric, latest.value),
      latestPeriod: labelsFor(latest.periodStart, series.granularity).label,
      verdictLabel:
        metric === 'monthsOfSupply' ? monthsOfSupplyVerdict(latest.value)?.label ?? null : null,
      source: series.source,
      period: series.period,
    })
  }
  return tabs
}

/* -------------------------------------------------------------------------- */
/* v3 card form — the same tabs as one V3ChartCard switcher                    */
/* -------------------------------------------------------------------------- */

/** One tab as a V3Chart panel — the exact conversion MarketCoreCharts renders. */
export function coreChartForTab(tab: CoreChartTab): V3ChartProps {
  return {
    caption: v3Text(`${tab.tabLabel}, ${tab.period}`),
    kind: tab.kind === 'bar' ? ('bars' as const) : ('line' as const),
    // Every bar tab here charts consecutive months of ONE population (closed
    // sales per month), never categories: `run` keeps the primary tone on all
    // bars and drops the per-bar key legend — without it V3Chart printed one
    // legend entry PER MONTH (24 swatch rows above the chart at 375px).
    run: tab.kind === 'bar',
    series: [
      {
        name: v3Text(tab.tabLabel),
        points: tab.rows.map((row) => ({
          value: row.value,
          tick: v3Text(row.label),
          label: v3Text(formatCoreChartReading(tab, row.value)),
        })),
      },
    ],
  }
}

/** Per-metric reading format — one copy, shared with the client module. */
export function formatCoreChartReading(tab: CoreChartTab, value: number): string {
  if (tab.metric === 'medianClosePrice') {
    return `$${(Math.round(value / 1000) * 1000).toLocaleString('en-US')}`
  }
  if (tab.metric === 'priceCutShare') return `${value.toFixed(1)}%`
  if (tab.metric === 'monthsOfSupply') return tab.latestValue
  if (tab.metric === 'medianDom') return `${Math.round(value)} days`
  if (tab.metric === 'closedVolume') return `${Math.round(value).toLocaleString('en-US')} sold`
  return `${Math.round(value).toLocaleString('en-US')} active`
}

/**
 * The whole tabbed module as ONE V3ChartCard with a switcher, for a place
 * Instrument's `cards` slot — the v3 form of MarketCoreCharts, so the market
 * section stays one section (Matt 2026-07-29) on the barrel too. The caller
 * hands data already passed through toPublicCoreChartSeries, so no per-tab
 * source can leak a table name. Null when no tab has two plottable points.
 */
export function coreChartsCard(
  data: CoreChartSeries | null | undefined,
  placeName: string,
  scopeLabel?: string,
): V3ChartCardProps | null {
  const tabs = buildCoreChartTabs(data)
  if (tabs.length === 0) return null
  const sources = [...new Set(tabs.map((t) => t.source))].join(' · ')
  return {
    id: 'core-trends',
    title: v3Text(`${placeName} market trends`),
    line: scopeLabel ? v3Text(scopeLabel) : undefined,
    source: v3Text(sources),
    wide: true,
    switcher: {
      label: v3Text('Metric'),
      items: tabs.map((t) => ({ key: t.metric, label: v3Text(t.tabLabel) })),
      panels: tabs.map((t) => coreChartForTab(t)),
    },
  }
}
