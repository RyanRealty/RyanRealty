import { describe, expect, it } from 'vitest'
import { sellBendLedgerRows } from './sell-market-rows'
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'

describe('sellBendLedgerRows', () => {
  it('keeps the count as the figure and the rest of the sentence as detail', () => {
    const segments = [
      {
        segment: 'condo',
        activeCount: 63,
        medianList: 329000,
        monthsOfSupply: 8,
        verdict: 'buyer',
        closedCount: 62,
      },
    ] as PublicSegmentRow[]
    const rows = sellBendLedgerRows(segments, EMPTY_PUBLIC_PACE)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      when: 'For sale',
      what: 'Condos',
      value: '63',
    })
    expect(String(rows[0]!.detail ?? '')).not.toMatch(/condos for sale/i)
    expect(String(rows[0]!.detail ?? '')).toMatch(/\$329,000/)
  })

  it('does not bar-encode a percent against a count', () => {
    const rows = sellBendLedgerRows([], {
      ...EMPTY_PUBLIC_PACE,
      pendingCount: 295,
      saleToOriginal: 0.97,
    })
    expect(rows.every((r) => r.weight === undefined)).toBe(true)
    expect(rows.map((r) => r.what)).toEqual(['Under contract now', 'Sale price against the first asking price'])
  })
})
