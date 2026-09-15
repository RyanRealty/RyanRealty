/**
 * /invest InsightCards board — beautifului-insight fed with one read.
 *
 * Allocation is the composition encoding (part-to-whole). Compare and
 * Anomaly use the three published inventory windows (sold 12 months,
 * under contract, for sale now) for lots vs buildings — never a slope
 * across unordered property types, and never an invented time series.
 * Every figure is the same `investCounts()` / segment row the Pulse
 * already prints.
 */
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import { publicSegmentNoun } from '@/lib/data/market-truth/public-segments'
import { investCounts } from './invest-pulse'

export type InvestAllocationSegment = {
  name: string
  label: string
  pct: number
  amount: string
  cls: string
  tone: string
}

export type InvestCompareSeries = {
  name: string
  values: number[]
  sub: string
  tone: 'red' | 'green'
  dot: string
  color: string
  tooltipColor: string
  formatValue?: (v: number) => string
}

export type InvestAnomalyData = {
  spend: number[]
  usage: number[]
}

const SHORT: Record<string, string> = {
  land: 'Lots',
  commercial_sale: 'Commercial',
  multifamily_2_4: '2–4 unit',
  farm: 'Farms',
  business: 'Businesses',
}

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

function typeName(segment: string, count: number): string {
  return SHORT[segment] ?? publicSegmentNoun(segment, count)
}

function shareParts(parts: { key: string; label: string; count: number }[]): InvestAllocationSegment[] {
  const total = parts.reduce((sum, p) => sum + p.count, 0)
  if (total <= 0) return []
  const raw = parts.map((p) => ({ ...p, pct: (p.count / total) * 100 }))
  const rounded = raw.map((p, i) => ({
    ...p,
    pct: i === raw.length - 1 ? 0 : Math.round(p.pct * 10) / 10,
  }))
  const used = rounded.slice(0, -1).reduce((sum, p) => sum + p.pct, 0)
  const last = rounded[rounded.length - 1]
  if (last) last.pct = Math.round((100 - used) * 10) / 10
  return rounded.map((p, i) => ({
    name: p.key,
    label: p.label,
    pct: p.pct,
    amount: n(p.count),
    cls: `insight-cards__alloc-seg--${Math.min(i, 4)}`,
    tone: '',
  }))
}

type WindowPoint = {
  name: string
  lots: number
  buildings: number
}

function publishedWindows(rows: readonly PublicSegmentRow[]): WindowPoint[] {
  const bySegment = new Map(rows.map((row) => [row.segment, row]))
  const land = bySegment.get('land')
  const others = rows.filter((row) => row.segment !== 'land')
  const out: WindowPoint[] = []
  for (const window of WINDOWS) {
    const lots = window.pick(land)
    const buildingBits = others.map((row) => window.pick(row)).filter((v): v is number => v != null && v > 0)
    if (lots == null || lots <= 0) continue
    if (buildingBits.length === 0) continue
    out.push({
      name: window.name,
      lots,
      buildings: buildingBits.reduce((sum, v) => sum + v, 0),
    })
  }
  return out
}

export function investActiveTotal(rows: readonly PublicSegmentRow[]): number {
  return investCounts(rows).reduce((sum, c) => sum + c.count, 0)
}

export type InvestInsightBoard = {
  allocation: InvestAllocationSegment[]
  soldAllocation: InvestAllocationSegment[] | null
  compare: InvestCompareSeries[] | null
  anomaly: InvestAnomalyData | null
  landCount: number
  total: number
  landSharePct: string
  soldLandCount: number | null
  soldTotal: number | null
  windowLabels: string[]
}

export function composeInvestInsight(rows: readonly PublicSegmentRow[]): InvestInsightBoard | null {
  const counts = investCounts(rows)
  if (counts.length < 2) return null
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  if (total <= 0) return null
  const land = counts.find((c) => c.segment === 'land')
  if (!land) return null

  const allocation = shareParts(
    counts.map((c) => ({
      key: SHORT[c.segment] ?? c.segment.slice(0, 4).toUpperCase(),
      label: typeName(c.segment, c.count),
      count: c.count,
    })),
  )
  if (allocation.length < 2) return null

  const bySegment = new Map(rows.map((row) => [row.segment, row]))
  const soldParts = counts.flatMap((c) => {
    const closed = bySegment.get(c.segment)?.closedCount
    return closed != null && closed > 0
      ? [{ key: SHORT[c.segment] ?? c.segment.slice(0, 4).toUpperCase(), label: typeName(c.segment, closed), count: closed }]
      : []
  })
  const soldAllocation = soldParts.length >= 2 ? shareParts(soldParts) : null
  const soldTotal = soldParts.reduce((sum, p) => sum + p.count, 0)
  const soldLand = soldParts.find((p) => p.label === 'Lots')?.count ?? null

  const windows = publishedWindows(rows)
  const compare: InvestCompareSeries[] | null =
    windows.length >= 2
      ? [
          {
            name: 'Lots',
            values: windows.map((w) => w.lots),
            sub: `${n(windows.at(-1)?.lots ?? land.count)} for sale now`,
            tone: 'red',
            dot: '',
            color: '',
            tooltipColor: '',
            formatValue: formatCount,
          },
          {
            name: 'Buildings',
            values: windows.map((w) => w.buildings),
            sub: `${n(windows.at(-1)?.buildings ?? 0)} for sale now`,
            tone: 'green',
            dot: '',
            color: '',
            tooltipColor: '',
            formatValue: formatCount,
          },
        ]
      : null

  const anomaly: InvestAnomalyData | null =
    windows.length >= 2
      ? {
          spend: windows.map((w) => w.lots),
          usage: windows.map((w) => w.buildings),
        }
      : null

  return {
    allocation,
    soldAllocation,
    compare,
    anomaly,
    landCount: land.count,
    total,
    landSharePct: ((land.count / total) * 100).toFixed(1),
    soldLandCount: soldLand,
    soldTotal: soldTotal > 0 ? soldTotal : null,
    windowLabels: windows.map((w) => w.name),
  }
}

function formatCount(v: number): string {
  return Math.round(v).toLocaleString('en-US')
}

/** @deprecated use composeInvestInsight — kept name for older tests during the swap */
export function composeInvestInsightChart(rows: readonly PublicSegmentRow[]): InvestInsightBoard | null {
  return composeInvestInsight(rows)
}
