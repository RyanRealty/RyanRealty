/**
 * Sourced insight board for /cities. Miss omits a page. Never zero-fills
 * a withheld month or invents a share (CLAUDE.md §0).
 */

import { formatCount } from '@/lib/format/count'
import type { PublicMonthlyPoint } from '@/lib/data/market-truth/public-monthly'
import type { CitiesInsightBoard, CitiesInsightSegment } from './CitiesInsight.client'

export type InsightCity = {
  slug: string
  name: string
  activeCount: number | null
}

function publishedCloses(points: readonly PublicMonthlyPoint[]): number[] {
  const window = points.slice(-12)
  if (window.length < 6) return []
  const values = window.map((p) => p.closedCount)
  if (values.some((v) => v == null || !Number.isFinite(v))) return []
  return values.map((v) => Math.round(v as number))
}

function allocationSegments(
  cities: readonly InsightCity[],
): { segments: CitiesInsightSegment[]; total: number } {
  const published = cities.filter((c): c is InsightCity & { activeCount: number } => {
    return c.activeCount != null && Number.isFinite(c.activeCount) && c.activeCount > 0
  })
  if (published.length < 2) return { segments: [], total: 0 }
  const total = published.reduce((sum, c) => sum + c.activeCount, 0)
  if (!(total > 0)) return { segments: [], total: 0 }
  const top = published.slice().sort((a, b) => b.activeCount - a.activeCount).slice(0, 5)
  const topSum = top.reduce((sum, c) => sum + c.activeCount, 0)
  const rest = total - topSum
  const parts = rest > 0 ? [...top, { slug: 'other', name: 'Other cities', activeCount: rest }] : top
  const raw = parts.map((c) => (c.activeCount / total) * 100)
  const rounded = raw.map((n) => Math.round(n))
  const drift = 100 - rounded.reduce((sum, n) => sum + n, 0)
  rounded[rounded.length - 1] = (rounded[rounded.length - 1] ?? 0) + drift
  if (rounded.some((n) => n <= 0)) return { segments: [], total: 0 }
  return {
    total,
    segments: parts.map((c, i) => ({
      name: c.name,
      label: c.name,
      amount: `${formatCount(c.activeCount)} for sale`,
      pct: rounded[i] ?? 0,
      cls: `insight-cards__alloc-seg--${i}`,
      tone: '',
    })),
  }
}

export function citiesInsightBoard(input: {
  cities: readonly InsightCity[]
  regionMonthly: readonly PublicMonthlyPoint[]
  bendMonthly: readonly PublicMonthlyPoint[]
}): CitiesInsightBoard | null {
  const { segments: allocation, total: publishedTotal } = allocationSegments(input.cities)
  const regionCloses = publishedCloses(input.regionMonthly)
  const bendCloses = publishedCloses(input.bendMonthly)
  const compare =
    regionCloses.length >= 6
      ? [
          {
            name: 'Central Oregon',
            values: regionCloses,
            sub: `${formatCount(regionCloses[regionCloses.length - 1]!)} last complete month`,
          },
          ...(bendCloses.length === regionCloses.length
            ? [
                {
                  name: 'Bend',
                  values: bendCloses,
                  sub: `${formatCount(bendCloses[bendCloses.length - 1]!)} last complete month`,
                },
              ]
            : []),
        ]
      : null

  if (allocation.length < 2 && !compare) return null

  const lead = allocation[0]
  const allocationProse = lead
    ? `${lead.name} is ${lead.pct}% of the ${formatCount(publishedTotal)} leftover homes on this directory.`
    : 'Published city leftover by share of homes for sale.'

  const last = regionCloses.at(-1)
  const compareProse =
    last != null
      ? `Closed detached sales by month. Central Oregon closed ${formatCount(last)} in the last complete month. Scrub the line.`
      : 'Closed detached sales by month. Scrub the line.'

  return {
    allocation,
    allocationNote:
      'Share of published single-family homes for sale on this directory. Tap a city to inspect that share.',
    allocationProse,
    compare,
    compareProse,
  }
}
