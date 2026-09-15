import { describe, expect, it } from 'vitest'
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import { composeInvestSegmentRows } from './invest-table'

function row(segment: string, activeCount: number | null): PublicSegmentRow {
  return {
    segment,
    activeCount,
    medianList: null,
    monthsOfSupply: null,
    verdict: null,
    pendingCount: 3,
    closedCount: 12,
    sampleN: activeCount,
    daysToContract: 40,
    saleToOriginal: null,
    yoyMedian: null,
    priceCutShare: null,
  } as PublicSegmentRow
}

describe('composeInvestSegmentRows', () => {
  it('orders by live count and keeps a door plus extra trade bits', () => {
    const rows = composeInvestSegmentRows([
      row('land', 605),
      row('commercial_sale', 61),
      row('multifamily_2_4', 46),
    ])
    expect(rows[0]?.key).toBe('land')
    expect(rows[0]?.count).toBe('605 for sale')
    expect(rows[0]?.href).toContain('lots-and-land')
    expect(rows[0]?.extra).toContain('sold')
  })
})
