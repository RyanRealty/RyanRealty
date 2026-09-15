import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import { composeInvestInsightChart, investActiveTotal } from './invest-insight'
import { composeInvestPulse, investCounts } from './invest-pulse'
import { composeInvestSegmentRows } from './invest-table'

function row(
  segment: string,
  activeCount: number | null,
  extra: Partial<PublicSegmentRow> = {},
): PublicSegmentRow {
  return {
    segment,
    activeCount,
    medianList: null,
    monthsOfSupply: null,
    verdict: null,
    pendingCount: 'pendingCount' in extra ? extra.pendingCount ?? null : 4,
    closedCount: 'closedCount' in extra ? extra.closedCount ?? null : 12,
    sampleN: activeCount,
    daysToContract: extra.daysToContract ?? 40,
    saleToOriginal: null,
    yoyMedian: null,
    priceCutShare: null,
  } as PublicSegmentRow
}

const LIVE = [
  row('multifamily_2_4', 46, { pendingCount: 6, closedCount: 66 }),
  row('commercial_sale', 61, { pendingCount: 5, closedCount: 57 }),
  row('land', 595, { pendingCount: 18, closedCount: 422 }),
  row('farm', 41, { pendingCount: 2, closedCount: 19 }),
  row('business', 8, { pendingCount: 1, closedCount: 3 }),
]

describe('composeInvestInsightChart', () => {
  it('pages inventory windows and plots every income type on the same counts', () => {
    const chart = composeInvestInsightChart(LIVE)
    expect(chart?.yearPages).toBe(true)
    expect(chart?.keysToggle).toBe(true)
    expect(chart?.series?.map((s) => String(s.name))).toEqual([
      'Sold last 12 months',
      'Under contract',
      'For sale now',
    ])
    const forSale = chart?.series?.at(-1)?.points
    expect(forSale?.map((p) => p.value)).toEqual([595, 61, 46, 41, 8])
    expect(forSale?.[0]?.tick).toBe('Lots')
    expect(forSale?.[0]?.label).toBe('595 lots')
  })

  it('drops a withheld window instead of drawing a zero', () => {
    const chart = composeInvestInsightChart([
      row('land', 595, { pendingCount: null, closedCount: 422 }),
      row('farm', 41, { pendingCount: null, closedCount: 19 }),
    ])
    expect(chart?.series?.map((s) => String(s.name))).toEqual([
      'Sold last 12 months',
      'For sale now',
    ])
  })

  it('publishes nothing when only one type has a count', () => {
    expect(composeInvestInsightChart([row('land', 595)])).toBeNull()
  })
})

describe('one stats source', () => {
  it('Pulse, chart, and table print the same land count and the same total', () => {
    const counts = investCounts(LIVE)
    const pulse = composeInvestPulse({ rows: LIVE, stamp: 'Sep 14, 2026, 4:00 PM' })
    const chart = composeInvestInsightChart(LIVE)
    const table = composeInvestSegmentRows(LIVE)
    const land = counts.find((c) => c.segment === 'land')
    expect(land?.count).toBe(595)
    expect(investActiveTotal(LIVE)).toBe(751)
    expect(pulse?.readings[0]?.figure).toBe('595')
    expect(chart?.series?.at(-1)?.points[0]?.value).toBe(595)
    expect(table[0]?.count).toBe('595 for sale')
  })
})

describe('invest catalog import (Tip Ready route scan)', () => {
  it('imports the insight pager from the installed source', () => {
    const src = readFileSync(new URL('./InvestInsight.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/from '@\/components\/motion\/insight-pager'/)
    expect(src).toMatch(/from '@\/components\/site\/v3'/)
    expect(src).toMatch(/yearPages/)
  })
})
