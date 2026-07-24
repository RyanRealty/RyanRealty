import { describe, it, expect } from 'vitest'
import { medianListPriceOfTiles } from '../tile-medians'

describe('medianListPriceOfTiles', () => {
  it('returns null for an empty set — never 0', () => {
    expect(medianListPriceOfTiles([])).toBeNull()
  })

  it('returns null when no tile carries a usable price', () => {
    expect(medianListPriceOfTiles([{ listPrice: null }, { listPrice: 0 }, { listPrice: -5 }])).toBeNull()
    expect(medianListPriceOfTiles([{ listPrice: 'not a number' }])).toBeNull()
  })

  it('publishes the single price for a one-home inventory (a census, not a sample)', () => {
    expect(medianListPriceOfTiles([{ listPrice: 1299000 }])).toBe(1299000)
  })

  it('takes the middle value for an odd count, regardless of input order', () => {
    expect(medianListPriceOfTiles([{ listPrice: 900000 }, { listPrice: 500000 }, { listPrice: 700000 }])).toBe(700000)
  })

  it('averages and rounds the two middle values for an even count', () => {
    expect(
      medianListPriceOfTiles([
        { listPrice: 500000 },
        { listPrice: 700001 },
        { listPrice: 900000 },
        { listPrice: 1100000 },
      ]),
    ).toBe(800001)
  })

  it('ignores unpriced tiles rather than counting them as 0', () => {
    // A 0 would drag the median down; the honest answer is the median of the
    // homes that actually carry a price.
    expect(
      medianListPriceOfTiles([{ listPrice: null }, { listPrice: 800000 }, { listPrice: 1000000 }]),
    ).toBe(900000)
  })

  it('accepts numeric strings (Currency columns arrive as strings from PostgREST)', () => {
    expect(medianListPriceOfTiles([{ listPrice: '1200000' }, { listPrice: '800000' }])).toBe(1000000)
  })
})
