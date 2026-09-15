/**
 * Sourced insight board for /cities. Miss omits a page. Never zero-fills
 * a withheld month or invents a share (CLAUDE.md §0).
 */

import { formatCount } from '@/lib/format/count'
import type { PublicMonthlyPoint } from '@/lib/data/market-truth/public-monthly'
import {
  formatPublishedCloseMonth,
  type CitiesInsightBoard,
  type CitiesInsightSegment,
  type CitiesInsightSeries,
} from './CitiesInsight.client'

export type InsightCity = {
  slug: string
  name: string
  activeCount: number | null
}

function publishedCloseSeries(points: readonly PublicMonthlyPoint[]): CitiesInsightSeries | null {
  const window = points.slice(-12)
  if (window.length < 6) return null
  const values = window.map((p) => p.closedCount)
  if (values.some((v) => v == null || !Number.isFinite(v))) return null
  return {
    name: '',
    values: values.map((v) => Math.round(v as number)),
    sub: '',
    times: window.map((p) => Date.parse(`${p.periodStart}T00:00:00Z`) / 1000),
    labels: window.map((p) => formatPublishedCloseMonth(p.periodStart)),
  }
}

function allocationSegments(
  cities: readonly InsightCity[],
  regionLeftover?: number | null,
): { segments: CitiesInsightSegment[]; total: number } {
  const published = cities.filter((c): c is InsightCity & { activeCount: number } => {
    return c.activeCount != null && Number.isFinite(c.activeCount) && c.activeCount > 0
  })
  if (published.length < 2) return { segments: [], total: 0 }
  const citySum = published.reduce((sum, c) => sum + c.activeCount, 0)
  const leadCount = Math.max(...published.map((c) => c.activeCount))
  const region =
    regionLeftover != null && Number.isFinite(regionLeftover) && regionLeftover >= leadCount
      ? regionLeftover
      : null
  const total = region ?? citySum
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
  regionLeftover?: number | null
}): CitiesInsightBoard | null {
  const { segments: allocation, total: publishedTotal } = allocationSegments(
    input.cities,
    input.regionLeftover,
  )
  const regionCloses = publishedCloseSeries(input.regionMonthly)
  const bendCloses = publishedCloseSeries(input.bendMonthly)
  const compare =
    regionCloses && regionCloses.values.length >= 6
      ? [
          {
            ...regionCloses,
            name: 'Central Oregon',
            sub: `${formatCount(regionCloses.values[regionCloses.values.length - 1]!)} last complete month`,
          },
          ...(bendCloses && bendCloses.values.length === regionCloses.values.length
            ? [
                {
                  ...bendCloses,
                  name: 'Bend',
                  times: regionCloses.times,
                  labels: regionCloses.labels,
                  sub: `${formatCount(bendCloses.values[bendCloses.values.length - 1]!)} last complete month`,
                },
              ]
            : []),
        ]
      : null

  if (allocation.length < 2 && !compare) return null

  const lead = allocation[0]
  const pile =
    input.regionLeftover != null && Number.isFinite(input.regionLeftover) && input.regionLeftover === publishedTotal
      ? `${formatCount(publishedTotal)} leftover homes`
      : `${formatCount(publishedTotal)} leftover homes on this directory`
  const allocationProse = lead
    ? `${lead.name} is ${lead.pct}% of the ${pile}.`
    : 'Published city leftover by share of homes for sale.'

  const last = regionCloses?.values.at(-1)
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
