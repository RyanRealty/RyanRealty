import { describe, it, expect } from 'vitest'
import { medianListPriceOfTiles } from '../tile-medians'

describe('medianListPriceOfTiles', () => {
  it('returns null for an empty set — never 0', () => {
    expect(medianListPriceOfTiles([])).toBeNull()
  })

  it('returns null when no tile carries a usable price', () => {
    expect(medianListPriceOfTiles([{ listPrice: null, propertySubType: null }, { listPrice: 0, propertySubType: null }, { listPrice: -5, propertySubType: null }])).toBeNull()
    expect(medianListPriceOfTiles([{ listPrice: 'not a number', propertySubType: null }])).toBeNull()
  })

  it('publishes the single price for a one-home inventory (a census, not a sample)', () => {
    expect(medianListPriceOfTiles([{ listPrice: 1299000, propertySubType: null }])).toBe(1299000)
  })

  it('takes the middle value for an odd count, regardless of input order', () => {
    expect(medianListPriceOfTiles([{ listPrice: 900000, propertySubType: null }, { listPrice: 500000, propertySubType: null }, { listPrice: 700000, propertySubType: null }])).toBe(700000)
  })

  it('averages and rounds the two middle values for an even count', () => {
    expect(
      medianListPriceOfTiles([
        { listPrice: 500000, propertySubType: null },
        { listPrice: 700001, propertySubType: null },
        { listPrice: 900000, propertySubType: null },
        { listPrice: 1100000, propertySubType: null },
      ]),
    ).toBe(800001)
  })

  it('ignores unpriced tiles rather than counting them as 0', () => {
    // A 0 would drag the median down; the honest answer is the median of the
    // homes that actually carry a price.
    expect(
      medianListPriceOfTiles([{ listPrice: null, propertySubType: null }, { listPrice: 800000, propertySubType: null }, { listPrice: 1000000, propertySubType: null }]),
    ).toBe(900000)
  })

  it('drops a fractional interest — a share price is not a priced home', () => {
    // Eagle Crest published a $547,000 median list against a whole-home
    // $629,450 with 16 of 72 Active rows fractional (live, 2026-08-19).
    expect(
      medianListPriceOfTiles([
        { listPrice: 1, propertySubType: 'Tenancy in Common' },
        { listPrice: 215000, propertySubType: 'Timeshare' },
        { listPrice: 800000, propertySubType: 'Single Family Residence' },
        { listPrice: 1000000, propertySubType: 'Condominium' },
      ]),
    ).toBe(900000)
  })

  it('returns null when every tile is a fractional interest', () => {
    // StoneTH in Sunriver: all 16 Active rows are shares, so the honest median
    // list is no median at all.
    expect(
      medianListPriceOfTiles([
        { listPrice: 84000, propertySubType: 'Tenancy in Common' },
        { listPrice: 105000, propertySubType: 'Tenancy in Common' },
      ]),
    ).toBeNull()
  })

  it('keeps a co-op share, whose price buys one whole unit', () => {
    expect(
      medianListPriceOfTiles([{ listPrice: 329000, propertySubType: 'Stock Cooperative' }]),
    ).toBe(329000)
  })

  it('accepts numeric strings (Currency columns arrive as strings from PostgREST)', () => {
    expect(medianListPriceOfTiles([{ listPrice: '1200000', propertySubType: null }, { listPrice: '800000', propertySubType: null }])).toBe(1000000)
  })
})
