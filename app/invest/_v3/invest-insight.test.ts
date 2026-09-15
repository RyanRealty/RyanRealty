import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import { composeInvestInsight, investActiveTotal } from './invest-insight'
import { composeInvestPulse, investClaim, investCounts, investSplit } from './invest-pulse'

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

describe('composeInvestInsight', () => {
  it('opens on a part-to-whole allocation, not a slope across types', () => {
    const board = composeInvestInsight(LIVE)
    expect(board?.allocation[0]).toMatchObject({ label: 'Lots', amount: '595' })
    const share = board?.allocation.reduce((sum, s) => sum + s.pct, 0)
    expect(share).toBeCloseTo(100, 5)
    expect(board?.landCount).toBe(595)
    expect(board?.total).toBe(751)
  })

  it('compares lots vs buildings across published windows, not types as x', () => {
    const board = composeInvestInsight(LIVE)
    expect(board?.compare?.map((s) => s.name)).toEqual(['Lots', 'Buildings'])
    expect(board?.compare?.[0]?.values).toEqual([422, 18, 595])
    expect(board?.compare?.[1]?.values).toEqual([66 + 57 + 19 + 3, 6 + 5 + 2 + 1, 46 + 61 + 41 + 8])
    expect(board?.windowLabels).toEqual(['Sold last 12 months', 'Under contract', 'For sale now'])
  })

  it('drops a withheld window instead of drawing a zero', () => {
    const board = composeInvestInsight([
      row('land', 595, { pendingCount: null, closedCount: 422 }),
      row('farm', 41, { pendingCount: null, closedCount: 19 }),
    ])
    expect(board?.compare?.[0]?.values).toEqual([422, 595])
    expect(board?.windowLabels).toEqual(['Sold last 12 months', 'For sale now'])
  })

  it('publishes nothing when only one type has a count', () => {
    expect(composeInvestInsight([row('land', 595)])).toBeNull()
  })
})

describe('one stats source', () => {
  it('Pulse, insight allocation, and live total print the same lots vs buildings split', () => {
    const counts = investCounts(LIVE)
    const split = investSplit(counts)
    const pulse = composeInvestPulse({ rows: LIVE, stamp: 'Sep 14, 2026, 4:00 PM' })
    const board = composeInvestInsight(LIVE)
    const lastLots = board?.compare?.[0]?.values.at(-1)
    const lastBuildings = board?.compare?.[1]?.values.at(-1)
    expect(split).toEqual({ lots: 595, buildings: 156, total: 751 })
    expect(investActiveTotal(LIVE)).toBe(751)
    expect(pulse?.readings.map((r) => r.figure)).toEqual(['595', '156'])
    expect(pulse?.readings).toHaveLength(2)
    expect(board?.allocation[0]?.amount).toBe('595')
    expect(board?.landCount).toBe(595)
    expect(board?.buildingsCount).toBe(156)
    expect(board?.total).toBe(751)
    expect(lastLots).toBe(595)
    expect(lastBuildings).toBe(156)
    expect(investClaim(counts)).toContain('land, not buildings')
    expect(split.lots).toBeGreaterThan(split.buildings)
    expect(split.lots + split.buildings).toBe(split.total)
  })
})

describe('invest catalog import (Tip Ready route scan)', () => {
  it('imports InsightCards from the installed source', () => {
    const src = readFileSync(new URL('./InvestInsight.client.tsx', import.meta.url), 'utf8')
    expect(src).toMatch(/from '@\/components\/motion\/insight-cards'/)
    expect(src).toMatch(/InsightCards/)
    expect(src).toMatch(/AllocationCard/)
    expect(src).toMatch(/CompareCard/)
    expect(src).toMatch(/hideLegend/)
    expect(src).toMatch(/allocation-liveline/)
    expect(src).not.toMatch(/yearPages/)
    expect(src).not.toMatch(/AnomalyCard/)
  })
})
