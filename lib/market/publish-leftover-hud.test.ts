import { describe, expect, it } from 'vitest'
import { EMPTY_PUBLIC_PACE, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { leftoverHudKpis, leftoverHudPublishes, leftoverSaleToListPct } from './publish-leftover-hud'

const pace = (over: Partial<PublicPaceRow> = {}): PublicPaceRow => ({
  ...EMPTY_PUBLIC_PACE,
  ...over,
})

describe('leftoverHudKpis', () => {
  it('uses leftover headlines for active, MOS, and median list', () => {
    const out = leftoverHudKpis({
      grain: 'city',
      headlines: { activeCount: 774, monthsOfSupply: 4.45, medianListPrice: 915000 },
      inventory: { activeCount: 774, medianListPrice: 915000 },
      pace: pace({ closedCount30d: 203, daysToPending90d: 19, saleToOriginal: 0.969, closedCount: 2096 }),
    })
    expect(out.active).toBe(774)
    expect(out.monthsSupply).toBe(4.45)
    expect(out.medianList).toBe(915000)
    expect(out.closed30).toBe(203)
    expect(out.daysToPending).toBe(19)
    expect(out.saleToList).toBeCloseTo(96.9)
    expect(out.sold12mo).toBe(2096)
    expect(out.new30).toBeNull()
  })

  it('keeps leftover inventory when MOS headlines miss, and omits MOS', () => {
    const out = leftoverHudKpis({
      grain: 'city',
      headlines: null,
      inventory: { activeCount: 51, medianListPrice: 799000 },
      pace: pace({ closedCount30d: 4 }),
    })
    expect(out.active).toBe(51)
    expect(out.medianList).toBe(799000)
    expect(out.monthsSupply).toBeNull()
    expect(out.closed30).toBe(4)
    expect(out.new30).toBeNull()
  })

  it('omits on leftover miss and never takes a pulse fill', () => {
    const out = leftoverHudKpis({
      grain: 'region',
      headlines: null,
      inventory: null,
      pace: pace(),
    })
    expect(out).toEqual({
      active: null,
      closed30: null,
      new30: null,
      medianList: null,
      saleToList: null,
      daysToPending: null,
      monthsSupply: null,
      sold12mo: null,
    })
  })

  it('does not map 12-month leftover closed onto Closed · 30 days', () => {
    const out = leftoverHudKpis({
      grain: 'city',
      headlines: null,
      inventory: null,
      pace: pace({ closedCount: 2096, daysToContract: 28 }),
    })
    expect(out.closed30).toBeNull()
    expect(out.daysToPending).toBeNull()
    expect(out.sold12mo).toBe(2096)
    expect(leftoverHudPublishes(out)).toBe(false)
  })

  it('leftoverHudPublishes is true when a HUD cell exists', () => {
    expect(
      leftoverHudPublishes(
        leftoverHudKpis({
          grain: 'city',
          headlines: { activeCount: 51, monthsOfSupply: 4.5, medianListPrice: 799000 },
          inventory: { activeCount: 51, medianListPrice: 799000 },
          pace: pace(),
        }),
      ),
    ).toBe(true)
    expect(
      leftoverHudPublishes(
        leftoverHudKpis({
          grain: 'city',
          headlines: null,
          inventory: null,
          pace: pace(),
        }),
      ),
    ).toBe(false)
  })
})

describe('leftoverSaleToListPct', () => {
  it('turns a leftover share into a percent', () => {
    expect(leftoverSaleToListPct(0.969)).toBeCloseTo(96.9)
    expect(leftoverSaleToListPct(96.9)).toBe(96.9)
    expect(leftoverSaleToListPct(null)).toBeNull()
    expect(leftoverSaleToListPct(0)).toBeNull()
  })
})
