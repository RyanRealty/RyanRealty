import { describe, expect, it } from 'vitest'
import { parseActivityPriceDrop } from './attachListingCardExtras'

describe('parseActivityPriceDrop', () => {
  it('keeps a current cut with a date', () => {
    expect(
      parseActivityPriceDrop(
        { previous_price: 850000, new_price: 825000 },
        '2026-08-20T17:00:00.000Z',
      ),
    ).toEqual({
      previousPrice: 850000,
      newPrice: 825000,
      at: '2026-08-20T17:00:00.000Z',
    })
  })

  it('drops a recovered / relisted raise', () => {
    expect(
      parseActivityPriceDrop(
        { previous_price: 229000, new_price: 299000 },
        '2026-08-20T17:00:00.000Z',
      ),
    ).toBeNull()
  })

  it('drops an undated payload', () => {
    expect(parseActivityPriceDrop({ previous_price: 850000, new_price: 825000 }, '')).toBeNull()
  })
})
