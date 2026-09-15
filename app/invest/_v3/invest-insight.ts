/**
 * /invest insight chart — beautifului-insight adapted into V3Chart.
 *
 * Pager isolates one inventory window (for sale / under contract / sold).
 * The chart scrubber walks property types. Every plotted count is the same
 * `investCounts()` / segment row the Pulse and the table already print, so
 * the three surfaces cannot disagree. A withheld count is absent, never a zero.
 */
import { countTicks } from '@/lib/charts/ticks'
import { v3Text, type V3ChartPoint, type V3ChartProps, type V3ChartSeries } from '@/components/site/v3'
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import { publicSegmentNoun } from '@/lib/data/market-truth/public-segments'
import { investCounts } from './invest-pulse'

const SHORT: Record<string, string> = {
  land: 'Lots',
  commercial_sale: 'Commercial',
  multifamily_2_4: '2–4 unit',
  farm: 'Farms',
  business: 'Businesses',
}

/**
 * Last series is the default year-page (V3ChartHover opens keys.length - 1).
 * For sale now is the finding, so it is last.
 */
const WINDOWS = [
  {
    key: 'closed',
    name: 'Sold last 12 months',
    pick: (row: PublicSegmentRow | undefined) => row?.closedCount ?? null,
  },
  {
    key: 'pending',
    name: 'Under contract',
    pick: (row: PublicSegmentRow | undefined) => row?.pendingCount ?? null,
  },
  {
    key: 'active',
    name: 'For sale now',
    pick: (row: PublicSegmentRow | undefined) => row?.activeCount ?? null,
  },
] as const

function n(value: number): string {
  return value.toLocaleString('en-US')
}

function typeTick(segment: string, count: number): string {
  return SHORT[segment] ?? publicSegmentNoun(segment, count)
}

export function investActiveTotal(rows: readonly PublicSegmentRow[]): number {
  return investCounts(rows).reduce((sum, c) => sum + c.count, 0)
}

export function composeInvestInsightChart(
  rows: readonly PublicSegmentRow[],
): V3ChartProps | null {
  const counts = investCounts(rows)
  if (counts.length < 2) return null
  const bySegment = new Map(rows.map((row) => [row.segment, row]))

  const series: V3ChartSeries[] = []
  for (const window of WINDOWS) {
    const points: V3ChartPoint[] = []
    counts.forEach((c, i) => {
      const value = window.pick(bySegment.get(c.segment))
      if (value == null || value <= 0) return
      const tick = typeTick(c.segment, c.count)
      points.push({
        value,
        label: `${n(value)} ${tick.toLowerCase()}`,
        tick,
        at: i + 1,
      })
    })
    if (points.length < 2) continue
    series.push({ name: v3Text(window.name), points })
  }
  if (series.length < 2) return null

  const yTicks = countTicks(series.map((s) => ({ name: String(s.name), points: s.points })))
  return {
    caption: v3Text('Income property across Central Oregon, by type'),
    series,
    emphasize: 'last',
    marks: true,
    keysToggle: true,
    yearPages: true,
    hover: true,
    restingRead: 'last',
    ...(yTicks.length ? { yTicks } : {}),
    xTicks: counts.map((c, i) => ({
      at: i + 1,
      label: v3Text(typeTick(c.segment, c.count)),
    })),
  }
}

