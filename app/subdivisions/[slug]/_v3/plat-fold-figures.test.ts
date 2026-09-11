import { describe, expect, it } from 'vitest'
import {
  formatPlatSalesPaceLabel,
  platClosedPace12mo,
  platMonthsSupplyFromPace,
  platNewCount30dFromTiles,
} from './plat-fold-figures'

describe('platMonthsSupplyFromPace', () => {
  it('returns active / (closed12/12)', () => {
    // 14 actives, 28 closed in 12 months → ~2.333 sales/month → 6 months supply
    expect(platMonthsSupplyFromPace(14, 28)).toBe(6)
  })

  it('returns null when closed pace is missing', () => {
    expect(platMonthsSupplyFromPace(14, null)).toBeNull()
    expect(platMonthsSupplyFromPace(14, 0)).toBeNull()
    expect(platMonthsSupplyFromPace(0, 28)).toBeNull()
  })
})

describe('platClosedPace12mo', () => {
  it('prefers Market Truth closed_count', () => {
    expect(
      platClosedPace12mo({
        mtClosed12: 22,
        salesYears: [{ year: 2025, closedCount: 9 }],
        nowYear: 2026,
      }),
    ).toBe(22)
  })

  it('falls back to last complete sales-history year', () => {
    expect(
      platClosedPace12mo({
        mtClosed12: null,
        salesYears: [
          { year: 2024, closedCount: 11 },
          { year: 2025, closedCount: 18 },
          { year: 2026, closedCount: 3 },
        ],
        nowYear: 2026,
      }),
    ).toBe(18)
  })
})

describe('formatPlatSalesPaceLabel', () => {
  it('keeps one decimal when the pace is fractional', () => {
    expect(formatPlatSalesPaceLabel(26 / 12)).toBe('2.2')
  })

  it('prints whole numbers without a trailing decimal', () => {
    expect(formatPlatSalesPaceLabel(3)).toBe('3')
    expect(formatPlatSalesPaceLabel(12.0)).toBe('12')
  })
})

describe('platNewCount30dFromTiles', () => {
  const now = Date.parse('2026-09-10T12:00:00Z')

  it('counts SFR houses in the inventory set with on-market in the last 30 days', () => {
    const n = platNewCount30dFromTiles(
      [
        {
          listingKey: 'a',
          onMarketDate: '2026-09-01T00:00:00Z',
          propertyType: 'A',
          propertySubType: 'Single Family Residence',
        },
        {
          listingKey: 'b',
          onMarketDate: '2026-08-01T00:00:00Z',
          propertyType: 'A',
          propertySubType: 'Single Family Residence',
        },
        {
          listingKey: 'c',
          onMarketDate: '2026-09-05T00:00:00Z',
          propertyType: 'D',
          propertySubType: 'Residential Lots',
        },
        {
          listingKey: 'd',
          onMarketDate: '2026-09-02T00:00:00Z',
          propertyType: 'A',
          propertySubType: 'Single Family Residence',
        },
      ],
      new Set(['a', 'b', 'c']),
      now,
    )
    // a in window + inventory; b too old; c land; d not in inventory keys
    expect(n).toBe(1)
  })

  it('returns null when none qualify', () => {
    expect(platNewCount30dFromTiles([], new Set(), now)).toBeNull()
  })
})
